# 🏗️ System Architecture — CodeArena

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ Web App  │  │ Spectator│  │  Admin   │                          │
│  │ (Next.js)│  │  View    │  │  Panel   │                          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
│       │              │              │                                │
│       └──────────────┼──────────────┘                                │
│                      │                                               │
│            ┌─────────▼──────────┐                                    │
│            │   CDN / Edge       │  (Vercel / Cloudflare)             │
│            │   (Static + SSR)   │                                    │
│            └─────────┬──────────┘                                    │
└──────────────────────┼──────────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     Load Balancer       │  (Nginx / AWS ALB)
          │  (HTTP + WebSocket)     │
          └───────┬─────────┬───────┘
                  │         │
        ┌─────────▼───┐ ┌──▼──────────┐
        │  REST API   │ │  WebSocket  │
        │  (Express)  │ │  Gateway    │
        │  Port 3001  │ │  (Socket.io)│
        │             │ │  Port 3002  │
        └──────┬──────┘ └──────┬──────┘
               │               │
               └───────┬───────┘
                       │
          ┌────────────▼────────────┐
          │    Service Layer        │
          │                         │
          │  ┌─────┐ ┌──────────┐  │
          │  │Auth │ │Matchmaker│  │
          │  └─────┘ └──────────┘  │
          │  ┌─────┐ ┌──────────┐  │
          │  │ELO  │ │Sabotage  │  │
          │  └─────┘ └──────────┘  │
          │  ┌─────┐ ┌──────────┐  │
          │  │Clan │ │Spectator │  │
          │  └─────┘ └──────────┘  │
          └────────────┬────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐
   │PostgreSQL│  │   Redis   │  │  Judge  │
   │  (Data)  │  │(State/Pub)│  │ Service │
   │          │  │           │  │(Docker) │
   └──────────┘  └───────────┘  └─────────┘
```

---

## 2. Tech Stack Finalization

### 2.1 Why Node.js + Express over Go?

| Factor | Node.js/Express | Go |
|--------|----------------|-----|
| **WebSocket ecosystem** | Socket.io is battle-tested, handles reconnection, rooms, namespaces natively | `gorilla/websocket` is lower-level, requires manual room management |
| **Type sharing** | Shared TypeScript types between frontend and backend via monorepo | Requires code generation (protobuf) or separate type definitions |
| **Developer velocity** | Faster iteration for MVP; same language across stack | Higher performance ceiling but slower iteration |
| **Concurrency** | Event loop handles thousands of concurrent WS connections efficiently | Goroutines are superior for CPU-bound work |
| **Judge service** | Judge is I/O-bound (spawning Docker containers), Node is fine | Go would be marginally better here |

**Decision:** Node.js/Express for API + WS gateway. The Judge service could be rewritten in Go post-MVP if throughput becomes a bottleneck. The shared TypeScript monorepo advantage is decisive for MVP velocity.

### 2.2 Why Socket.io over Liveblocks?

| Factor | Socket.io | Liveblocks |
|--------|----------|------------|
| **Control** | Full control over protocol, rooms, events | Managed service, opinionated API |
| **Cost** | Free (self-hosted) | Per-connection pricing at scale |
| **Custom events** | Unlimited custom event types | Designed for CRDT/presence, not game events |
| **Scaling** | Redis adapter for horizontal scaling | Built-in scaling |
| **Latency** | Direct WS, ~2-5ms server-side | Additional hop through Liveblocks infra |

**Decision:** Socket.io with Redis adapter. We need custom game events (lockout claims, sabotage submissions, elimination broadcasts) that don't map to Liveblocks' CRDT model.

### 2.3 Why PostgreSQL + Redis (not MongoDB)?

- **ELO calculations** require ACID transactions — a rating update must be atomic across multiple dimension columns.
- **Match history** is inherently relational (User → Match → Submission → Problem).
- **Redis** handles ephemeral state: live match state, matchmaking queues, WS pub/sub for horizontal scaling.
- MongoDB's eventual consistency model is dangerous for competitive scoring.

---

## 3. Component Deep-Dives

### 3.1 WebSocket Gateway Architecture

```
┌─────────────────────────────────────────────┐
│              Socket.io Server                │
│                                              │
│  Namespaces:                                 │
│  ├── /match      (game events)               │
│  ├── /lobby      (matchmaking, queue)        │
│  ├── /spectate   (read-only game stream)     │
│  └── /chat       (in-match + global chat)    │
│                                              │
│  Middleware Pipeline:                        │
│  ├── 1. JWT Authentication                   │
│  ├── 2. Rate Limiting (per-event)            │
│  ├── 3. Room Authorization                   │
│  └── 4. Event Validation (Zod)               │
│                                              │
│  Scaling:                                    │
│  └── @socket.io/redis-adapter                │
│      (Redis Pub/Sub for multi-instance)      │
└─────────────────────────────────────────────┘
```

**Key Events (Match Namespace):**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `match:state` | Server → Client | Full match state | Initial state on join |
| `match:submit` | Client → Server | `{ problemId, code, language }` | Code submission |
| `match:verdict` | Server → Client | `{ problemId, verdict, time, memory }` | Judge result |
| `match:lockout` | Server → All | `{ problemId, userId }` | Problem claimed (Blitz) |
| `match:eliminate` | Server → Client | `{ userId }` | Player eliminated (BR) |
| `match:tick` | Server → All | `{ timeRemaining }` | Timer sync (every 1s) |
| `match:end` | Server → All | `{ results, eloChanges }` | Match conclusion |

### 3.2 Matchmaking System

```
Player clicks "Find Match"
        │
        ▼
┌───────────────────┐
│  Matchmaking Queue │  (Redis Sorted Set, scored by ELO)
│  Key: mm:{mode}    │
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────┐
│  Matchmaker Worker (runs every 2s)│
│                                    │
│  1. Pop players from queue         │
│  2. Group by ELO proximity         │
│     (±150 ELO, expanding over time)│
│  3. Create match room in Redis     │
│  4. Emit "match:found" via WS      │
│  5. Insert Match record in Postgres│
└───────────────────────────────────┘
```

**ELO Proximity Expansion:** If a player waits >30s, the acceptable ELO range expands by 50 points every 10s. This prevents high-ELO players from waiting indefinitely.

### 3.3 Judge Service Architecture

```
┌──────────────────────────────────────────────┐
│              Judge Service                    │
│                                               │
│  ┌─────────────┐    ┌──────────────────────┐ │
│  │ BullMQ Queue│───▶│  Executor Worker     │ │
│  │ (Redis)     │    │                      │ │
│  └─────────────┘    │  1. Pull job          │ │
│                     │  2. Select language    │ │
│                     │     config             │ │
│                     │  3. Spawn Docker       │ │
│                     │     container          │ │
│                     │  4. Mount code as      │ │
│                     │     read-only volume   │ │
│                     │  5. Execute with       │ │
│                     │     resource limits    │ │
│                     │  6. Compare output     │ │
│                     │  7. Return verdict     │ │
│                     └──────────────────────┘ │
│                                               │
│  Security Layers:                             │
│  ├── seccomp profile (syscall whitelist)      │
│  ├── cgroups v2 (CPU: 1 core, RAM: 256MB)    │
│  ├── no network access (--network=none)       │
│  ├── read-only filesystem (except /tmp)       │
│  ├── execution timeout (10s hard kill)        │
│  └── PID limit (64 processes max)             │
└──────────────────────────────────────────────┘
```

**Language Configuration Example (C++):**

```typescript
// packages/judge/src/languages/cpp.ts
export const cppConfig: LanguageConfig = {
  id: 'cpp',
  name: 'C++ 17',
  image: 'codearena/runner-cpp:latest',
  compile: 'g++ -std=c++17 -O2 -o solution solution.cpp',
  run: './solution',
  sourceFile: 'solution.cpp',
  timeout: { compile: 15000, run: 10000 },  // ms
  memory: 256 * 1024 * 1024,                // 256MB
  fileSize: 64 * 1024,                      // 64KB source limit
};
```

### 3.4 Real-Time Match State (Redis)

Each active match stores its state in Redis for sub-millisecond reads:

```
Key: match:{matchId}
Type: Hash

Fields:
  mode        → "blitz" | "codegolf" | "battleRoyale" | "sabotage"
  status      → "waiting" | "active" | "finished"
  startedAt   → Unix timestamp (ms)
  duration    → 1800000 (30 min in ms)
  players     → JSON: [{ userId, score, solvedProblems[] }]
  problems    → JSON: [{ problemId, points, lockedBy }]
  spectators  → count

TTL: 2 hours (auto-cleanup)
```

**Why Redis Hash over JSON?**
- Individual field reads (`HGET match:123 status`) without deserializing the entire object.
- Atomic field updates (`HINCRBY` for scores).
- Memory-efficient for the access patterns we need.

---

## 4. Frontend Architecture

### 4.1 State Management Strategy

```
┌─────────────────────────────────────────┐
│              Client State                │
│                                          │
│  Zustand Stores:                         │
│  ├── userStore      (auth, profile, ELO) │
│  ├── matchStore     (live match state)   │
│  ├── editorStore    (code, language)     │
│  ├── uiStore        (modals, toasts)     │
│  └── audioStore     (SFX volume, mute)   │
│                                          │
│  React Query:                            │
│  ├── Problems list (cached 5 min)        │
│  ├── Leaderboards (cached 30s)           │
│  ├── Match history (cached 1 min)        │
│  └── Clan data (cached 2 min)            │
│                                          │
│  Socket State (real-time, not cached):   │
│  ├── Match events → matchStore           │
│  ├── Queue position → uiStore            │
│  └── Spectator feed → matchStore         │
└─────────────────────────────────────────┘
```

### 4.2 "Juicy" Game Feel Implementation

**Passing a Test Case — The "Critical Hit" Sequence:**

```typescript
// Triggered when match:verdict event arrives with verdict === 'ACCEPTED'
async function onTestCasePassed(testIndex: number, isFullSolve: boolean) {
  // 1. Screen shake (Framer Motion)
  await controls.start({
    x: [0, -4, 4, -2, 2, 0],
    transition: { duration: 0.3 }
  });

  // 2. Particle burst (tsParticles)
  confetti.addConfetti({
    particleCount: isFullSolve ? 100 : 30,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#00ff88', '#00cc66', '#ffffff'],
  });

  // 3. Sound effect (Howler.js)
  audioManager.play(isFullSolve ? 'solve_complete' : 'test_pass');

  // 4. Score counter animation (spring physics)
  animateScore(prevScore, newScore, { type: 'spring', stiffness: 300 });

  // 5. Flash the test case indicator green
  setTestResults(prev => ({
    ...prev,
    [testIndex]: { status: 'passed', flash: true }
  }));
}
```

**Sound Design Palette:**

| Event | Sound | Duration | Notes |
|-------|-------|----------|-------|
| Test case pass | Bright chime | 200ms | Pitch increases with consecutive passes |
| Full solve | Triumphant fanfare | 800ms | Stereo pan based on problem position |
| Lockout claim | Lock click + whoosh | 400ms | Opponent hears a "stolen" variant |
| Elimination (BR) | Dramatic bass drop | 600ms | Only for eliminated player |
| Timer warning (30s) | Ticking clock | Looping | Increases tempo at 10s |
| Match found | Queue pop notification | 500ms | Plays even if tab is backgrounded |

### 4.3 Monaco Editor Integration

```typescript
// components/editor/GameEditor.tsx
const GameEditor = ({ matchId, problemId }: Props) => {
  const { code, setCode, language } = useEditorStore();
  const { submit } = useMatchActions(matchId);

  return (
    <div className="relative">
      <MonacoEditor
        language={language}
        value={code}
        onChange={setCode}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          // Class-specific enhancements injected here
          ...getClassEditorOptions(userClass),
        }}
      />

      {/* Floating submit button with keyboard shortcut */}
      <SubmitButton
        onSubmit={() => submit(problemId, code, language)}
        shortcut="Ctrl+Enter"
      />

      {/* Real-time test case results panel */}
      <TestResultsPanel matchId={matchId} problemId={problemId} />
    </div>
  );
};
```

---

## 5. Scaling Strategy

### 5.1 Horizontal Scaling Plan

```
                    ┌─────────────┐
                    │   Clients   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Nginx LB   │
                    │  (sticky    │
                    │   sessions) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐┌────▼─────┐┌────▼─────┐
        │  API + WS  ││  API + WS ││  API + WS │
        │ Instance 1 ││ Instance 2 ││ Instance 3│
        └─────┬──────┘└────┬──────┘└────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │ Redis Cluster│
                    │ (Pub/Sub +   │
                    │  State)      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL  │
                    │  (Primary +  │
                    │   Read       │
                    │   Replicas)  │
                    └─────────────┘
```

**Key Scaling Decisions:**

1. **Socket.io Redis Adapter** — All WS instances share rooms via Redis Pub/Sub. A player on Instance 1 and their opponent on Instance 3 communicate seamlessly.
2. **Sticky Sessions** — Required for Socket.io's HTTP long-polling fallback. Nginx uses `ip_hash` or cookie-based affinity.
3. **Judge Worker Pool** — Judge instances scale independently. Each worker pulls from the BullMQ queue. Scale based on queue depth.
4. **Read Replicas** — Leaderboards and problem browsing hit read replicas. Writes (ELO updates, submissions) go to primary.

### 5.2 Latency Budget

For a competitive game, every millisecond matters. Target latency budget for a code submission round-trip:

| Step | Target | Notes |
|------|--------|-------|
| Client → WS Gateway | 20ms | Depends on user's network |
| WS Gateway → BullMQ | 2ms | Redis LPUSH |
| BullMQ → Judge Worker | 5ms | Redis BRPOP |
| Container Spawn | 50ms | Pre-warmed container pool |
| Compilation | 500ms | C++ worst case |
| Execution (per test) | 100ms | Typical for easy/medium |
| Result → WS Gateway | 5ms | Redis Pub/Sub |
| WS Gateway → Client | 20ms | WebSocket push |
| **Total** | **~700ms** | **For a single test case** |

**Optimization: Pre-warmed Container Pool**
Instead of spawning a new Docker container per submission, maintain a pool of idle containers. When a submission arrives, claim an idle container, mount the code, execute, then return it to the pool. This eliminates the 50ms+ container startup overhead.

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐
│ Client │────▶│  Auth   │────▶│ PostgreSQL│
│        │     │ Service │     │ (users)  │
│        │◀────│         │◀────│          │
└────────┘     └─────────┘     └──────────┘
    │               │
    │  JWT (access) │  JWT contains:
    │  + HttpOnly   │  - userId
    │    cookie     │  - username
    │  (refresh)    │  - class
    │               │  - exp (15 min)
    ▼               │
┌────────┐          │
│ WS     │──────────┘  WS handshake sends
│ Gateway│             JWT in auth header
└────────┘
```

- **Access Token:** Short-lived JWT (15 min), sent in `Authorization` header.
- **Refresh Token:** HttpOnly cookie, 7-day expiry, rotated on use.
- **WS Auth:** JWT validated during Socket.io handshake middleware. Invalid token = connection rejected.
- **OAuth:** GitHub + Google OAuth2 for frictionless signup.

### 6.2 Anti-Cheat Measures

| Threat | Mitigation |
|--------|-----------|
| **Shared solutions** | Plagiarism detection (MOSS-like token comparison) on submissions |
| **Bot accounts** | CAPTCHA on registration, behavioral analysis on submission patterns |
| **Timing manipulation** | Server-authoritative timers; client timer is cosmetic only |
| **Code injection in Sabotage** | AST-level validation: sabotaged code must parse without syntax errors |
| **Collusion in matchmaking** | Detect repeated pairings between same users; flag for review |
| **WebSocket flooding** | Per-event rate limiting (max 1 submit/2s, max 10 messages/10s) |

---

## 7. Monitoring & Observability

| Tool | Purpose |
|------|---------|
| **Prometheus + Grafana** | System metrics (CPU, memory, WS connections, queue depth) |
| **Sentry** | Error tracking (frontend + backend) |
| **OpenTelemetry** | Distributed tracing (submission → judge → verdict pipeline) |
| **Custom Dashboard** | Match analytics (avg match duration, mode popularity, ELO distribution) |

**Key Metrics to Track:**

- `ws_connections_active` — Current WebSocket connections
- `match_queue_depth` — Players waiting in matchmaking
- `judge_queue_depth` — Submissions awaiting execution
- `judge_execution_p99` — 99th percentile execution time
- `match_completion_rate` — % of matches that complete without disconnection
- `elo_calculation_drift` — Detect ELO inflation/deflation over time
