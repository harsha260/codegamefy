import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { env } from './config/env';
import { createSocketServer } from './ws';
import { startMatchmakerLoop } from './modules/matchmaking/matchmakingService';
import authRouter from './modules/auth/authRouter';

// ─── Express App ───
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);

// TODO: Add remaining route modules
// app.use('/api/users', userRouter);
// app.use('/api/problems', problemRouter);
// app.use('/api/submissions', submissionRouter);
// app.use('/api/matches', matchRouter);
// app.use('/api/clans', clanRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP + WebSocket Server ───
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

// ─── Start Matchmaker Loops ───
startMatchmakerLoop('BLITZ_1V1');
startMatchmakerLoop('CODE_GOLF');
// Battle Royale uses scheduled events, not continuous matchmaking

// ─── Start Server ───
const PORT = env.PORT;

httpServer.listen(PORT, () => {
  console.log(`
  ⚔️  CodeArena API Server
  ────────────────────────
  REST API:    http://localhost:${PORT}
  WebSocket:   ws://localhost:${PORT}
  Environment: ${env.NODE_ENV}
  ────────────────────────
  `);
});

export { app, httpServer, io };
