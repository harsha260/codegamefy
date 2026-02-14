import { Server, Socket } from 'socket.io';
import { joinQueue, leaveQueue } from '../../modules/matchmaking/matchmakingService';
import type { ServerToClientEvents, ClientToServerEvents, GameMode } from '@codearena/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register lobby-related WebSocket event handlers.
 * Handles matchmaking queue join/leave.
 */
export function registerLobbyHandlers(io: IO, socket: Socket): void {
  const userId = socket.data.userId as string;

  /**
   * Player joins the matchmaking queue for a specific game mode.
   */
  socket.on('lobby:joinQueue', async (data) => {
    try {
      const { mode } = data;
      console.log(`[Lobby] ${userId} joining queue for ${mode}`);

      await joinQueue(userId, mode);

      // Join a lobby room for queue updates
      socket.join(`lobby:${mode}`);
      socket.data.queueMode = mode;

      // Send initial queue position (approximate)
      socket.emit('lobby:queueUpdate', {
        position: 1, // TODO: calculate actual position
        estimatedWait: 15,
      });
    } catch (error) {
      console.error(`[Lobby] Error joining queue:`, error);
      socket.emit('error', { code: 'QUEUE_ERROR', message: 'Failed to join queue' });
    }
  });

  /**
   * Player leaves the matchmaking queue.
   */
  socket.on('lobby:leaveQueue', async () => {
    try {
      const mode = socket.data.queueMode as GameMode | undefined;
      if (mode) {
        await leaveQueue(userId, mode);
        socket.leave(`lobby:${mode}`);
        socket.data.queueMode = undefined;
        console.log(`[Lobby] ${userId} left queue for ${mode}`);
      }
    } catch (error) {
      console.error(`[Lobby] Error leaving queue:`, error);
    }
  });
}
