# 🎮 Game Design Document — CodeArena

## 1. Design Philosophy

### Core Pillars

1. **Competitive Clarity** — Every match outcome must feel fair and understandable. No hidden mechanics.
2. **Juicy Feedback** — Every action produces satisfying visual/audio feedback. The UI should feel alive.
3. **Skill Expression** — Multiple dimensions of skill (speed, accuracy, creativity, debugging) are measured and rewarded independently.
4. **Social Pressure** — Leaderboards, clans, spectators, and rank titles create aspirational goals.

### Anti-Patterns to Avoid

| Platform | Problem | Our Solution |
|----------|---------|-------------|
| LeetCode | Feels like an exam — no real-time competition | Real-time multiplayer with live opponents |
| Codeforces | Academic UI, intimidating for newcomers | Game-like UI with onboarding, classes, visual rank |
| HackerRank | Slow feedback, no spectator engagement | Sub-second verdict delivery, spectator mode |
| CodeWars | No competitive structure, just kata grinding | Structured ELO, seasons, clan competitions |

---

## 2. The Skill Polygon (Split ELO)

### 2.1 Four Dimensions

```
            Algorithms
               ▲
              /|\
             / | \
            /  |  \
           /   |   \
    Speed ◄────┼────► Debugging
           \   |   /
            \  |  /
             \ | /
              \|/
               ▼
          Optimization
```

Each dimension is an independent Glicko-2 rating (default 1500, RD 350).

| Dimension | What It Measures | Primary Modes |
|-----------|-----------------|---------------|
| **Algorithms** | Problem-solving ability, DSA knowledge | Blitz 1v1, Battle Royale |
| **Debugging** | Bug detection, code reading, fix speed | Sabotage & Debug |
| **Optimization** | Code efficiency, brevity, resource usage | Code Golf |
| **Speed** | Raw solving speed under time pressure | Blitz 1v1, Battle Royale |

### 2.2 Composite Rating

Used for matchmaking and global leaderboard:

```
Composite = 0.35 × Algorithms + 0.25 × Speed + 0.20 × Debugging + 0.20 × Optimization
```

Algorithms is weighted highest because it's the foundational skill.

### 2.3 Rank Tiers

| Tier | Rating Range | Icon | Color |
|------|-------------|------|-------|
| Bronze | 0 – 1199 | 🥉 | `#CD7F32` |
| Silver | 1200 – 1499 | 🥈 | `#C0C0C0` |
| Gold | 1500 – 1799 | 🥇 | `#FFD700` |
| Platinum | 1800 – 2099 | 💎 | `#00CED1` |
| Diamond | 2100 – 2399 | 💠 | `#B9F2FF` |
| Master | 2400 – 2699 | ⚔️ | `#FF4500` |
| Grandmaster | 2700+ | 👑 | `#FF0000` |

Each tier has 3 subdivisions (e.g., Gold I, Gold II, Gold III) for granular progression feel.

---

## 3. The Class System (RPG Meta-Game)

### 3.1 Class Definitions

Classes provide **visual/UI perks only** — no competitive advantage. They enhance the player's experience based on their preferred playstyle.

| Class | Icon | Perk | Implementation |
|-------|------|------|---------------|
| **The Architect** | 🏛️ | Structural pattern highlighting | Monaco editor highlights common patterns (loops, recursion, DP tables) with subtle background colors |
| **The Bug Hunter** | 🐛 | Enhanced error visibility | Syntax errors get larger, more visible squiggles; runtime errors show inline annotations |
| **The Speedrunner** | ⚡ | Enhanced timer UI | Larger timer display, color-coded urgency zones, millisecond precision |
| **The Optimizer** | 📊 | Complexity hints | After submission, shows estimated time/space complexity alongside verdict |
| **The Saboteur** | 🗡️ | Extended sabotage phase | +10 seconds in Sabotage Phase 1 (visual timer extension, not a competitive advantage since scoring adjusts) |

### 3.2 Class Selection Flow

1. New user completes registration.
2. Plays a 5-problem "placement match" (solo, untimed).
3. Based on performance patterns, the system **suggests** a class (but user can choose any).
4. Class can be changed once per season (every 3 months).

### 3.3 Class Progression

Each class has 5 levels, unlocked by playing matches in modes aligned with that class:

| Level | Requirement | Reward |
|-------|------------|--------|
| 1 | Choose class | Base perk active |
| 2 | 10 matches | Custom profile border |
| 3 | 50 matches | Animated class icon |
| 4 | 200 matches | Exclusive title (e.g., "Master Architect") |
| 5 | 500 matches | Legendary profile effect (particle aura) |

---

## 4. Game Modes — Detailed Mechanics

### 4.1 Blitz 1v1 (Lockout)

```
┌─────────────────────────────────────────────┐
│  BLITZ 1v1 — Match Layout                   │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  Timer: 25:00    Score: You 300 | Opp 200│ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌──────────┐ ┌──────────────────────────┐  │
│  │ Problems │ │                          │  │
│  │          │ │     Monaco Editor         │  │
│  │ ■ P1 100│ │                          │  │
│  │ ■ P2 100│ │                          │  │
│  │ □ P3 200│ │                          │  │
│  │ □ P4 200│ │                          │  │
│  │ □ P5 400│ │                          │  │
│  │          │ │                          │  │
│  │ ■ = locked│ │                          │  │
│  │ □ = open │ │     [Submit Ctrl+Enter]  │  │
│  └──────────┘ └──────────────────────────┘  │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  Test Results: ✅ 1  ✅ 2  ❌ 3  ⬜ 4  │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Rules:**
- 5 problems of varying difficulty (2 Easy, 2 Medium, 1 Hard).
- Points: Easy = 100, Medium = 200, Hard = 400.
- First player to get `ACCEPTED` on a problem **locks** it — opponent can no longer submit for that problem.
- Match duration: 30 minutes.
- Winner: Highest total points. Tiebreaker: fewer total submissions.

**Lockout Animation:**
When a problem is locked by the opponent:
1. Problem card slides to opponent's side with a "LOCKED" stamp.
2. Lock sound effect plays.
3. Brief red flash on the problem list.
4. Points counter animates the opponent's score increase.

### 4.2 Code Golf

**Rules:**
- 1 problem, 2-8 players.
- Goal: Shortest code (by character count) that passes all test cases.
- Duration: 15 minutes.
- Players can submit multiple times; only their shortest accepted solution counts.
- Live leaderboard shows character counts (but not code) of all players.

**Scoring:**
```
1st place: 100 points
2nd place: 70 points
3rd place: 50 points
4th-8th: 30, 20, 15, 10, 5 points
```

**UI Feature:** Real-time character counter in the editor, color-coded:
- Green: Currently shortest
- Yellow: Within 20% of shortest
- Red: More than 20% longer than shortest

### 4.3 Battle Royale

**Rules:**
- Scheduled events (e.g., every Saturday at 8 PM).
- Up to 100 players.
- Starts with 3 Easy problems.
- Every 10 minutes, bottom 10% of players (by score) are eliminated.
- After each elimination round, 2 new problems are added (increasing difficulty).
- Last player standing wins.

**Elimination Mechanics:**
```
Round 1 (0-10 min):   3 Easy problems available.     Eliminate bottom 10%.
Round 2 (10-20 min):  +2 Medium problems.             Eliminate bottom 10%.
Round 3 (20-30 min):  +2 Medium problems.             Eliminate bottom 10%.
Round 4 (30-40 min):  +2 Hard problems.               Eliminate bottom 15%.
Round 5 (40-50 min):  +1 Hard problem.                Eliminate bottom 20%.
Round 6+ (50+ min):   +1 Extreme problem per round.   Eliminate bottom 25%.
```

**Tiebreaker for elimination:** If multiple players have the same score at the elimination threshold, the player with the most recent solve survives (rewarding active play over camping).

**Elimination Animation:**
1. Screen dims for eliminated player.
2. "ELIMINATED" text with rank placement (e.g., "42nd / 100").
3. Dramatic bass drop sound.
4. Transition to spectator mode (can watch remaining players).

### 4.4 Sabotage & Debug

**Phase 1 — Sabotage (60 seconds):**
- Player A receives a working solution to a problem.
- Player A must introduce 2-5 subtle bugs.
- Constraints:
  - Code must still compile/parse (no syntax errors).
  - Cannot change function signatures.
  - Cannot add/remove functions.
  - Cannot modify comments or whitespace only.
- Timer: 60 seconds (Saboteur class gets 70 seconds).

**Phase 2 — Debug (variable time):**
- Player B receives the sabotaged code + the problem statement.
- Player B must fix all bugs to make the code pass all test cases.
- Player B can submit as many times as needed.
- Timer: 5 minutes max.

**Scoring:**
```
Saboteur Score = (300 - debugTime) × bugDifficulty
  where debugTime = seconds until Player B fixes all bugs
  where bugDifficulty = 1.0 (easy bugs) to 2.0 (subtle bugs)
  
Debugger Score = max(0, 300 - debugTime × 2) + bonusForFewerSubmissions
```

**Bug Difficulty Assessment:**
After the match, the system analyzes the diff:
- **Easy bug (1.0x):** Changed a constant (e.g., `return n + 1` → `return n + 2`)
- **Medium bug (1.5x):** Off-by-one error, wrong comparison operator
- **Hard bug (2.0x):** Logic error in a nested condition, wrong variable in a loop

**Round 2:** Players swap roles. Total score across both rounds determines the winner.

---

## 5. Sound Design Specification

### 5.1 Sound Categories

| Category | Volume Default | User Configurable |
|----------|---------------|-------------------|
| **UI** (clicks, hovers) | 30% | Yes |
| **Game** (solves, lockouts) | 70% | Yes |
| **Ambient** (match background) | 20% | Yes |
| **Alerts** (timer, elimination) | 80% | Yes |
| **Master** | 50% | Yes |

### 5.2 Sound Asset List

| ID | Trigger | File | Duration |
|----|---------|------|----------|
| `ui_click` | Button click | `click.ogg` | 50ms |
| `ui_hover` | Button hover | `hover.ogg` | 30ms |
| `test_pass` | Single test case accepted | `chime_up.ogg` | 200ms |
| `test_fail` | Single test case failed | `buzz.ogg` | 150ms |
| `solve_complete` | All test cases passed | `fanfare.ogg` | 800ms |
| `lockout_claim` | You locked a problem | `lock_claim.ogg` | 400ms |
| `lockout_stolen` | Opponent locked a problem | `lock_stolen.ogg` | 400ms |
| `match_found` | Matchmaking complete | `queue_pop.ogg` | 500ms |
| `match_start` | Match countdown ends | `horn.ogg` | 600ms |
| `match_win` | You won the match | `victory.ogg` | 1500ms |
| `match_lose` | You lost the match | `defeat.ogg` | 1200ms |
| `timer_warning` | 30 seconds remaining | `tick.ogg` | Loop |
| `timer_critical` | 10 seconds remaining | `tick_fast.ogg` | Loop |
| `eliminate` | Eliminated from BR | `bass_drop.ogg` | 600ms |
| `rank_up` | ELO tier promotion | `rank_up.ogg` | 1000ms |
| `elo_gain` | ELO increased | `elo_up.ogg` | 300ms |
| `elo_loss` | ELO decreased | `elo_down.ogg` | 300ms |

### 5.3 Adaptive Audio

- **Test case pass pitch:** Each consecutive pass increases pitch by a semitone. A 5/5 clean sweep sounds like an ascending scale.
- **Timer urgency:** Background ambient shifts from calm to tense as time decreases.
- **Score momentum:** When a player is on a solving streak, a subtle "momentum" layer fades in.

---

## 6. Engagement Metrics to Track

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| **D1 Retention** | >40% | Do new users come back the next day? |
| **D7 Retention** | >20% | Are they forming a habit? |
| **Matches per session** | >2.5 | Is the "one more game" loop working? |
| **Queue abandon rate** | <15% | Is matchmaking fast enough? |
| **Match completion rate** | >90% | Are players finishing matches? |
| **Spectator conversion** | >5% | Do spectators start playing? |
| **Clan join rate** | >30% (of D7 users) | Is the social layer sticky? |
| **Mode diversity** | >2 modes per user/week | Are all modes engaging? |

---

## 7. Seasonal Content

Every **3 months**, a new "Season" launches:

| Season Element | Description |
|---------------|-------------|
| **ELO Soft Reset** | Composite rating moves 25% toward 1500. RD increases. |
| **New Problems** | 20+ new problems added to the pool. |
| **Season Pass** | Free track with cosmetic rewards (borders, titles, effects). |
| **Clan Season** | Clan leaderboard resets. Top 3 clans get exclusive banner. |
| **New Game Mode** (optional) | Experimental mode for the season (e.g., "Team 2v2"). |
| **Balance Patch** | Adjust ELO weights, scoring formulas based on data. |
