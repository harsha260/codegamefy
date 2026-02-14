import { create } from 'zustand';
import type { MatchState, MatchResult, Verdict, Language } from '@codearena/shared';

interface MatchStoreState {
  // Match state
  matchState: MatchState | null;
  isInMatch: boolean;
  isSearching: boolean;

  // Editor state
  code: string;
  language: Language;
  selectedProblemId: string | null;

  // Results
  lastVerdict: { problemId: string; verdict: Verdict; passedTests: number; totalTests: number } | null;
  matchResult: MatchResult | null;

  // Actions
  setMatchState: (state: MatchState) => void;
  setSearching: (searching: boolean) => void;
  setCode: (code: string) => void;
  setLanguage: (language: Language) => void;
  selectProblem: (problemId: string) => void;
  setVerdict: (verdict: { problemId: string; verdict: Verdict; passedTests: number; totalTests: number }) => void;
  setMatchResult: (result: MatchResult) => void;
  updateTimeRemaining: (time: number) => void;
  reset: () => void;
}

const initialState = {
  matchState: null,
  isInMatch: false,
  isSearching: false,
  code: '',
  language: 'cpp' as Language,
  selectedProblemId: null,
  lastVerdict: null,
  matchResult: null,
};

export const useMatchStore = create<MatchStoreState>((set) => ({
  ...initialState,

  setMatchState: (matchState) =>
    set({
      matchState,
      isInMatch: true,
      isSearching: false,
      selectedProblemId: matchState.problems[0]?.problemId ?? null,
    }),

  setSearching: (isSearching) => set({ isSearching }),

  setCode: (code) => set({ code }),

  setLanguage: (language) => set({ language }),

  selectProblem: (selectedProblemId) => set({ selectedProblemId, code: '' }),

  setVerdict: (lastVerdict) => set({ lastVerdict }),

  setMatchResult: (matchResult) =>
    set({ matchResult, isInMatch: false }),

  updateTimeRemaining: (time) =>
    set((state) => ({
      matchState: state.matchState
        ? { ...state.matchState, timeRemaining: time }
        : null,
    })),

  reset: () => set(initialState),
}));
