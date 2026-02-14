import express from 'express';
import { Queue, Worker } from 'bullmq';
import { processJudgeRequest } from './executor';
import type { JudgeRequest, JudgeResult } from '@codearena/shared';

const PORT = parseInt(process.env.JUDGE_PORT ?? '3003', 10);
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);

const connection = { host: REDIS_HOST, port: REDIS_PORT };

// ─── BullMQ Worker ───
// Pulls judge jobs from the queue and processes them
const judgeWorker = new Worker<JudgeRequest>(
  'judge',
  async (job) => {
    console.log(`[Judge] Processing submission ${job.data.submissionId}`);
    const result = await processJudgeRequest(job.data);

    // Push result to the results queue for the API to process
    await resultsQueue.add('result', result, { removeOnComplete: true });

    return result;
  },
  {
    connection,
    concurrency: 5, // Process up to 5 submissions concurrently
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  },
);

// Queue for pushing results back to the API
const resultsQueue = new Queue<JudgeResult>('judge-results', { connection });

judgeWorker.on('completed', (job) => {
  console.log(`[Judge] Completed: ${job.id}`);
});

judgeWorker.on('failed', (job, err) => {
  console.error(`[Judge] Failed: ${job?.id}`, err.message);
});

// ─── Health Check HTTP Server ───
const app = express();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    worker: {
      running: judgeWorker.isRunning(),
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`
  🔬 CodeArena Judge Service
  ──────────────────────────
  Health:  http://localhost:${PORT}/health
  Worker:  Listening on 'judge' queue
  Redis:   ${REDIS_HOST}:${REDIS_PORT}
  ──────────────────────────
  `);
});
