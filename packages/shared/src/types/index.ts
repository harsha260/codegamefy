// ─────────────────────────────────────────────
// User Types
// ─────────────────────────────────────────────

export enum UserClass {
  NONE = 'NONE',
  ARCHITECT = 'ARCHITECT',
  BUG_HUNTER = 'BUG_HUNTER',
  SPEEDRUNNER = 'SPEEDRUNNER',
  OPTIMIZER = 'OPTIMIZER',
  SABOTEUR = 'SABOTEUR',
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  class: UserClass;
  title: string | null;
  country: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export interface UserProfile extends User {
  eloRating: EloRating;
  clanMember: ClanMemberInfo | null;
  matchCount: number;
}

// ─────────────────────────────────────────────
// ELO / Rating Types
// ─────────────────────────────────────────────

export enum EloDimension {
  ALGORITHMS = 'ALGORITHMS',
  DEBUGGING = 'DEBUGGING',
  OPTIMIZATION = 'OPTIMIZATION',
  SPEED = 'SPEED',
}

export interface EloRating {
  algoRating: number;
  algoDeviation: number;
  algoVolatility: number;
  debugRating: number;
  debugDeviation: number;
  debugVolatility: number;
  optRating: number;
  optDeviation: number;
  optVolatility: number;
  speedRating: number;
  speedDeviation: number;
  speedVolatility: number;
  compositeRating: number;
  algoMatchCount: number;
  debugMatchCount: number;
  optMatchCount: number;
  speedMatchCount: number;
}

export interface EloHistoryEntry {
  id: string;
  matchId: string;
  dimension: EloDimension;
  ratingBefore: number;
  ratingAfter: number;
  createdAt: string;
}

export type RankTier =
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER';

export interface RankInfo {
  tier: RankTier;
  subdivision: 1 | 2 | 3;
  label: string;
  color: string;
}

// ─────────────────────────────────────────────
// Problem Types
// ─────────────────────────────────────────────

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXTREME = 'EXTREME',
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: EloDimension;
  tags: string[];
  timeLimit: number;
  memoryLimit: number;
  isCodeGolf: boolean;
  solveCount: number;
  attemptCount: number;
  avgSolveTime: number | null;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isSample: boolean;
  order: number;
}

export interface ProblemWithTestCases extends Problem {
  sampleTestCases: TestCase[];
}

// ─────────────────────────────────────────────
// Match Types
// ─────────────────────────────────────────────

export enum GameMode {
  BLITZ_1V1 = 'BLITZ_1V1',
  CODE_GOLF = 'CODE_GOLF',
  BATTLE_ROYALE = 'BATTLE_ROYALE',
  SABOTAGE = 'SABOTAGE',
}

export enum MatchStatus {
  WAITING = 'WAITING',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum SabotageRole {
  SABOTEUR = 'SABOTEUR',
  DEBUGGER = 'DEBUGGER',
}

export interface Match {
  id: string;
  mode: GameMode;
  status: MatchStatus;
  startedAt: string | null;
  endedAt: string | null;
  duration: number;
}

export interface MatchPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  rank: number | null;
  isEliminated: boolean;
  sabotageRole: SabotageRole | null;
}

export interface MatchProblem {
  problemId: string;
  title: string;
  difficulty: Difficulty;
  points: number;
  order: number;
  lockedByUserId: string | null;
}

export interface MatchState {
  match: Match;
  players: MatchPlayer[];
  problems: MatchProblem[];
  timeRemaining: number;
  currentRound?: number;
}

export interface MatchResult {
  matchId: string;
  mode: GameMode;
  players: Array<
    MatchPlayer & {
      eloChanges: Array<{
        dimension: EloDimension;
        before: number;
        after: number;
      }>;
    }
  >;
  duration: number;
}

// ─────────────────────────────────────────────
// Submission Types
// ─────────────────────────────────────────────

export enum Verdict {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  WRONG_ANSWER = 'WRONG_ANSWER',
  TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
}

export type Language = 'cpp' | 'python' | 'javascript' | 'java' | 'go';

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  matchId: string | null;
  code: string;
  language: Language;
  codeLength: number | null;
  verdict: Verdict;
  runtime: number | null;
  memory: number | null;
  passedTests: number;
  totalTests: number;
  submittedAt: string;
  judgedAt: string | null;
}

export interface TestCaseResult {
  testCaseId: string;
  verdict: Verdict;
  runtime: number;
  memory: number;
  output?: string;
}

export interface JudgeRequest {
  submissionId: string;
  code: string;
  language: Language;
  problemId: string;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
  }>;
  timeLimit: number;
  memoryLimit: number;
}

export interface JudgeResult {
  submissionId: string;
  verdict: Verdict;
  runtime: number | null;
  memory: number | null;
  testResults: TestCaseResult[];
  passedTests: number;
  totalTests: number;
  compileError?: string;
}

// ─────────────────────────────────────────────
// Clan Types
// ─────────────────────────────────────────────

export enum ClanRole {
  LEADER = 'LEADER',
  OFFICER = 'OFFICER',
  MEMBER = 'MEMBER',
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  weeklyScore: number;
  weeklyRank: number | null;
  allTimeScore: number;
  maxMembers: number;
  memberCount: number;
}

export interface ClanMemberInfo {
  clanId: string;
  clanName: string;
  clanTag: string;
  role: ClanRole;
  contributedScore: number;
}

// ─────────────────────────────────────────────
// WebSocket Event Types
// ─────────────────────────────────────────────

export interface ServerToClientEvents {
  // Lobby
  'lobby:queueUpdate': (data: { position: number; estimatedWait: number }) => void;
  'lobby:matchFound': (data: { matchId: string; opponent: MatchPlayer }) => void;

  // Match
  'match:state': (data: MatchState) => void;
  'match:ready': (data: { matchId: string }) => void;
  'match:start': (data: { matchId: string; serverTime: number }) => void;
  'match:tick': (data: { timeRemaining: number }) => void;
  'match:verdict': (data: { userId: string; problemId: string; verdict: Verdict; passedTests: number; totalTests: number }) => void;
  'match:lockout': (data: { problemId: string; userId: string; points: number }) => void;
  'match:scoreUpdate': (data: { userId: string; score: number }) => void;
  'match:eliminate': (data: { userId: string; rank: number }) => void;
  'match:end': (data: MatchResult) => void;
  'match:playerDisconnected': (data: { userId: string }) => void;
  'match:playerReconnected': (data: { userId: string }) => void;

  // Sabotage
  'sabotage:phaseStart': (data: { phase: 1 | 2; code: string; timeLimit: number }) => void;
  'sabotage:phaseEnd': (data: { phase: 1 | 2 }) => void;

  // Spectator
  'spectate:state': (data: MatchState & { codes: Record<string, string> }) => void;
  'spectate:codeUpdate': (data: { userId: string; code: string }) => void;
  'spectate:viewerCount': (data: { count: number }) => void;

  // Chat
  'chat:message': (data: { userId: string; username: string; text: string; timestamp: number }) => void;

  // Errors
  'error': (data: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  // Lobby
  'lobby:joinQueue': (data: { mode: GameMode }) => void;
  'lobby:leaveQueue': () => void;

  // Match
  'match:ack': (data: { matchId: string }) => void;
  'match:submit': (data: { matchId: string; problemId: string; code: string; language: Language; idempotencyKey: string }) => void;
  'match:reconnect': (data: { matchId: string }) => void;

  // Sabotage
  'sabotage:submitCode': (data: { matchId: string; code: string }) => void;

  // Spectator
  'spectate:join': (data: { matchId: string }) => void;
  'spectate:leave': (data: { matchId: string }) => void;

  // Chat
  'chat:send': (data: { matchId: string; text: string }) => void;
}
