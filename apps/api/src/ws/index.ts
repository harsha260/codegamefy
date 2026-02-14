import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redis, redisPub, redisSub } from '../../config/redis';
import { env } from '../../config/env';
import type { ServerToClientEvents, ClientToServerEvents } from '@codearena/shared';
import type { AuthPayload } from '../../middleware/auth';
import { registerMatchHandlers } from '../handlers/matchHandler';
import { registerLobbyHandlers } from '../handlers/lobbyHandler';
import { registerSpectatorHandlers } from '../handlers/spectatorHandler';

export type AppSocket = ReturnType<typeof createSocketServer> extends Server<
  ClientToServerEvents,
  ServerToClientEvents
>
  ? Parameters<Parameters<Server<ClientToServerEvents, ServerToClientEvents>['on']>[1]>[0]
  : never;

/**
 * Create and configure the Socket.io server with Redis adapter,
 * authentication middleware, and event handlers.
 */
export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Redis adapter for horizontal scaling
  io.adapter(createAdapter(redisPub, redisSub));

  // ─── Authentication Middleware ───
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      socket.data.userClass = payload.class;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Rate Limiting Middleware ───
  io.use((socket, next) => {
    const eventCounts = new Map<string, number>();

    const originalEmit = socket.emit.bind(socket);
    const originalOn = socket.on.bind(socket);

    // Wrap socket.on to add rate limiting to incoming events
    socket.on = function (event: string, listener: (...args: any[]) => void) {
      return originalOn(event, (...args: any[]) => {
        const count = eventCounts.get(event) ?? 0;
        eventCounts.set(event, count + 1);

        // Reset counts every 10 seconds
        if (count === 0) {
          setTimeout(() => eventCounts.delete(event), 10000);
        }

        // Rate limits per event type
        const limits: Record<string, number> = {
          'match:submit': 5,      // 5 submissions per 10s
          'chat:send': 10,        // 10 messages per 10s
          'lobby:joinQueue': 3,   // 3 queue joins per 10s
        };

        const limit = limits[event];
        if (limit && count >= limit) {
          socket.emit('error', {
            code: 'RATE_LIMITED',
            message: `Too many ${event} events. Please slow down.`,
          });
          return;
        }

        listener(...args);
      });
    } as any;

    next();
  });

  // ─── Connection Handler ───
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    console.log(`[WS] User connected: ${userId} (${socket.id})`);

    // Track user's active socket in Redis
    redis.set(`user:session:${userId}`, socket.id, 'EX', 1800);

    // Register event handlers
    registerLobbyHandlers(io, socket);
    registerMatchHandlers(io, socket);
    registerSpectatorHandlers(io, socket);

    // ─── Disconnect ───
    socket.on('disconnect', async (reason) => {
      console.log(`[WS] User disconnected: ${userId} (${reason})`);
      await redis.del(`user:session:${userId}`);

      // Handle mid-match disconnection
      const matchId = socket.data.matchId as string | undefined;
      if (matchId) {
        await redis.hset(`match:${matchId}`, `dc:${userId}`, Date.now().toString());
        socket.to(`match:${matchId}`).emit('match:playerDisconnected', { userId });
      }
    });
  });

  return io;
}
