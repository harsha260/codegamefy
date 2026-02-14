import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { REDIS_KEYS } from '@codearena/shared';
import type { JudgeRequest, JudgeResult, Verdict } from '@codearena/shared';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

/**
 * BullMQ queue for dispatching code submissions to the Judge service.
 */
export const judgeQueue = new Queue<JudgeRequest>('judge', { connection });

/**
 * Judge result worker — processes verdicts returned from the Judge service.
 * In production, the Judge service would push results back via Redis pub/sub
 * or a callback endpoint. This worker handles the result processing.
 */
export const judgeResultWorker = new Worker<JudgeResult>(
  'judge-results',
  async (job) => {
    const result = job.data;
    const { submissionId, verdict, runtime, memory, testResults, passedTests, totalTests } = result;

    // Update submission in database
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: verdict as any,
        runtime,
        memory,
        testResults: testResults as any,
        passedTests,
        totalTests,
        judgedAt: new Date(),
      },
    });

    // If this is a match submission, handle match-specific logic
    if (submission.matchId) {
      await handleMatchVerdict(submission.matchId, submission.userId, submission.problemId, result);
    }

    console.log(`[Judge] Submission ${submissionId}: ${verdict} (${passedTests}/${totalTests})`);
  },
  { connection },
);

/**
 * Handle a judge verdict in the context of an active match.
 * Updates scores, handles lockout claims, and broadcasts results.
 */
async function handleMatchVerdict(
  matchId: string,
  userId: string,
  problemId: string,
  result: JudgeResult,
): Promise<void> {
  const matchKey = REDIS_KEYS.match(matchId);
  const matchData = await redis.hgetall(matchKey);

  if (matchData.status !== 'ACTIVE') return;

  const mode = matchData.mode;

  // Broadcast verdict to match room (via Redis pub/sub for cross-instance)
  const verdictEvent = {
    userId,
    problemId,
    verdict: result.verdict,
    passedTests: result.passedTests,
    totalTests: result.totalTests,
  };

  await redis.publish(`match:${matchId}:verdict`, JSON.stringify(verdictEvent));

  // Handle ACCEPTED verdict
  if (result.verdict === 'ACCEPTED') {
    if (mode === 'BLITZ_1V1') {
      // Attempt to lock the problem (atomic operation)
      const lockField = `lock:${problemId}`;
      const wasLocked = await redis.hsetnx(matchKey, lockField, userId);

      if (wasLocked === 1) {
        // Successfully locked! Award points
        const problems = JSON.parse(matchData.problems ?? '[]') as Array<{
          problemId: string;
          points: number;
        }>;
        const problem = problems.find((p) => p.problemId === problemId);
        const points = problem?.points ?? 100;

        // Update player score in Redis
        const players = JSON.parse(matchData.players ?? '[]') as Array<{
          userId: string;
          score: number;
          solvedProblems: string[];
        }>;

        const player = players.find((p) => p.userId === userId);
        if (player) {
          player.score += points;
          player.solvedProblems.push(problemId);
        }

        await redis.hset(matchKey, 'players', JSON.stringify(players));

        // Broadcast lockout event
        await redis.publish(`match:${matchId}:lockout`, JSON.stringify({
          problemId,
          userId,
          points,
        }));
      }
    } else if (mode === 'CODE_GOLF') {
      // Update score based on code length (shorter = better)
      const players = JSON.parse(matchData.players ?? '[]') as Array<{
        userId: string;
        score: number;
        bestLength: number | null;
      }>;

      const player = players.find((p) => p.userId === userId);
      if (player) {
        const codeLength = result.testResults?.[0]?.runtime ?? 0; // TODO: get actual code length
        if (!player.bestLength || codeLength < player.bestLength) {
          player.bestLength = codeLength;
        }
      }

      await redis.hset(matchKey, 'players', JSON.stringify(players));
    }
  }
}

judgeResultWorker.on('failed', (job, err) => {
  console.error(`[Judge] Result processing failed for job ${job?.id}:`, err);
});
