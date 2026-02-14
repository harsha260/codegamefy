# 🗄️ Database Schema — CodeArena

## 1. Entity Relationship Diagram (Text)

```
┌──────────┐       ┌─────────────┐       ┌──────────┐
│   User   │──1:N──│ Submission  │──N:1──│ Problem  │
│          │       │             │       │          │
│          │       └─────────────┘       └──────────┘
│          │              │                    │
│          │              │N:1                 │
│          │              ▼                    │
│          │──N:1──┌─────────────┐             │
│          │       │   Match     │─────────────┘
│          │       │             │        N:M (MatchProblem)
│          │       └─────────────┘
│          │              │
│          │              │1:N
│          │              ▼
│          │       ┌──────────────┐
│          │──1:N──│MatchPlayer  │
│          │       └──────────────┘
│          │
│          │──N:1──┌──────────┐
│          │       │   Clan   │
│          │       └──────────┘
│          │              │
│          │              │1:N
│          │              ▼
│          │       ┌──────────────┐
│          │       │ ClanMember  │
│          │       └──────────────┘
│          │
│          │──1:1──┌──────────────┐
│          │       │  EloRating   │
│          │       └──────────────┘
│          │
│          │──1:N──┌──────────────┐
│          │       │  EloHistory  │
│          │       └──────────────┘
└──────────┘
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// USER & AUTHENTICATION
// ─────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  username      String    @unique @db.VarChar(32)
  email         String    @unique @db.VarChar(255)
  passwordHash  String?   // null for OAuth-only users
  avatarUrl     String?
  class         UserClass @default(NONE)
  title         String?   @db.VarChar(64)  // Earned title (e.g., "Grandmaster")
  country       String?   @db.VarChar(2)   // ISO 3166-1 alpha-2

  // OAuth
  githubId      String?   @unique
  googleId      String?   @unique

  // Relations
  eloRating     EloRating?
  eloHistory    EloHistory[]
  submissions   Submission[]
  matchPlayers  MatchPlayer[]
  clanMember    ClanMember?
  createdProblems Problem[] @relation("ProblemAuthor")

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastActiveAt  DateTime  @default(now())

  @@index([username])
  @@index([lastActiveAt])
}

enum UserClass {
  NONE
  ARCHITECT     // UI highlights structural patterns
  BUG_HUNTER    // UI highlights syntax errors
  SPEEDRUNNER   // Enhanced timer visibility
  OPTIMIZER     // Memory/time complexity hints
  SABOTEUR      // Extra time in sabotage phase
}

// ─────────────────────────────────────────────
// ELO RATING (Skill Polygon — Glicko-2)
// ─────────────────────────────────────────────

model EloRating {
  id            String  @id @default(cuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Algorithms dimension
  algoRating    Float   @default(1500)
  algoDeviation Float   @default(350)   // Glicko-2 RD (rating deviation)
  algoVolatility Float  @default(0.06)  // Glicko-2 σ (volatility)

  // Debugging dimension
  debugRating    Float  @default(1500)
  debugDeviation Float  @default(350)
  debugVolatility Float @default(0.06)

  // Optimization dimension
  optRating      Float  @default(1500)
  optDeviation   Float  @default(350)
  optVolatility  Float  @default(0.06)

  // Speed dimension
  speedRating    Float  @default(1500)
  speedDeviation Float  @default(350)
  speedVolatility Float @default(0.06)

  // Composite (weighted average for matchmaking)
  compositeRating Float @default(1500)

  // Match counts per dimension
  algoMatchCount  Int   @default(0)
  debugMatchCount Int   @default(0)
  optMatchCount   Int   @default(0)
  speedMatchCount Int   @default(0)

  updatedAt     DateTime @updatedAt

  @@index([compositeRating])
  @@index([algoRating])
  @@index([speedRating])
}

model EloHistory {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  matchId       String
  match         Match    @relation(fields: [matchId], references: [id])

  dimension     EloDimension
  ratingBefore  Float
  ratingAfter   Float
  deviationBefore Float
  deviationAfter  Float

  createdAt     DateTime @default(now())

  @@index([userId, createdAt])
  @@index([matchId])
}

enum EloDimension {
  ALGORITHMS
  DEBUGGING
  OPTIMIZATION
  SPEED
}

// ─────────────────────────────────────────────
// PROBLEMS
// ─────────────────────────────────────────────

model Problem {
  id            String    @id @default(cuid())
  slug          String    @unique @db.VarChar(128)
  title         String    @db.VarChar(256)
  description   String    @db.Text        // Markdown
  difficulty    Difficulty
  category      EloDimension              // Primary skill dimension
  tags          String[]                  // e.g., ["dp", "graphs", "greedy"]

  // Constraints
  timeLimit     Int       @default(2000)  // ms
  memoryLimit   Int       @default(256)   // MB
  
  // Test cases
  testCases     TestCase[]

  // For Code Golf mode
  isCodeGolf    Boolean   @default(false)
  
  // For Sabotage mode — base working solution
  sabotageCode  String?   @db.Text
  sabotageLanguage String? @db.VarChar(16)

  // Metadata
  authorId      String?
  author        User?     @relation("ProblemAuthor", fields: [authorId], references: [id])
  solveCount    Int       @default(0)
  attemptCount  Int       @default(0)
  avgSolveTime  Float?                    // seconds

  // Relations
  submissions   Submission[]
  matchProblems MatchProblem[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([difficulty, category])
  @@index([slug])
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
  EXTREME
}

model TestCase {
  id            String  @id @default(cuid())
  problemId     String
  problem       Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)

  input         String  @db.Text
  expectedOutput String @db.Text
  isHidden      Boolean @default(true)   // Hidden from users during contest
  isSample      Boolean @default(false)  // Shown in problem description
  order         Int                      // Execution order

  @@index([problemId, order])
}

// ─────────────────────────────────────────────
// MATCHES
// ─────────────────────────────────────────────

model Match {
  id            String      @id @default(cuid())
  mode          GameMode
  status        MatchStatus @default(WAITING)

  // Timing
  scheduledAt   DateTime?               // For Battle Royale scheduled events
  startedAt     DateTime?
  endedAt       DateTime?
  duration      Int                     // Planned duration in seconds

  // Battle Royale specific
  eliminationInterval Int?              // seconds between eliminations
  currentRound  Int?        @default(1)

  // Relations
  players       MatchPlayer[]
  problems      MatchProblem[]
  submissions   Submission[]
  eloHistory    EloHistory[]

  createdAt     DateTime    @default(now())

  @@index([mode, status])
  @@index([startedAt])
}

enum GameMode {
  BLITZ_1V1       // 1v1 Lockout
  CODE_GOLF       // Shortest code wins
  BATTLE_ROYALE   // Elimination rounds
  SABOTAGE        // Sabotage & Debug
}

enum MatchStatus {
  WAITING         // In matchmaking
  STARTING        // Countdown (3-2-1)
  ACTIVE          // In progress
  FINISHED        // Completed normally
  CANCELLED       // Abandoned / error
}

model MatchPlayer {
  id            String  @id @default(cuid())
  matchId       String
  match         Match   @relation(fields: [matchId], references: [id], onDelete: Cascade)
  userId        String
  user          User    @relation(fields: [userId], references: [id])

  score         Int     @default(0)
  rank          Int?                    // Final placement
  isEliminated  Boolean @default(false) // For Battle Royale
  eliminatedAt  DateTime?

  // Sabotage mode specific
  sabotageRole  SabotageRole?
  sabotageCode  String?  @db.Text      // The sabotaged version they created

  joinedAt      DateTime @default(now())

  @@unique([matchId, userId])
  @@index([userId])
  @@index([matchId, score])
}

enum SabotageRole {
  SABOTEUR
  DEBUGGER
}

model MatchProblem {
  id            String  @id @default(cuid())
  matchId       String
  match         Match   @relation(fields: [matchId], references: [id], onDelete: Cascade)
  problemId     String
  problem       Problem @relation(fields: [problemId], references: [id])

  points        Int                     // Points awarded for solving
  order         Int                     // Display order in match

  // Lockout (Blitz) specific
  lockedByUserId String?               // First solver claims it
  lockedAt      DateTime?

  @@unique([matchId, problemId])
  @@index([matchId, order])
}

// ─────────────────────────────────────────────
// SUBMISSIONS
// ─────────────────────────────────────────────

model Submission {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  problemId     String
  problem       Problem         @relation(fields: [problemId], references: [id])
  matchId       String?
  match         Match?          @relation(fields: [matchId], references: [id])

  code          String          @db.Text
  language      String          @db.VarChar(16)  // "cpp", "python", "java", etc.
  codeLength    Int?                              // For Code Golf scoring

  verdict       Verdict         @default(PENDING)
  runtime       Int?                              // ms
  memory        Int?                              // KB
  
  // Per-test-case results
  testResults   Json?           // [{ testCaseId, verdict, runtime, memory }]
  passedTests   Int             @default(0)
  totalTests    Int             @default(0)

  submittedAt   DateTime        @default(now())
  judgedAt      DateTime?

  @@index([userId, problemId])
  @@index([matchId, userId])
  @@index([submittedAt])
}

enum Verdict {
  PENDING
  ACCEPTED
  WRONG_ANSWER
  TIME_LIMIT_EXCEEDED
  MEMORY_LIMIT_EXCEEDED
  RUNTIME_ERROR
  COMPILATION_ERROR
}

// ─────────────────────────────────────────────
// CLANS / GUILDS
// ─────────────────────────────────────────────

model Clan {
  id            String    @id @default(cuid())
  name          String    @unique @db.VarChar(64)
  tag           String    @unique @db.VarChar(6)   // Short tag like [APEX]
  description   String?   @db.Text
  avatarUrl     String?
  bannerUrl     String?

  // Weekly competition
  weeklyScore   Int       @default(0)
  weeklyRank    Int?
  allTimeScore  Int       @default(0)

  // Limits
  maxMembers    Int       @default(50)

  // Relations
  members       ClanMember[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([weeklyScore(sort: Desc)])
  @@index([tag])
}

model ClanMember {
  id            String    @id @default(cuid())
  clanId        String
  clan          Clan      @relation(fields: [clanId], references: [id], onDelete: Cascade)
  userId        String    @unique  // A user can only be in one clan
  user          User      @relation(fields: [userId], references: [id])

  role          ClanRole  @default(MEMBER)
  contributedScore Int    @default(0)  // Weekly contribution

  joinedAt      DateTime  @default(now())

  @@index([clanId, role])
}

enum ClanRole {
  LEADER
  OFFICER
  MEMBER
}
```

---

## 3. Glicko-2 ELO Calculation Logic

### 3.1 Why Glicko-2 over Standard ELO?

| Feature | Standard ELO | Glicko-2 |
|---------|-------------|----------|
| Rating uncertainty | No | Yes (RD — Rating Deviation) |
| Volatility tracking | No | Yes (σ — how consistent a player is) |
| Inactive player handling | No decay | RD increases over time, reflecting uncertainty |
| New player calibration | Fixed K-factor | High RD = larger rating swings for new players |

Glicko-2 is ideal because:
- **New players** calibrate quickly (high RD → large rating changes).
- **Established players** have stable ratings (low RD → small changes).
- **Inactive players** gradually become "uncertain" again, preventing stale ratings.

### 3.2 Implementation (TypeScript)

```typescript
// packages/shared/src/elo/glicko2.ts

const TAU = 0.5;  // System constant (controls volatility change rate)
const EPSILON = 0.000001;  // Convergence tolerance
const GLICKO2_SCALE = 173.7178;  // Converts between Glicko-1 and Glicko-2 scale

interface Rating {
  mu: number;      // Rating on Glicko-2 scale
  phi: number;     // Rating deviation on Glicko-2 scale
  sigma: number;   // Volatility
}

interface Opponent {
  mu: number;
  phi: number;
  score: number;   // 1 = win, 0.5 = draw, 0 = loss
}

/**
 * Convert from display rating (1500 scale) to Glicko-2 internal scale
 */
function toGlicko2(rating: number, rd: number): { mu: number; phi: number } {
  return {
    mu: (rating - 1500) / GLICKO2_SCALE,
    phi: rd / GLICKO2_SCALE,
  };
}

/**
 * Convert from Glicko-2 internal scale back to display rating
 */
function fromGlicko2(mu: number, phi: number): { rating: number; rd: number } {
  return {
    rating: mu * GLICKO2_SCALE + 1500,
    rd: phi * GLICKO2_SCALE,
  };
}

/**
 * g(φ) function — reduces impact of opponents with high uncertainty
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

/**
 * E(μ, μj, φj) — expected score against opponent j
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Compute new volatility using Illinois algorithm
 */
function computeNewVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number
): number {
  const a = Math.log(sigma * sigma);
  const deltaSq = delta * delta;
  const phiSq = phi * phi;

  function f(x: number): number {
    const ex = Math.exp(x);
    const num1 = ex * (deltaSq - phiSq - v - ex);
    const den1 = 2 * Math.pow(phiSq + v + ex, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  }

  let A = a;
  let B: number;

  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Main Glicko-2 rating update
 * 
 * @param player - Current player rating
 * @param opponents - Array of opponents faced in this rating period
 * @returns Updated rating
 */
export function updateRating(
  player: Rating,
  opponents: Opponent[]
): Rating {
  if (opponents.length === 0) {
    // No games played — only RD increases
    const newPhi = Math.sqrt(player.phi * player.phi + player.sigma * player.sigma);
    return { ...player, phi: newPhi };
  }

  // Step 3: Compute v (estimated variance)
  let vInv = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(player.mu, opp.mu, opp.phi);
    vInv += gPhi * gPhi * e * (1 - e);
  }
  const v = 1 / vInv;

  // Step 4: Compute delta (estimated improvement)
  let deltaSum = 0;
  for (const opp of opponents) {
    deltaSum += g(opp.phi) * (opp.score - E(player.mu, opp.mu, opp.phi));
  }
  const delta = v * deltaSum;

  // Step 5: New volatility
  const newSigma = computeNewVolatility(player.sigma, player.phi, v, delta);

  // Step 6: Update RD (pre-rating)
  const phiStar = Math.sqrt(player.phi * player.phi + newSigma * newSigma);

  // Step 7: New rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = player.mu + newPhi * newPhi * deltaSum;

  return {
    mu: newMu,
    phi: newPhi,
    sigma: newSigma,
  };
}

/**
 * High-level function for CodeArena match result processing.
 * Determines which ELO dimension to update based on match mode and problem category.
 */
export function processMatchResult(
  playerRating: { rating: number; rd: number; volatility: number },
  opponentRating: { rating: number; rd: number },
  score: number  // 1 = win, 0.5 = draw, 0 = loss
): { rating: number; rd: number; volatility: number } {
  const player = {
    ...toGlicko2(playerRating.rating, playerRating.rd),
    sigma: playerRating.volatility,
  };

  const opponent: Opponent = {
    ...toGlicko2(opponentRating.rating, opponentRating.rd),
    score,
  };

  const updated = updateRating(player, [opponent]);
  const display = fromGlicko2(updated.mu, updated.phi);

  return {
    rating: Math.round(display.rating),
    rd: Math.round(display.rd * 100) / 100,
    volatility: Math.round(updated.sigma * 10000) / 10000,
  };
}
```

### 3.3 Dimension Mapping

Each game mode primarily affects specific ELO dimensions:

| Game Mode | Primary Dimension | Secondary Dimension |
|-----------|------------------|---------------------|
| Blitz 1v1 | **Speed** | Algorithms |
| Code Golf | **Optimization** | Algorithms |
| Battle Royale | **Algorithms** | Speed |
| Sabotage (Saboteur) | **Debugging** | Algorithms |
| Sabotage (Debugger) | **Debugging** | Speed |

**Composite Rating Calculation:**

```typescript
function computeComposite(elo: EloRating): number {
  // Weighted average — all dimensions matter, but algorithms is king
  return Math.round(
    elo.algoRating * 0.35 +
    elo.debugRating * 0.20 +
    elo.optRating * 0.20 +
    elo.speedRating * 0.25
  );
}
```

---

## 4. Key Indexes & Query Patterns

### 4.1 Critical Queries

| Query | Frequency | Index Strategy |
|-------|-----------|---------------|
| Find match by ID | Every WS event | Primary key |
| Leaderboard (top N by composite) | Every 30s (cached) | `EloRating.compositeRating DESC` |
| User's match history | On profile view | `MatchPlayer(userId)` + `Match(startedAt DESC)` |
| Matchmaking (find similar ELO) | Every 2s per queue | `EloRating.compositeRating` range scan |
| Clan weekly leaderboard | Every 60s (cached) | `Clan.weeklyScore DESC` |
| Problem by difficulty + category | On problem browse | Composite `(difficulty, category)` |
| Submissions for a match | On match view | `Submission(matchId, userId)` |

### 4.2 Partitioning Strategy (Future)

When `Submission` table exceeds 100M rows:
- **Partition by `submittedAt`** (monthly range partitions)
- Old partitions can be moved to cold storage
- Active month stays on fast SSD

When `EloHistory` grows large:
- **Partition by `createdAt`** (quarterly)
- Only recent history needed for graphs; archive older data

---

## 5. Redis Data Structures

| Key Pattern | Type | Purpose | TTL |
|-------------|------|---------|-----|
| `match:{id}` | Hash | Live match state | 2h |
| `match:{id}:submissions` | List | Ordered submission log | 2h |
| `mm:queue:{mode}` | Sorted Set (by ELO) | Matchmaking queue | — |
| `mm:wait:{userId}` | String | Queue join timestamp | 5min |
| `user:session:{userId}` | String | Active WS instance ID | 30min |
| `judge:results:{submissionId}` | String (JSON) | Judge verdict (temp) | 5min |
| `leaderboard:global` | Sorted Set | Cached global rankings | 30s |
| `leaderboard:clan:weekly` | Sorted Set | Clan weekly rankings | 60s |
| `spectate:{matchId}:viewers` | Set | Spectator user IDs | 2h |
