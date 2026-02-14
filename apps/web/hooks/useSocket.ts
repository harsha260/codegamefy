'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../stores/userStore';
import { useMatchStore } from '../stores/matchStore';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  GameMode,
  Language,
} from '@codearena/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

let globalSocket: TypedSocket | null = null;

/**
 * Hook for managing the WebSocket connection and match events.
 * Maintains a singleton socket connection across the app.
 */
export function useSocket() {
  const accessToken = useUserStore((s) => s.accessToken);
  const {
    setMatchState,
    setSearching,
    setVerdict,
    setMatchResult,
    updateTimeRemaining,
  } = useMatchStore();

  const socketRef = useRef<TypedSocket | null>(null);

  // Connect on mount (if authenticated)
  useEffect(() => {
    if (!accessToken) return;

    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      return;
    }

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    }) as TypedSocket;

    // ─── Match Events ───
    socket.on('match:state', (data) => {
      setMatchState(data);
    });

    socket.on('match:tick', (data) => {
      updateTimeRemaining(data.timeRemaining);
    });

    socket.on('match:verdict', (data) => {
      setVerdict({
        problemId: data.problemId,
        verdict: data.verdict,
        passedTests: data.passedTests,
        totalTests: data.totalTests,
      });
    });

    socket.on('match:end', (data) => {
      setMatchResult(data);
    });

    socket.on('lobby:matchFound', () => {
      setSearching(false);
    });

    socket.on('error', (data) => {
      console.error('[WS] Error:', data.code, data.message);
    });

    globalSocket = socket;
    socketRef.current = socket;

    return () => {
      // Don't disconnect on unmount — keep connection alive
      // socket.disconnect();
    };
  }, [accessToken, setMatchState, setSearching, setVerdict, setMatchResult, updateTimeRemaining]);

  // ─── Actions ───
  const joinQueue = useCallback((mode: GameMode) => {
    socketRef.current?.emit('lobby:joinQueue', { mode });
    setSearching(true);
  }, [setSearching]);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('lobby:leaveQueue');
    setSearching(false);
  }, [setSearching]);

  const submitCode = useCallback(
    (matchId: string, problemId: string, code: string, language: Language) => {
      socketRef.current?.emit('match:submit', {
        matchId,
        problemId,
        code,
        language,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    [],
  );

  const ackMatch = useCallback((matchId: string) => {
    socketRef.current?.emit('match:ack', { matchId });
  }, []);

  const spectateMatch = useCallback((matchId: string) => {
    socketRef.current?.emit('spectate:join', { matchId });
  }, []);

  const leaveSpectate = useCallback((matchId: string) => {
    socketRef.current?.emit('spectate:leave', { matchId });
  }, []);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    joinQueue,
    leaveQueue,
    submitCode,
    ackMatch,
    spectateMatch,
    leaveSpectate,
  };
}
