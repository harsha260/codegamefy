# ⚔️ CodeArena — Competitive Programming as a Game

> **"Coding is a Game, not a Grind."**

CodeArena is a real-time competitive programming platform that transforms algorithmic problem-solving into a visceral, game-like experience. Think **Chess.com meets Overwatch** — with ELO ratings, RPG classes, sabotage modes, and Battle Royale elimination rounds.

---

## 📁 Monorepo Structure

```
codearena/
├── apps/
│   ├── web/                          # Next.js 14 Frontend (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/               # Auth routes (login, register, OAuth)
│   │   │   ├── (dashboard)/          # Main dashboard, profile, settings
│   │   │   ├── (game)/               # Game lobby, match UI, spectator
│   │   │   │   ├── lobby/
│   │   │   │   ├── match/[matchId]/
│   │   │   │   ├── spectate/[matchId]/
│   │   │   │   └── results/[matchId]/
│   │   │   ├── (social)/             # Clans, leaderboards, friends
│   │   │   ├── problems/             # Problem browser & editor
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # Shadcn/Radix primitives
│   │   │   ├── editor/               # Monaco Editor wrapper
│   │   │   ├── game/                 # Match HUD, timer, scoreboard
│   │   │   ├── effects/              # Particle systems, screen shake, sounds
│   │   │   └── social/               # Clan cards, spectator overlay
│   │   ├── hooks/                    # Custom React hooks (useSocket, useMatch, useElo)
│   │   ├── lib/
│   │   │   ├── socket.ts             # Socket.io client singleton
│   │   │   ├── api.ts                # REST API client (tRPC or fetch)
│   │   │   └── audio.ts              # Sound effect manager (Howler.js)
│   │   ├── stores/                   # Zustand stores (matchStore, userStore)
│   │   ├── styles/                   # Tailwind config, global CSS
│   │   ├── public/
│   │   │   ├── sounds/               # SFX assets (.mp3/.ogg)
│   │   │   └── particles/            # Particle sprite sheets
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── api/                          # Node.js/Express Backend (REST + WS)
│   │   ├── src/
│   │   │   ├── config/               # Environment, DB, Redis config
│   │   │   ├── middleware/            # Auth (JWT), rate-limit, CORS
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Registration, login, OAuth, JWT
│   │   │   │   ├── user/             # Profile, settings, skill polygon
│   │   │   │   ├── problem/          # CRUD, tagging, difficulty
│   │   │   │   ├── submission/       # Code submission, result polling
│   │   │   │   ├── match/            # Match lifecycle, scoring
│   │   │   │   ├── matchmaking/      # Queue, ELO-based pairing
│   │   │   │   ├── elo/              # Glicko-2 calculation engine
│   │   │   │   ├── clan/             # Guild CRUD, weekly leaderboards
│   │   │   │   ├── spectator/        # Spectator room management
│   │   │   │   └── sabotage/         # Sabotage & Debug mode logic
│   │   │   ├── ws/                   # WebSocket gateway
│   │   │   │   ├── index.ts          # Socket.io server bootstrap
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── matchHandler.ts
│   │   │   │   │   ├── lobbyHandler.ts
│   │   │   │   │   ├── spectatorHandler.ts
│   │   │   │   │   └── chatHandler.ts
│   │   │   │   └── middleware/        # WS auth, rate limiting
│   │   │   ├── jobs/                 # Bull/BullMQ job queues
│   │   │   │   ├── judgeQueue.ts     # Code execution dispatch
│   │   │   │   ├── eloQueue.ts       # Async ELO recalculation
│   │   │   │   └── cleanupQueue.ts   # Stale match cleanup
│   │   │   ├── utils/
│   │   │   └── app.ts                # Express app entry
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Prisma ORM schema
│   │   │   └── migrations/
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── judge/                        # Sandboxed Code Execution Service
│       ├── src/
│       │   ├── executor.ts           # Container orchestration (Docker API)
│       │   ├── sandbox.ts            # Isolation config (cgroups, seccomp)
│       │   ├── languages/            # Per-language compile/run configs
│       │   │   ├── python.ts
│       │   │   ├── cpp.ts
│       │   │   ├── java.ts
│       │   │   ├── javascript.ts
│       │   │   └── go.ts
│       │   ├── validator.ts          # Output comparison (exact, float, special)
│       │   └── server.ts             # gRPC or HTTP server for judge requests
│       ├── docker/
│       │   ├── Dockerfile.runner     # Minimal runner image
│       │   └── seccomp-profile.json  # Syscall whitelist
│       ├── tests/
│       └── package.json
│
├── packages/
│   ├── shared/                       # Shared types, constants, utils
│   │   ├── src/
│   │   │   ├── types/                # TypeScript interfaces (User, Match, Problem)
│   │   │   ├── constants/            # Game modes, ELO defaults, time limits
│   │   │   ├── validators/           # Zod schemas for API payloads
│   │   │   └── elo/                  # Glicko-2 pure math implementation
│   │   └── package.json
│   │
│   ├── ui/                           # Shared UI component library
│   │   ├── src/
│   │   └── package.json
│   │
│   └── eslint-config/                # Shared ESLint config
│       └── package.json
│
├── infra/                            # Infrastructure as Code
│   ├── docker-compose.yml            # Local dev (Postgres, Redis, Judge)
│   ├── docker-compose.prod.yml
│   ├── k8s/                          # Kubernetes manifests
│   │   ├── api-deployment.yaml
│   │   ├── judge-deployment.yaml
│   │   ├── redis-statefulset.yaml
│   │   └── ingress.yaml
│   └── terraform/                    # Cloud provisioning (optional)
│
├── docs/
│   ├── ARCHITECTURE.md               # System architecture & tech stack
│   ├── DATABASE_SCHEMA.md            # ER diagram & data models
│   ├── IMPLEMENTATION_ROADMAP.md     # Phased build plan
│   ├── EDGE_CASES.md                 # Race conditions, pitfalls
│   └── GAME_DESIGN.md                # Game mechanics deep-dive
│
├── turbo.json                        # Turborepo pipeline config
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
└── tsconfig.base.json
```

---

## 🏗️ Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind + Framer Motion | SSR for SEO, App Router for layouts, Framer for "juicy" animations |
| State | Zustand + React Query | Lightweight client state + server cache |
| Editor | Monaco Editor | VS Code-grade editing in-browser |
| Audio/VFX | Howler.js + tsParticles | Low-latency SFX, GPU-accelerated particles |
| Backend | Node.js + Express + Socket.io | Mature WS ecosystem, shared TS types |
| ORM | Prisma | Type-safe DB access, migration tooling |
| Database | PostgreSQL 16 | ACID for ELO, match history, relational integrity |
| Cache/Pub-Sub | Redis 7 (Streams + Pub/Sub) | Live match state, matchmaking queue, WS scaling |
| Job Queue | BullMQ (Redis-backed) | Async judge dispatch, ELO recalc |
| Judge | Custom (Docker API + seccomp) | Full isolation, per-language resource limits |
| Monorepo | Turborepo + pnpm | Fast builds, shared packages |
| CI/CD | GitHub Actions | Lint → Test → Build → Deploy pipeline |
| Infra | Docker Compose (dev) / K8s (prod) | Local parity, horizontal scaling |

---

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design, component interactions, latency optimization
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Full ER diagram, Prisma models, Glicko-2 logic
- [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) — MVP → Beta → V1 phased plan
- [`docs/EDGE_CASES.md`](docs/EDGE_CASES.md) — Race conditions, security, failure modes
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — Game mechanics, class system, scoring

---

## 🚀 Quick Start (Local Dev)

```bash
# Clone & install
git clone https://github.com/your-org/codearena.git
cd codearena
pnpm install

# Start infrastructure
docker compose up -d  # Postgres, Redis, Judge runner

# Run migrations
pnpm --filter api prisma migrate dev

# Start all apps
pnpm dev
```

---

## License

MIT
