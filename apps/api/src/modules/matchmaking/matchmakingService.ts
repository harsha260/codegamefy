import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { MATCHMAKING, REDIS_KEYS, GAME_MODE_CONFIG, BLITZ_POINTS } from '@codearena/shared';
import type { GameMode } from '@codearena/shared';

interface QueuedPlayer {
  userId: string;
  compositeRating: number;
  joinedAt: number;
}

/**
 * Add a player to the matchmaking queue for a specific game mode.
 */
export async function joinQueue(userId: string, mode: GameMode): Promise<void> {
  // Get player's composite rating for matchmaking
  const elo = await prisma.eloRating.findUnique({ where: { userId } });
  const rating = elo?.compositeRating ?? 1500;

  const queueKey = REDIS_KEYS.matchmakingQueue(mode);
  const waitKey = REDIS_KEYS.matchmakingWait(userId);

  // Add to sorted set (score = composite rating)
  await redis.zadd(queueKey, rating, JSON.stringify({
    userId,
    compositeRating: rating,
    joinedAt: Date.now(),
  }));

  // Track queue join time (for expansion logic)
  await redis.set(waitKey, Date.now().toString(), 'EX', 300); // 5 min TTL
}

/**
 * Remove a player from the matchmaking queue.
 */
export async function leaveQueue(userId: string, mode: GameMode): Promise<void> {
  const queueKey = REDIS_KEYS.matchmakingQueue(mode);
  const waitKey = REDIS_KEYS.matchmakingWait(userId);

  // We need to find and remove the member by scanning (userId is in the JSON value)
  const members = await redis.zrange(queueKey, 0, -1);
  for (const member of members) {
    const parsed = JSON.parse(member) as QueuedPlayer;
    if (parsed.userId === userId) {
      await redis.zrem(queueKey, member);
      break;
    }
  }

  await redis.del(waitKey);
}

/**
 * Matchmaker worker — runs periodically to pair players.
 * For 1v1 modes, finds pairs within ELO range.
 */
export async function runMatchmaker(mode: GameMode): Promise<string | null> {
  const config = GAME_MODE_CONFIG[mode];
  const queueKey = REDIS_KEYS.matchmakingQueue(mode);

  // Get all queued players sorted by rating
  const members = await redis.zrange(queueKey, 0, -1, 'WITHSCORES');

  const players: QueuedPlayer[] = [];
  for (let i = 0; i < members.length; i += 2) {
    const data = JSON.parse(members[i]!) as QueuedPlayer;
    players.push(data);
  }

  if (players.length < config.minPlayers) {
    return null; // Not enough players
  }

  // For 1v1 modes: find the closest pair within acceptable ELO range
  if (config.maxPlayers === 2) {
    return findPair(players, mode, queueKey);
  }

  // For multiplayer modes (Code Golf, Battle Royale): group players
  if (players.length >= config.minPlayers) {
    return createMultiplayerMatch(players.slice(0, config.maxPlayers), mode, queueKey);
  }

  return null;
}

/**
 * Find a pair of players within acceptable ELO range for 1v1 matchmaking.
 */
async function findPair(
  players: QueuedPlayer[],
  mode: GameMode,
  queueKey: string,
): Promise<string | null> {
  for (let i = 0; i < players.length - 1; i++) {
    const p1 = players[i]!;
    const p2 = players[i + 1]!;

    // Calculate acceptable ELO range based on wait time
    const now = Date.now();
    const p1Wait = now - p1.joinedAt;
    const p2Wait = now - p2.joinedAt;
    const maxWait = Math.max(p1Wait, p2Wait);

    let acceptableRange = MATCHMAKING.INITIAL_ELO_RANGE;
    if (maxWait > MATCHMAKING.ELO_EXPANSION_START) {
      const expansions = Math.floor(
        (maxWait - MATCHMAKING.ELO_EXPANSION_START) / MATCHMAKING.ELO_EXPANSION_INTERVAL,
      );
      acceptableRange += expansions * MATCHMAKING.ELO_EXPANSION_RATE;
    }

    const eloDiff = Math.abs(p1.compositeRating - p2.compositeRating);

    if (eloDiff <= acceptableRange) {
      // Match found! Remove both from queue
      await redis.zrem(queueKey, JSON.stringify(p1), JSON.stringify(p2));
      await redis.del(REDIS_KEYS.matchmakingWait(p1.userId));
      await redis.del(REDIS_KEYS.matchmakingWait(p2.userId));

      // Create the match
      return createMatch([p1, p2], mode);
    }
  }

  return null;
}

/**
 * Create a multiplayer match from a group of players.
 */
async function createMultiplayerMatch(
  players: QueuedPlayer[],
  mode: GameMode,
  queueKey: string,
): Promise<string> {
  // Remove all matched players from queue
  const pipeline = redis.pipeline();
  for (const p of players) {
    pipeline.zrem(queueKey, JSON.stringify(p));
    pipeline.del(REDIS_KEYS.matchmakingWait(p.userId));
  }
  await pipeline.exec();

  return createMatch(players, mode);
}

/**
 * Create a match record in PostgreSQL and initialize state in Redis.
 */
async function createMatch(players: QueuedPlayer[], mode: GameMode): Promise<string> {
  const config = GAME_MODE_CONFIG[mode];

  // Select problems for the match
  const problemCount = mode === 'BLITZ_1V1' ? 5 : mode === 'CODE_GOLF' ? 1 : 3;
  const problems = await prisma.problem.findMany({
    where: mode === 'CODE_GOLF' ? { isCodeGolf: true } : {},
    take: problemCount,
    orderBy: { id: 'asc' }, // TODO: randomize with proper difficulty distribution
  });

  // Create match in database
  const match = await prisma.match.create({
    data: {
      mode: mode as any,
      duration: config.defaultDuration,
      players: {
        create: players.map((p) => ({
          userId: p.userId,
        })),
      },
      problems: {
        create: problems.map((prob, idx) => ({
          problemId: prob.id,
          points: BLITZ_POINTS[prob.difficulty] ?? 100,
          order: idx,
        })),
      },
    },
  });

  // Initialize match state in Redis
  const matchKey = REDIS_KEYS.match(match.id);
  await redis.hset(matchKey, {
    mode,
    status: 'WAITING',
    duration: config.defaultDuration.toString(),
    players: JSON.stringify(
      players.map((p) => ({
        userId: p.userId,
        score: 0,
        solvedProblems: [],
      })),
    ),
    problems: JSON.stringify(
      problems.map((prob, idx) => ({
        problemId: prob.id,
        points: BLITZ_POINTS[prob.difficulty] ?? 100,
        order: idx,
        lockedBy: null,
      })),
    ),
  });

  // Set TTL on Redis match state (2 hours)
  await redis.expire(matchKey, 7200);

  return match.id;
}

/**
 * Start the matchmaker polling loop for a given mode.
 */
export function startMatchmakerLoop(mode: GameMode): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const matchId = await runMatchmaker(mode);
      if (matchId) {
        console.log(`[Matchmaker] Created match ${matchId} for mode ${mode}`);
      }
    } catch (error) {
      console.error(`[Matchmaker] Error in ${mode}:`, error);
    }
  }, MATCHMAKING.POLL_INTERVAL);
}
