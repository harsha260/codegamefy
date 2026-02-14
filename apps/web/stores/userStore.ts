import { create } from 'zustand';
import type { UserProfile, EloRating, UserClass } from '@codearena/shared';

interface UserState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  setUser: (user: UserProfile, token: string) => void;
  updateElo: (elo: EloRating) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setUser: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  updateElo: (elo) =>
    set((state) => ({
      user: state.user ? { ...state.user, eloRating: elo } : null,
    })),

  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));
