import { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { REDIS_KEYS, JUDGE } from '@codearena/shared';
import type { ServerToClientEvents, ClientToServerEvents } from '@codearena/shared';
import { judgeQueue } from '../../jobs/judgeQueue';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register match-related WebSocket event handlers.
 * Handles code submission, match acknowledgment, and reconnection.
 */
export function registerMatchHandlers(io: IO, socket: Socket): void {
  const userId = socket.data.userId as string;

  /**
   * Player acknowledges they're ready for the match (two-phase start protocol).
   */
  socket.on('match:ack', async (data) => {
    const { matchId } = data;

    try {
      // Join the match room
      socket.join(`match:${matchId}`);
      socket.data.matchId = matchId;

      // Record ack in Redis
      await redis.hset(REDIS_KEYS.match(matchId), `ack:${userId}`, Date.now().toString());

      // Check if all players have acked
      const matchData = await redis.hgetall(REDIS_KEYS.match(matchId));
      const players = JSON.parse(matchData.players ?? '[]') as Array<{ userId: string }>;
      const allAcked = players.every(
        (p) => matchData[`ack:${p.userId}`] !== undefined,
      );

      if (allAcked) {
        // All players ready — start the match
        const serverTime = Date.now();
        await redis.hset(REDIS_KEYS.match(matchId), {
          status: 'ACTIVE',
          startedAt: serverTime.toString(),
        });

        // Update database
        await prisma.match.update({
          where: { id: matchId },
          data: { status: 'ACTIVE', startedAt: new Date(serverTime) },
        });

        // Broadcast match start to all players
        io.to(`match:${matchId}`).emit('match:start', {
          matchId,
          serverTime,
        });

        // Start the match timer
        startMatchTimer(io, matchId, parseInt(matchData.duration ?? '1800', 10));
      }
    } catch (error) {
      console.error(`[Match] Error in ack:`, error);
      socket.emit('error', { code: 'MATCH_ERROR', message: 'Failed to acknowledge match' });
    }
  });

  /**
   * Player submits code for a problem during a match.
   */
  socket.on('match:submit', async (data) => {
    const { matchId, problemId, code, language, idempotencyKey } = data;

    try {
      // Deduplication check
      const dedupKey = REDIS_KEYS.submitDedup(idempotencyKey);
      const isNew = await redis.set(dedupKey, '1', 'NX', 'EX', 10);
      if (!isNew) {
        socket.emit('error', { code: 'DUPLICATE', message: 'Duplicate submission' });
        return;
      }

      // Rate limit check
      const rateKey = REDIS_KEYS.submitRate(userId, problemId);
      const notRateLimited = await redis.set(rateKey, '1', 'NX', 'EX', 2);
      if (!notRateLimited) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Wait 2 seconds between submissions' });
        return;
      }

      // Check if problem is already locked (Blitz mode)
      const matchData = await redis.hgetall(REDIS_KEYS.match(matchId));
      if (matchData.mode === 'BLITZ_1V1') {
        const lockField = `lock:${problemId}`;
        if (matchData[lockField]) {
          socket.emit('error', { code: 'LOCKED', message: 'This problem is already locked' });
          return;
        }
      }

      // Get problem test cases
      const problem = await prisma.problem.findUnique({
        where: { id: problemId },
        include: { testCases: { orderBy: { order: 'asc' } } },
      });

      if (!problem) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Problem not found' });
        return;
      }

      // Create submission record
      const submission = await prisma.submission.create({
        data: {
          userId,
          problemId,
          matchId,
          code,
          language,
          codeLength: code.length,
          totalTests: problem.testCases.length,
        },
      });

      // Enqueue for judging (match submissions get higher priority)
      await judgeQueue.add(
        'judge',
        {
          submissionId: submission.id,
          code,
          language,
          problemId,
          testCases: problem.testCases.map((tc) => ({
            id: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          })),
          timeLimit: problem.timeLimit,
          memoryLimit: problem.memoryLimit,
        },
        {
          priority: JUDGE.MATCH_SUBMISSION_PRIORITY,
        },
      );

      console.log(`[Match] Submission ${submission.id} queued for judging`);
    } catch (error) {
      console.error(`[Match] Error in submit:`, error);
      socket.emit('error', { code: 'SUBMIT_ERROR', message: 'Failed to submit code' });
    }
  });

  /**
   * Player reconnects to an active match.
   */
  socket.on('match:reconnect', async (data) => {
    const { matchId } = data;

    try {
      // Clear disconnect flag
      await redis.hdel(REDIS_KEYS.match(matchId), `dc:${userId}`);

      // Rejoin match room
      socket.join(`match:${matchId}`);
      socket.data.matchId = matchId;

      // Send full match state
      const matchData = await redis.hgetall(REDIS_KEYS.match(matchId));
      const startedAt = parseInt(matchData.startedAt ?? '0', 10);
      const duration = parseInt(matchData.duration ?? '1800', 10);
      const timeRemaining = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          problems: { include: { problem: true }, orderBy: { order: 'asc' } },
        },
      });

      if (match) {
        socket.emit('match:state', {
          match: {
            id: match.id,
            mode: match.mode as any,
            status: matchData.status as any ?? match.status,
            startedAt: match.startedAt?.toISOString() ?? null,
            endedAt: match.endedAt?.toISOString() ?? null,
            duration: match.duration,
          },
          players: JSON.parse(matchData.players ?? '[]'),
          problems: JSON.parse(matchData.problems ?? '[]'),
          timeRemaining,
        });
      }

      // Notify opponent
      socket.to(`match:${matchId}`).emit('match:playerReconnected', { userId });

      console.log(`[Match] ${userId} reconnected to match ${matchId}`);
    } catch (error) {
      console.error(`[Match] Error in reconnect:`, error);
      socket.emit('error', { code: 'RECONNECT_ERROR', message: 'Failed to reconnect' });
    }
  });
}

/**
 * Start a server-authoritative match timer that broadcasts remaining time.
 */
function startMatchTimer(io: IO, matchId: string, durationSeconds: number): void {
  let remaining = durationSeconds;

  const interval = setInterval(async () => {
    remaining--;

    // Broadcast time remaining
    io.to(`match:${matchId}`).emit('match:tick', { timeRemaining: remaining });

    if (remaining <= 0) {
      clearInterval(interval);
      await endMatch(io, matchId);
    }
  }, 1000);
}

/**
 * End a match: calculate scores, update ELO, broadcast results.
 */
async function endMatch(io: IO, matchId: string): Promise<void> {
  try {
    const matchKey = REDIS_KEYS.match(matchId);
    const matchData = await redis.hgetall(matchKey);

    // Update status
    await redis.hset(matchKey, 'status', 'FINISHED');

    // Update database
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'FINISHED',
        endedAt: new Date(),
      },
    });

    const players = JSON.parse(matchData.players ?? '[]') as Array<{
      userId: string;
      score: number;
    }>;

    // Sort by score descending
    players.sort((a, b) => b.score - a.score);

    // Update player ranks
    for (let i = 0; i < players.length; i++) {
      await prisma.matchPlayer.updateMany({
        where: { matchId, userId: players[i]!.userId },
        data: { rank: i + 1, score: players[i]!.score },
      });
    }

    // Broadcast match end with results
    io.to(`match:${matchId}`).emit('match:end', {
      matchId,
      mode: matchData.mode as any,
      players: players.map((p, i) => ({
        userId: p.userId,
        username: '',  // TODO: fetch from DB
        avatarUrl: null,
        score: p.score,
        rank: i + 1,
        isEliminated: false,
        sabotageRole: null,
        eloChanges: [], // TODO: calculate and include ELO changes
      })),
      duration: parseInt(matchData.duration ?? '0', 10),
    });

    // TODO: Enqueue ELO calculation job

    console.log(`[Match] Match ${matchId} ended`);
  } catch (error) {
    console.error(`[Match] Error ending match ${matchId}:`, error);
  }
}
