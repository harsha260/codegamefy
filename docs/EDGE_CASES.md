# ⚠️ Critical Edge Cases & Pitfalls — CodeArena

## 1. Race Conditions

### 1.1 Simultaneous Lockout Claims (Blitz Mode)

**Scenario:** Two players submit accepted solutions for the same problem within milliseconds of each other.

**Problem:** Without atomic locking, both could be credited with the solve.

**Solution: Redis Atomic Lock with `HSETNX`**

```typescript
// modules/match/lockout.ts

async function claimProblem(
  matchId: string,
  problemId: string,
  userId: string,
  submissionTime: number
): Promise<{ claimed: boolean; claimedBy: string }> {
  const key = `match:${matchId}`;
  const field = `lock:${problemId}`;
  const value = JSON.stringify({ userId, time: submissionTime });

  // HSETNX is atomic — only sets if field doesn't exist
  const wasSet = await redis.hsetnx(key, field, value);

  if (wasSet === 1) {
    // This user claimed it first
    return { claimed: true, claimedBy: userId };
  }

  // Someone else already claimed it
  const existing = JSON.parse(await redis.hget(key, field)!);
  return { claimed: false, claimedBy: existing.userId };
}
```

**Why this works:** `HSETNX` (Hash SET if Not eXists) is a single Redis command — it's atomic at the server level. Even if two requests arrive at the same microsecond, Redis processes them sequentially. The first one wins, the second gets a `0` return.

**Additional safeguard:** The judge result timestamp (server-side) is the source of truth, not the client's submission time. This prevents clock manipulation.

---

### 1.2 Concurrent ELO Updates

**Scenario:** A player finishes two matches nearly simultaneously (e.g., they were in a Battle Royale and a clan match ended at the same time).

**Problem:** Two ELO update transactions could read the same "before" rating and overwrite each other (lost update).

**Solution: PostgreSQL Advisory Locks**

```typescript
// modules/elo/eloService.ts

async function updateEloWithLock(
  userId: string,
  dimension: EloDimension,
  matchId: string,
  opponentRating: { rating: number; rd: number },
  score: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Acquire advisory lock on user's ELO (prevents concurrent updates)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    // Now safe to read-modify-write
    const current = await tx.eloRating.findUnique({
      where: { userId },
    });

    const updated = processMatchResult(
      {
        rating: current[`${dimension}Rating`],
        rd: current[`${dimension}Deviation`],
        volatility: current[`${dimension}Volatility`],
      },
      opponentRating,
      score
    );

    await tx.eloRating.update({
      where: { userId },
      data: {
        [`${dimension}Rating`]: updated.rating,
        [`${dimension}Deviation`]: updated.rd,
        [`${dimension}Volatility`]: updated.volatility,
        compositeRating: computeComposite({ ...current, [`${dimension}Rating`]: updated.rating }),
      },
    });

    // Record history
    await tx.eloHistory.create({
      data: {
        userId,
        matchId,
        dimension,
        ratingBefore: current[`${dimension}Rating`],
        ratingAfter: updated.rating,
        deviationBefore: current[`${dimension}Deviation`],
        deviationAfter: updated.rd,
      },
    });
  });
}
```

**Why advisory locks over `SELECT FOR UPDATE`?** Advisory locks are keyed by an arbitrary integer (we hash the userId). They don't lock the row itself — they lock a conceptual resource. This means other queries (reads for leaderboards, profile views) are not blocked. Only concurrent ELO writes for the same user are serialized.

---

### 1.3 Match Start Synchronization

**Scenario:** After matchmaking pairs two players, one player's WebSocket connection is slower. Player A sees the match start 500ms before Player B.

**Problem:** Player A gets a head start reading problems.

**Solution: Two-Phase Start Protocol**

```
Server                    Player A              Player B
  │                          │                      │
  ├── match:ready ──────────▶│                      │
  ├── match:ready ──────────────────────────────────▶│
  │                          │                      │
  │◀── match:ack ────────────┤                      │
  │◀── match:ack ────────────────────────────────────┤
  │                          │                      │
  │  (wait for ALL acks,     │                      │
  │   max 5s timeout)        │                      │
  │                          │                      │
  ├── match:start(t=T) ────▶│                      │
  ├── match:start(t=T) ────────────────────────────▶│
  │                          │                      │
  │  Both clients show       │  Countdown starts    │
  │  countdown from T        │  at same server time │
```

The `match:start` event includes a server timestamp `T`. Both clients synchronize their countdown to this timestamp, compensating for their individual network latency (measured during the `ready/ack` round-trip).

---

## 2. Disconnection Handling

### 2.1 Mid-Match Disconnection

**Scenario:** A player's internet drops during an active match.

**Policy (configurable per mode):**

| Mode | Grace Period | Behavior |
|------|-------------|----------|
| Blitz 1v1 | 30 seconds | Opponent sees "Reconnecting..." badge. If timeout expires, disconnected player forfeits. |
| Code Golf | 60 seconds | Player can rejoin; their code state is preserved in Redis. |
| Battle Royale | 15 seconds | Eliminated immediately (harsh but fair for competitive integrity). |
| Sabotage | 30 seconds | Phase timer pauses for both players during disconnect. |

**Implementation:**

```typescript
// ws/handlers/matchHandler.ts

socket.on('disconnect', async () => {
  const matchId = socket.data.matchId;
  const userId = socket.data.userId;

  if (!matchId) return;

  // Mark player as disconnected in Redis
  await redis.hset(`match:${matchId}`, `dc:${userId}`, Date.now().toString());

  // Notify opponent
  socket.to(`match:${matchId}`).emit('match:playerDisconnected', { userId });

  // Schedule forfeit check
  const gracePeriod = getGracePeriod(await getMatchMode(matchId));
  
  setTimeout(async () => {
    const dcTime = await redis.hget(`match:${matchId}`, `dc:${userId}`);
    if (dcTime) {
      // Still disconnected after grace period → forfeit
      await forfeitMatch(matchId, userId);
    }
  }, gracePeriod);
});

socket.on('match:reconnect', async ({ matchId }) => {
  // Clear disconnect flag
  await redis.hdel(`match:${matchId}`, `dc:${socket.data.userId}`);
  
  // Send full match state to reconnected player
  const state = await getMatchState(matchId);
  socket.emit('match:state', state);
  
  // Notify opponent
  socket.to(`match:${matchId}`).emit('match:playerReconnected', {
    userId: socket.data.userId,
  });
});
```

### 2.2 Server Crash During Active Match

**Scenario:** The API server instance handling a match crashes.

**Mitigation:**
1. **All match state is in Redis**, not in-memory. When the server restarts (or another instance picks up), the match state is intact.
2. **Socket.io Redis adapter** means clients reconnect to any available instance and rejoin their match room.
3. **Match timer is server-authoritative** and stored as `startedAt + duration` in Redis. A new server instance can calculate remaining time from the stored values.
4. **BullMQ jobs are persistent.** If a judge job was in-flight when the server crashed, BullMQ's `stalled job` detection will re-queue it after a configurable timeout (default 30s).

---

## 3. Judge Service Edge Cases

### 3.1 Infinite Loops / Resource Exhaustion

| Attack | Defense |
|--------|---------|
| `while(true) {}` | Hard timeout: `docker kill` after 10s. Container is destroyed. |
| Fork bomb (`:(){ :\|:& };:`) | PID limit: `--pids-limit=64`. Kernel kills excess processes. |
| Memory bomb (`malloc` in loop) | Memory limit: `--memory=256m`. OOM killer triggers. |
| Disk fill (`write()` in loop) | Read-only filesystem except `/tmp` (limited to 64MB tmpfs). |
| Network access | `--network=none`. No DNS, no sockets, no HTTP. |
| Syscall exploits | seccomp profile whitelists only ~40 safe syscalls. |

### 3.2 Non-Deterministic Output

**Scenario:** A solution uses `HashMap` (Java) or `dict` (Python) iteration, producing correct but differently-ordered output across runs.

**Solutions:**
1. **Problem design:** Require sorted output where order matters. State this in constraints.
2. **Special judge:** For problems where multiple valid outputs exist, implement a custom validator function instead of exact string match.
3. **Multiple accepted outputs:** Store multiple valid expected outputs per test case (expensive, use sparingly).

### 3.3 Floating Point Comparison

**Scenario:** Problem expects `3.14159` but solution outputs `3.141590000001`.

**Solution:** Configurable comparison mode per problem:

```typescript
// judge/src/validator.ts

type CompareMode = 'exact' | 'float' | 'special';

function compareOutput(
  expected: string,
  actual: string,
  mode: CompareMode,
  tolerance: number = 1e-6
): boolean {
  switch (mode) {
    case 'exact':
      return expected.trim() === actual.trim();
    
    case 'float':
      const expLines = expected.trim().split('\n');
      const actLines = actual.trim().split('\n');
      if (expLines.length !== actLines.length) return false;
      
      return expLines.every((exp, i) => {
        const expNum = parseFloat(exp);
        const actNum = parseFloat(actLines[i]);
        if (isNaN(expNum) || isNaN(actNum)) return exp.trim() === actLines[i].trim();
        return Math.abs(expNum - actNum) <= tolerance;
      });
    
    case 'special':
      // Delegate to problem-specific validator
      throw new Error('Special judge not implemented inline');
  }
}
```

### 3.4 Judge Queue Backlog During Battle Royale

**Scenario:** 100 players in a Battle Royale all submit within the same 30-second window. That's potentially 100 submissions × 10 test cases = 1,000 judge jobs.

**Mitigations:**

1. **Priority queue:** Match submissions get higher priority than practice submissions.
2. **Concurrency scaling:** Judge workers auto-scale based on queue depth. Threshold: if queue > 50, spin up additional workers.
3. **Early termination:** If a test case fails, skip remaining test cases (for verdict purposes). Still run all for detailed feedback in practice mode.
4. **Pre-warmed containers:** Pool of 20+ idle containers eliminates startup overhead.
5. **Submission throttling:** Max 1 submission per 3 seconds per user in BR mode (longer cooldown than 1v1).

---

## 4. Sabotage Mode Edge Cases

### 4.1 Trivial Sabotage (Breaking Everything)

**Scenario:** Saboteur changes `return result` to `return 0`, making the bug trivially obvious.

**Mitigations:**

1. **Minimum change requirement:** Saboteur must make at least 2 changes but no more than 5.
2. **Diff analysis scoring:** Bugs that are "deeper" (logic errors vs. obvious value changes) earn bonus points.
3. **AST-level validation:** Changes must not alter the function signature or add/remove functions.
4. **Syntax check:** Sabotaged code must compile/parse without errors (enforced server-side before Phase 2 begins).

```typescript
// modules/sabotage/validator.ts

interface SabotageValidation {
  isValid: boolean;
  errors: string[];
  changeCount: number;
  changedLines: number[];
}

async function validateSabotage(
  originalCode: string,
  sabotagedCode: string,
  language: string
): Promise<SabotageValidation> {
  const errors: string[] = [];

  // 1. Must have changes
  const diff = computeDiff(originalCode, sabotagedCode);
  if (diff.changes === 0) {
    errors.push('No changes detected. You must introduce at least 2 bugs.');
  }
  if (diff.changes < 2) {
    errors.push(`Only ${diff.changes} change(s) detected. Minimum is 2.`);
  }
  if (diff.changes > 5) {
    errors.push(`${diff.changes} changes detected. Maximum is 5.`);
  }

  // 2. Must still parse
  const parseResult = await checkSyntax(sabotagedCode, language);
  if (!parseResult.valid) {
    errors.push(`Syntax error: ${parseResult.error}. Code must still compile.`);
  }

  // 3. Must not pass all test cases (it should be broken)
  // This is checked after submission by running against test cases

  return {
    isValid: errors.length === 0,
    errors,
    changeCount: diff.changes,
    changedLines: diff.lines,
  };
}
```

### 4.2 Saboteur Introduces Bugs That Don't Affect Output

**Scenario:** Saboteur changes a variable name in dead code, or modifies a comment. Technically a "change" but not a real bug.

**Solution:** After sabotage phase, the server runs the sabotaged code against all test cases. If it still passes all tests, the sabotage is rejected and the saboteur must try again (with a time penalty).

---

## 5. Matchmaking Edge Cases

### 5.1 Extremely High or Low ELO Players

**Scenario:** A Grandmaster (2500 ELO) queues for a match but no one near their rating is online.

**Solution:**
1. ELO range expands over time (±150 initially, +50 every 10s).
2. After 2 minutes, offer to match against a bot (AI opponent at estimated difficulty).
3. After 3 minutes, offer to join a "challenge match" against a lower-rated player with adjusted ELO stakes (the Grandmaster risks less ELO, the lower player gains more).

### 5.2 Queue Sniping

**Scenario:** Two colluding players queue at the same time to get matched against each other and trade wins.

**Detection:**
```typescript
// modules/matchmaking/antiCollusion.ts

async function checkCollusion(
  userId1: string,
  userId2: string
): Promise<{ suspicious: boolean; reason?: string }> {
  // Check recent match history between these two
  const recentMatches = await prisma.match.count({
    where: {
      AND: [
        { players: { some: { userId: userId1 } } },
        { players: { some: { userId: userId2 } } },
        { startedAt: { gte: subDays(new Date(), 7) } },
      ],
    },
  });

  if (recentMatches >= 5) {
    return {
      suspicious: true,
      reason: `${recentMatches} matches between same players in 7 days`,
    };
  }

  // Check if they queued within 2 seconds of each other repeatedly
  // (tracked in Redis)
  const queuePattern = await getQueueTimingPattern(userId1, userId2);
  if (queuePattern.coincidenceRate > 0.7) {
    return {
      suspicious: true,
      reason: 'Suspiciously correlated queue timing',
    };
  }

  return { suspicious: false };
}
```

**Action:** Flagged pairs are never matched together. Alert sent to admin review queue.

### 5.3 Player Abandons Queue

**Scenario:** Player queues, then closes the browser tab.

**Solution:**
- WebSocket disconnect triggers queue removal after 5s grace period.
- Redis key `mm:wait:{userId}` has a 5-minute TTL as a safety net.
- Matchmaker worker skips users whose WebSocket connection is no longer active.

---

## 6. WebSocket Scaling Pitfalls

### 6.1 Sticky Sessions + Load Balancer

**Problem:** Socket.io's HTTP long-polling transport requires sticky sessions. If the load balancer routes the polling request to a different server than the one holding the session, the connection fails.

**Solution:**
```nginx
# nginx.conf
upstream api_servers {
    ip_hash;  # Sticky sessions based on client IP
    server api-1:3002;
    server api-2:3002;
    server api-3:3002;
}

server {
    location /socket.io/ {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Better alternative:** Force WebSocket-only transport (skip long-polling):
```typescript
// Client
const socket = io(WS_URL, {
  transports: ['websocket'],  // Skip polling, go straight to WS
});
```

This eliminates the sticky session requirement entirely, since WebSocket connections are persistent and don't need to be routed to the same server for subsequent HTTP requests.

### 6.2 Memory Leaks from Abandoned Rooms

**Problem:** If a match ends but the Socket.io room isn't cleaned up, it accumulates in memory.

**Solution:**
- Match rooms have a Redis TTL (2 hours).
- A cleanup cron job runs every 15 minutes, finding matches with `status: FINISHED` older than 30 minutes and explicitly deleting their Redis keys.
- Socket.io rooms are automatically garbage-collected when all sockets leave.

---

## 7. Data Integrity Edge Cases

### 7.1 ELO Rollback on Match Cancellation

**Scenario:** A match is cancelled mid-game (both players disconnect, server error, etc.). ELO changes must not be applied.

**Solution:** ELO is only calculated and applied in the `match:end` handler, which only fires when `status` transitions to `FINISHED`. Cancelled matches transition to `CANCELLED` and skip ELO processing entirely.

### 7.2 Clock Drift Between Client and Server

**Problem:** Client-side timers can drift from server time, causing confusion about remaining time.

**Solution:**
- Server sends `match:tick` every second with authoritative `timeRemaining`.
- Client uses this to correct its local timer.
- All time-sensitive decisions (match end, elimination) are made server-side only.
- Client timer is purely cosmetic — it can be off by ±1s without affecting gameplay.

### 7.3 Duplicate Submissions

**Scenario:** User double-clicks submit, or network retry sends the same code twice.

**Solution:**
- **Client-side:** Disable submit button for 2 seconds after click. Debounce.
- **Server-side:** Idempotency key. Each submission includes a client-generated UUID. Server rejects submissions with duplicate UUIDs within a 10-second window (Redis `SET NX EX 10`).

```typescript
// modules/submission/submissionService.ts

async function submitCode(
  userId: string,
  matchId: string,
  problemId: string,
  code: string,
  language: string,
  idempotencyKey: string
): Promise<{ accepted: boolean; reason?: string }> {
  // Dedup check
  const dedupKey = `submit:dedup:${idempotencyKey}`;
  const isNew = await redis.set(dedupKey, '1', 'NX', 'EX', 10);
  
  if (!isNew) {
    return { accepted: false, reason: 'Duplicate submission' };
  }

  // Rate limit check (1 per 2 seconds per user per problem)
  const rateKey = `submit:rate:${userId}:${problemId}`;
  const recent = await redis.set(rateKey, '1', 'NX', 'EX', 2);
  
  if (!recent) {
    return { accepted: false, reason: 'Rate limited. Wait 2 seconds.' };
  }

  // Enqueue for judging
  await judgeQueue.add('judge', {
    userId, matchId, problemId, code, language,
  }, { priority: matchId ? 1 : 10 });  // Match submissions get priority

  return { accepted: true };
}
```
