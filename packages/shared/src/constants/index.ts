import {
  type RankTier,
  type RankInfo,
  EloDimension,
  type GameMode,
  type Language,
} from '../types';

// ─────────────────────────────────────────────
// ELO Defaults
// ─────────────────────────────────────────────

export const ELO_DEFAULTS = {
  INITIAL_RATING: 1500,
  INITIAL_DEVIATION: 350,
  INITIAL_VOLATILITY: 0.06,
  GLICKO2_TAU: 0.5,
  GLICKO2_SCALE: 173.7178,
  CONVERGENCE_TOLERANCE: 0.000001,
} as const;

export const COMPOSITE_WEIGHTS: Record<EloDimension, number> = {
  ALGORITHMS: 0.35,
  SPEED: 0.25,
  DEBUGGING: 0.20,
  OPTIMIZATION: 0.20,
};

// ─────────────────────────────────────────────
// Rank Tiers
// ─────────────────────────────────────────────

export const RANK_TIERS: Array<{ tier: RankTier; minRating: number; maxRating: number; color: string }> = [
  { tier: 'BRONZE', minRating: 0, maxRating: 1199, color: '#CD7F32' },
  { tier: 'SILVER', minRating: 1200, maxRating: 1499, color: '#C0C0C0' },
  { tier: 'GOLD', minRating: 1500, maxRating: 1799, color: '#FFD700' },
  { tier: 'PLATINUM', minRating: 1800, maxRating: 2099, color: '#00CED1' },
  { tier: 'DIAMOND', minRating: 2100, maxRating: 2399, color: '#B9F2FF' },
  { tier: 'MASTER', minRating: 2400, maxRating: 2699, color: '#FF4500' },
  { tier: 'GRANDMASTER', minRating: 2700, maxRating: Infinity, color: '#FF0000' },
];

export function getRankInfo(rating: number): RankInfo {
  const tierInfo = RANK_TIERS.find(t => rating >= t.minRating && rating <= t.maxRating)
    ?? RANK_TIERS[0]!;

  const rangeSize = tierInfo.maxRating === Infinity
    ? 300
    : tierInfo.maxRating - tierInfo.minRating + 1;
  const positionInTier = rating - tierInfo.minRating;
  const subdivision = positionInTier < rangeSize / 3
    ? 3
    : positionInTier < (rangeSize * 2) / 3
      ? 2
      : 1;

  return {
    tier: tierInfo.tier,
    subdivision: subdivision as 1 | 2 | 3,
    label: `${tierInfo.tier} ${subdivision === 1 ? 'I' : subdivision === 2 ? 'II' : 'III'}`,
    color: tierInfo.color,
  };
}

// ─────────────────────────────────────────────
// Game Mode Configuration
// ─────────────────────────────────────────────

export const GAME_MODE_CONFIG: Record<GameMode, {
  label: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultDuration: number; // seconds
  primaryDimension: EloDimension;
  secondaryDimension: EloDimension;
}> = {
  BLITZ_1V1: {
    label: '1v1 Blitz',
    description: 'Race to solve 5 problems. Lock out your opponent!',
    minPlayers: 2,
    maxPlayers: 2,
    defaultDuration: 1800, // 30 min
    primaryDimension: EloDimension.SPEED,
    secondaryDimension: EloDimension.ALGORITHMS,
  },
  CODE_GOLF: {
    label: 'Code Golf',
    description: 'Shortest code wins. Every character counts.',
    minPlayers: 2,
    maxPlayers: 8,
    defaultDuration: 900, // 15 min
    primaryDimension: EloDimension.OPTIMIZATION,
    secondaryDimension: EloDimension.ALGORITHMS,
  },
  BATTLE_ROYALE: {
    label: 'Battle Royale',
    description: 'Survive elimination rounds. Last coder standing wins.',
    minPlayers: 10,
    maxPlayers: 100,
    defaultDuration: 3600, // 60 min max
    primaryDimension: EloDimension.ALGORITHMS,
    secondaryDimension: EloDimension.SPEED,
  },
  SABOTAGE: {
    label: 'Sabotage & Debug',
    description: 'Plant bugs, then swap and debug. Mind games included.',
    minPlayers: 2,
    maxPlayers: 2,
    defaultDuration: 600, // 10 min total
    primaryDimension: EloDimension.DEBUGGING,
    secondaryDimension: EloDimension.ALGORITHMS,
  },
};

// ─────────────────────────────────────────────
// Matchmaking
// ─────────────────────────────────────────────

export const MATCHMAKING = {
  INITIAL_ELO_RANGE: 150,
  ELO_EXPANSION_RATE: 50,       // expand by this much
  ELO_EXPANSION_INTERVAL: 10_000, // every 10 seconds
  ELO_EXPANSION_START: 30_000,   // start expanding after 30s
  MAX_QUEUE_TIME: 180_000,       // 3 minutes max
  POLL_INTERVAL: 2_000,          // matchmaker runs every 2s
} as const;

// ─────────────────────────────────────────────
// Match Timing
// ─────────────────────────────────────────────

export const MATCH_TIMING = {
  COUNTDOWN_DURATION: 3_000,     // 3-2-1 countdown
  READY_TIMEOUT: 5_000,          // max wait for all players to ack
  TICK_INTERVAL: 1_000,          // timer sync every 1s
  DISCONNECT_GRACE: {
    BLITZ_1V1: 30_000,
    CODE_GOLF: 60_000,
    BATTLE_ROYALE: 15_000,
    SABOTAGE: 30_000,
  },
} as const;

// ─────────────────────────────────────────────
// Sabotage Mode
// ─────────────────────────────────────────────

export const SABOTAGE = {
  PHASE1_DURATION: 60,           // seconds for sabotage phase
  PHASE1_DURATION_SABOTEUR_CLASS: 70, // bonus for Saboteur class
  PHASE2_DURATION: 300,          // seconds for debug phase
  MIN_CHANGES: 2,
  MAX_CHANGES: 5,
  MAX_SCORE: 300,
} as const;

// ─────────────────────────────────────────────
// Battle Royale
// ─────────────────────────────────────────────

export const BATTLE_ROYALE = {
  ROUND_DURATION: 600,           // 10 minutes per round
  ELIMINATION_PERCENTAGES: [0.10, 0.10, 0.10, 0.15, 0.20, 0.25],
  INITIAL_PROBLEMS: 3,
  PROBLEMS_PER_ROUND: 2,
} as const;

// ─────────────────────────────────────────────
// Blitz Scoring
// ─────────────────────────────────────────────

export const BLITZ_POINTS: Record<string, number> = {
  EASY: 100,
  MEDIUM: 200,
  HARD: 400,
};

// ─────────────────────────────────────────────
// Code Golf Scoring
// ─────────────────────────────────────────────

export const CODE_GOLF_PLACEMENT_POINTS = [100, 70, 50, 30, 20, 15, 10, 5];

// ─────────────────────────────────────────────
// Judge
// ─────────────────────────────────────────────

export const JUDGE = {
  DEFAULT_TIME_LIMIT: 2_000,     // ms
  DEFAULT_MEMORY_LIMIT: 256,     // MB
  MAX_SOURCE_SIZE: 65_536,       // 64KB
  CONTAINER_TIMEOUT: 10_000,     // hard kill after 10s
  COMPILE_TIMEOUT: 15_000,       // 15s for compilation
  MAX_PIDS: 64,
  SUBMISSION_COOLDOWN: 2_000,    // ms between submissions
  MATCH_SUBMISSION_PRIORITY: 1,
  PRACTICE_SUBMISSION_PRIORITY: 10,
} as const;

// ─────────────────────────────────────────────
// Supported Languages
// ─────────────────────────────────────────────

export const SUPPORTED_LANGUAGES: Record<Language, {
  id: Language;
  name: string;
  monacoId: string;
  extension: string;
}> = {
  cpp: { id: 'cpp', name: 'C++ 17', monacoId: 'cpp', extension: '.cpp' },
  python: { id: 'python', name: 'Python 3.11', monacoId: 'python', extension: '.py' },
  javascript: { id: 'javascript', name: 'JavaScript (Node 20)', monacoId: 'javascript', extension: '.js' },
  java: { id: 'java', name: 'Java 21', monacoId: 'java', extension: '.java' },
  go: { id: 'go', name: 'Go 1.22', monacoId: 'go', extension: '.go' },
};

// ─────────────────────────────────────────────
// Redis Key Patterns
// ─────────────────────────────────────────────

export const REDIS_KEYS = {
  match: (id: string) => `match:${id}`,
  matchSubmissions: (id: string) => `match:${id}:submissions`,
  matchmakingQueue: (mode: GameMode) => `mm:queue:${mode}`,
  matchmakingWait: (userId: string) => `mm:wait:${userId}`,
  userSession: (userId: string) => `user:session:${userId}`,
  judgeResult: (submissionId: string) => `judge:results:${submissionId}`,
  submitDedup: (key: string) => `submit:dedup:${key}`,
  submitRate: (userId: string, problemId: string) => `submit:rate:${userId}:${problemId}`,
  leaderboardGlobal: () => 'leaderboard:global',
  leaderboardClanWeekly: () => 'leaderboard:clan:weekly',
  spectateViewers: (matchId: string) => `spectate:${matchId}:viewers`,
} as const;
