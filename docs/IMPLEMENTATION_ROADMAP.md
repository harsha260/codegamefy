# 🗺️ Implementation Roadmap — CodeArena

## Overview

The build is divided into **4 phases** spanning approximately **6 months** for a small team (2-3 engineers). Each phase produces a deployable, testable increment.

```
Phase 0: Foundation (Weeks 1-3)     → Monorepo, DB, Auth, basic UI shell
Phase 1: MVP (Weeks 4-8)           → 1v1 Blitz mode, Judge, basic ELO
Phase 2: Beta (Weeks 9-14)         → All game modes, Clans, Spectator
Phase 3: V1 Launch (Weeks 15-20)   → Polish, Battle Royale, anti-cheat
Phase 4: Post-Launch (Ongoing)     → Mobile, tournaments, community
```

---

## Phase 0 — Foundation (Weeks 1–3)

**Goal:** Establish the monorepo, infrastructure, and core plumbing. No game features yet.

### Week 1: Project Scaffolding

| Task | Details |
|------|---------|
| Initialize Turborepo + pnpm workspace | `apps/web`, `apps/api`, `apps/judge`, `packages/shared` |
| Configure TypeScript (base + per-app) | Strict mode, path aliases, shared `tsconfig.base.json` |
| Set up ESLint + Prettier | Shared config in `packages/eslint-config` |
| Docker Compose for local dev | PostgreSQL 16, Redis 7, Adminer (DB GUI) |
| CI pipeline (GitHub Actions) | Lint → Type-check → Test → Build on every PR |

### Week 2: Database & Auth

| Task | Details |
|------|---------|
| Prisma schema (initial) | `User`, `EloRating` models only |
| Auth module | JWT access/refresh tokens, password hashing (argon2) |
| OAuth integration | GitHub + Google OAuth2 via Passport.js |
| User registration/login API | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` |
| Auth middleware | JWT verification for REST + WebSocket |

### Week 3: Frontend Shell

| Task | Details |
|------|---------|
| Next.js App Router setup | Layout with sidebar, top nav, auth-gated routes |
| Tailwind + Shadcn/ui | Install component primitives (Button, Dialog, Input, etc.) |
| Auth pages | Login, Register, OAuth callback |
| User profile page (skeleton) | Display username, avatar, placeholder skill polygon |
| Zustand stores | `userStore` (auth state), `uiStore` (theme, modals) |

**Phase 0 Deliverable:** A user can register, log in, and see their empty profile page. Infrastructure is running locally.

---

## Phase 1 — MVP: 1v1 Blitz Mode (Weeks 4–8)

**Goal:** One fully playable game mode end-to-end. This is the core product validation.

### Week 4: Problem System

| Task | Details |
|------|---------|
| Problem model + CRUD API | `POST/GET/PUT /problems` (admin-only create/edit) |
| Test case model | Linked to problems, sample vs. hidden |
| Problem browser page | List with filters (difficulty, category, tags) |
| Problem detail page | Markdown rendering, sample test cases, constraints |
| Seed 20-30 problems | Mix of Easy/Medium/Hard across all categories |

### Week 5: Judge Service (Core)

| Task | Details |
|------|---------|
| Docker-based executor | Spawn container, mount code, execute, capture stdout/stderr |
| Language configs | C++17, Python 3.11, JavaScript (Node 20), Java 21 |
| Security hardening | seccomp profile, cgroups limits, `--network=none`, PID limit |
| Output validator | Exact match, whitespace-tolerant match |
| BullMQ integration | API enqueues job → Judge worker processes → result published to Redis |
| Practice submission flow | User submits code on problem page → sees verdict |

### Week 6: WebSocket Infrastructure

| Task | Details |
|------|---------|
| Socket.io server setup | Namespaces: `/lobby`, `/match` |
| Redis adapter | `@socket.io/redis-adapter` for horizontal scaling readiness |
| WS auth middleware | JWT validation on handshake |
| Client socket hook | `useSocket()` — auto-connect, reconnect, event typing |
| Connection state UI | "Connected" / "Reconnecting" indicator |

### Week 7: Matchmaking + Match Lifecycle

| Task | Details |
|------|---------|
| Matchmaking queue | Redis Sorted Set keyed by composite ELO |
| Matchmaker worker | Runs every 2s, pairs players within ±150 ELO |
| ELO expansion logic | Range widens by 50 every 10s after 30s wait |
| Match creation | Select 5 problems, create `Match` + `MatchProblem` records |
| Match state in Redis | Hash with players, scores, problem lock status |
| "Find Match" UI | Queue button, estimated wait time, cancel |

### Week 8: Blitz Mode Gameplay

| Task | Details |
|------|---------|
| Match page UI | Split view: problem list (left), editor (right), scoreboard (top) |
| Monaco Editor integration | Language selector, submit button (Ctrl+Enter) |
| In-match submission flow | Submit → WS → Judge → verdict → WS broadcast |
| Lockout mechanic | First accepted submission locks the problem; server validates atomically |
| Score calculation | Points per problem based on difficulty |
| Match timer | Server-authoritative, synced via `match:tick` events |
| Match end flow | Timer expires → calculate winner → update ELO → show results |
| Basic Glicko-2 | Update Speed + Algorithms dimensions based on match result |
| Results page | Winner announcement, ELO change display, problem-by-problem breakdown |

**Phase 1 Deliverable:** Two users can queue for a 1v1 Blitz match, solve problems in a live editor, see real-time lockouts, and receive ELO updates. The core game loop is complete.

---

## Phase 2 — Beta: All Modes + Social (Weeks 9–14)

**Goal:** Expand to all game modes, add social features, and implement the "game feel."

### Week 9: Code Golf Mode

| Task | Details |
|------|---------|
| Code Golf problem set | 10+ problems with Code Golf flag |
| Scoring by code length | `codeLength` field on Submission, shortest wins |
| Multiplayer lobby (2-8 players) | Shared problem, real-time leaderboard by code length |
| Live character count display | Updates as user types |
| Mode-specific UI | Minimalist editor, no autocomplete (optional toggle) |

### Week 10: Sabotage & Debug Mode

| Task | Details |
|------|---------|
| Sabotage problem set | 10+ problems with `sabotageCode` (working solutions) |
| Phase 1 UI (Sabotage) | Player A sees working code, can edit for 60s |
| AST validation | Sabotaged code must still parse (no syntax errors allowed) |
| Diff tracking | Record exact changes made by saboteur |
| Phase 2 UI (Debug) | Player B sees sabotaged code, must fix it |
| Scoring | Time-based: faster debug = more points for debugger; longer survival = more points for saboteur |
| Role swap | After round 1, players swap roles for round 2 |

### Week 11: Clan System

| Task | Details |
|------|---------|
| Clan CRUD API | Create, join, leave, invite, kick |
| Clan page UI | Member list, weekly leaderboard, clan stats |
| Weekly score aggregation | Cron job: sum member match scores → clan weekly score |
| Clan leaderboard page | Global ranking of clans by weekly score |
| Clan tag display | Show `[TAG]` prefix on usernames in matches |

### Week 12: Spectator Mode

| Task | Details |
|------|---------|
| `/spectate` namespace | Read-only WS connection to match room |
| Spectator UI | View both players' code (syntax highlighted), scoreboard, timer |
| Live code streaming | Debounced code diffs sent every 500ms (not every keystroke) |
| Spectator count | Display viewer count on match |
| "Watch" button on leaderboard | Link to spectate top-rated active matches |

### Week 13: Game Feel & Visual Polish

| Task | Details |
|------|---------|
| Framer Motion animations | Page transitions, score counter springs, card hover effects |
| Particle effects (tsParticles) | Confetti on solve, sparks on lockout claim |
| Sound effects (Howler.js) | Test pass chime, solve fanfare, lockout click, timer warning |
| Screen shake | On accepted submission (subtle, 300ms) |
| Skill Polygon visualization | Radar chart (Recharts or D3) on profile page |
| Class selection UI | Choose class on first login, display class icon on profile |
| Class perks (visual only) | Architect: pattern highlights; Bug Hunter: error highlights in editor |

### Week 14: ELO Polish & Leaderboards

| Task | Details |
|------|---------|
| Full Glicko-2 across all dimensions | Each mode updates correct dimensions per mapping table |
| ELO history graph | Line chart on profile showing rating over time per dimension |
| Global leaderboard | Sortable by composite or individual dimension |
| Rank titles | "Bronze" (0-1200), "Silver" (1200-1500), "Gold" (1500-1800), "Platinum" (1800-2100), "Diamond" (2100-2400), "Grandmaster" (2400+) |
| Rank badges | Visual badges on profile and in-match |

**Phase 2 Deliverable:** All 4 game modes playable. Clans, spectating, leaderboards, and full game feel with animations/sounds. Ready for closed beta testing.

---

## Phase 3 — V1 Launch: Battle Royale + Hardening (Weeks 15–20)

**Goal:** Battle Royale (the most complex mode), anti-cheat, performance optimization, and launch readiness.

### Week 15: Battle Royale Mode

| Task | Details |
|------|---------|
| Scheduled event system | Admin creates BR events with start time, displayed on homepage |
| Large lobby (up to 100 players) | Join queue before event starts |
| Elimination rounds | Every 10 min, bottom 10% by score are eliminated |
| Progressive difficulty | New problems unlock each round, increasing in difficulty |
| Elimination broadcast | `match:eliminate` event with dramatic UI for eliminated players |
| Survival scoring | Points for each round survived + problems solved |
| BR-specific leaderboard | Live standings visible to all participants |

### Week 16: Battle Royale Polish

| Task | Details |
|------|---------|
| Spectator mode for BR | Watch the entire field, filter by player |
| Elimination animations | Player cards fade out, dramatic sound effect |
| Round transition UI | Countdown between rounds, new problems revealed |
| BR results page | Final standings, ELO changes, highlight reel |

### Week 17: Anti-Cheat & Security

| Task | Details |
|------|---------|
| Plagiarism detection | Token-based code similarity (MOSS algorithm) on all submissions |
| Submission rate limiting | Max 1 submission per 2 seconds per user per problem |
| Behavioral analysis | Flag accounts with suspiciously fast solve times |
| Collusion detection | Alert on repeated pairings between same users |
| Report system | Users can report suspicious behavior; admin review queue |
| Judge hardening | Fuzz testing the sandbox with malicious inputs |

### Week 18: Performance Optimization

| Task | Details |
|------|---------|
| Pre-warmed container pool | Maintain 10-20 idle containers, claim on submission |
| Redis connection pooling | Optimize connection reuse across workers |
| Database query optimization | EXPLAIN ANALYZE on all critical queries, add missing indexes |
| WebSocket message batching | Batch multiple events into single frames where possible |
| CDN optimization | Static assets on Cloudflare, aggressive caching headers |
| Load testing | Simulate 500 concurrent matches with k6 or Artillery |

### Week 19: Admin Panel & Content Tools

| Task | Details |
|------|---------|
| Admin dashboard | User management, match monitoring, problem CRUD |
| Problem editor | Markdown editor with live preview, test case management |
| Match replay system | Store match events, allow replay viewing |
| Analytics dashboard | DAU, match counts, mode popularity, ELO distribution charts |

### Week 20: Launch Preparation

| Task | Details |
|------|---------|
| Landing page | Marketing page with feature highlights, demo video |
| Onboarding flow | Tutorial match against bot, class selection, first problem |
| Email notifications | Match invites, clan invites, weekly digest |
| Error monitoring | Sentry integration (frontend + backend) |
| Documentation | API docs (Swagger), user guide, FAQ |
| Deployment | Production K8s cluster, CI/CD pipeline, monitoring dashboards |

**Phase 3 Deliverable:** Production-ready V1 with all modes, anti-cheat, admin tools, and performance validated under load. Ready for public launch.

---

## Phase 4 — Post-Launch (Ongoing)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Mobile responsive** | High | Optimize match UI for tablet; spectator for mobile |
| **Tournament system** | High | Bracket-style tournaments with registration, seeding, prizes |
| **Custom matches** | Medium | Create private rooms with custom rules |
| **Problem contributions** | Medium | Community-submitted problems with review pipeline |
| **Replay system** | Medium | Watch past matches with playback controls |
| **Achievement system** | Medium | Badges for milestones (100 solves, first BR win, etc.) |
| **API for integrations** | Low | Public API for third-party tools, Discord bots |
| **Native mobile app** | Low | React Native wrapper for push notifications + quick matches |
| **AI opponent** | Low | Practice mode against GPT-powered bot at adjustable difficulty |
| **Localization** | Low | i18n for problem descriptions and UI |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Judge sandbox escape | Low | Critical | Regular security audits, Firecracker microVMs as fallback |
| WebSocket scaling bottleneck | Medium | High | Redis adapter from day 1, load test at Phase 3 |
| ELO inflation/deflation | Medium | Medium | Monitor distribution weekly, adjust Glicko-2 τ parameter |
| Low initial player count | High | High | Bot opponents for matchmaking, async modes (practice) |
| Cheating undermines trust | Medium | Critical | Plagiarism detection + behavioral analysis from V1 |
| Judge queue backlog during BR | Medium | High | Auto-scale judge workers based on queue depth |

---

## Team Allocation (3-Person Team)

| Engineer | Phase 0-1 Focus | Phase 2-3 Focus |
|----------|----------------|-----------------|
| **Engineer A (Full-Stack Lead)** | Auth, API, WebSocket gateway, matchmaking | Battle Royale, anti-cheat, admin panel |
| **Engineer B (Frontend + Game Feel)** | Next.js shell, match UI, Monaco integration | All game mode UIs, animations, sounds, spectator |
| **Engineer C (Backend + Infra)** | Judge service, Docker sandbox, Redis state | Performance optimization, K8s, monitoring, load testing |
