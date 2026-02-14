import { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis';
import { REDIS_KEYS } from '@codearena/shared';
import type { ServerToClientEvents, ClientToServerEvents } from '@codearena/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register spectator-related WebSocket event handlers.
 * Allows users to watch active matches in real-time.
 */
export function registerSpectatorHandlers(io: IO, socket: Socket): void {
  const userId = socket.data.userId as string;

  /**
   * Join a match as a spectator (read-only).
   */
  socket.on('spectate:join', async (data) => {
    const { matchId } = data;

    try {
      const matchKey = REDIS_KEYS.match(matchId);
      const matchData = await redis.hgetall(matchKey);

      if (!matchData.status || matchData.status === 'FINISHED') {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Match not found or already ended' });
        return;
      }

      // Join spectator room
      socket.join(`spectate:${matchId}`);

      // Track spectator count
      const viewerKey = REDIS_KEYS.spectateViewers(matchId);
      await redis.sadd(viewerKey, userId);
      await redis.expire(viewerKey, 7200);

      const viewerCount = await redis.scard(viewerKey);

      // Send current match state to spectator
      const startedAt = parseInt(matchData.startedAt ?? '0', 10);
      const duration = parseInt(matchData.duration ?? '1800', 10);
      const timeRemaining = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));

      socket.emit('spectate:state', {
        match: {
          id: matchId,
          mode: matchData.mode as any,
          status: matchData.status as any,
          startedAt: matchData.startedAt ? new Date(parseInt(matchData.startedAt)).toISOString() : null,
          endedAt: null,
          duration,
        },
        players: JSON.parse(matchData.players ?? '[]'),
        problems: JSON.parse(matchData.problems ?? '[]'),
        timeRemaining,
        codes: {}, // TODO: stream live code from players
      });

      // Broadcast updated viewer count
      io.to(`spectate:${matchId}`).emit('spectate:viewerCount', { count: viewerCount });
      io.to(`match:${matchId}`).emit('spectate:viewerCount', { count: viewerCount });

      console.log(`[Spectator] ${userId} watching match ${matchId} (${viewerCount} viewers)`);
    } catch (error) {
      console.error(`[Spectator] Error joining:`, error);
      socket.emit('error', { code: 'SPECTATE_ERROR', message: 'Failed to join as spectator' });
    }
  });

  /**
   * Leave spectator mode.
   */
  socket.on('spectate:leave', async (data) => {
    const { matchId } = data;

    try {
      socket.leave(`spectate:${matchId}`);

      const viewerKey = REDIS_KEYS.spectateViewers(matchId);
      await redis.srem(viewerKey, userId);
      const viewerCount = await redis.scard(viewerKey);

      io.to(`spectate:${matchId}`).emit('spectate:viewerCount', { count: viewerCount });
      io.to(`match:${matchId}`).emit('spectate:viewerCount', { count: viewerCount });
    } catch (error) {
      console.error(`[Spectator] Error leaving:`, error);
    }
  });
}
