# Apex Minigolf 3D — Overall Implementation Plan

## 1. Executive Summary & Chosen Tech Stack

Based on your requirements (**maximum realistic 3D visuals**, **complex physics obstacles like jump pads, loops, ice tubes, and wind**, **desktop mouse + mobile touch**, and **single-player, bots, local multiplayer, and online multiplayer**), the optimal architecture is:

### Recommended Stack
- **3D Rendering Engine:** **Three.js (`three` `^0.186.0`)** + **Vite (`^8.3.7`)** + **TypeScript (`^5.x`)**
  - **Why:** Three.js provides industry-leading Physically Based Rendering (PBR), ACES Filmic tone mapping, HDR environment reflections (PMREM), soft PCF shadows, procedural sky/water shaders, and post-processing—essential for achieving a realistic look in the browser while staying lightweight enough for mobile touch devices.
- **3D Physics Engine:** **Rapier3D (`@dimforge/rapier3d-compat` `^0.20.0`)**
  - **Why:** Compiled from Rust to WebAssembly, Rapier3D provides deterministic, high-speed rigid-body simulation with **Continuous Collision Detection (CCD)** so fast golf shots never clip through thin ramps, moving gates, or loop-de-loops. It natively supports triggers/sensors (cup detection, jump pads, portals, wind zones, water hazards) and per-surface friction/restitution (ice, sand, turf, rubber bumpers).
- **UI & Mobile-Web HUD:** **Native HTML/CSS + TypeScript** (Apple-grade translucent HUD, spring-eased transitions, `touch-action: none` on canvas, `100dvh`, safe-area insets)
  - **Why:** Zero framework overhead on top of the 60 FPS WebGL/physics loop, ensuring crisp responsiveness on both desktop mice and mobile touchscreens.
- **Backend & Online Multiplayer:** **Python (`venv`) + FastAPI (`^0.141.x`) + Uvicorn (`uvicorn[standard]`) + WebSockets + SQLite (`aiosqlite`)**
  - **Why:** Clean separation between the 3D client and the real-time room/matchmaking/leaderboard server, managed inside an isolated Python virtual environment with `requirements.txt`.

---

## 2. Reference Venues, Obstacles & Mechanics Matrix

Inspired by **Miniclip's *Golf Battle*** and **CrazyGames' *Mini Golf Club***:

### 6 Signature Venues (6 Holes Each = 36 Holes + Elite Shuffle Mode)
| Venue | Visual Atmosphere & PBR Materials | Signature Mechanics & Hazards |
| :--- | :--- | :--- |
| **1. Pine Forest** | Lush sunlit woodland, procedural pine trees, timber bridges, dew-lit grass | Classic banked walls, wooden ramps, gentle elevation splits |
| **2. Rocky Mountains** | Arid desert canyon, layered red sandstone mesas, dry scrub | **Sand Bunkers** (heavy damping), cliffside gaps, **Crazy Loopings**, **Huge Slides & Big Jumps** |
| **3. Snowy Valley** | Alpine glaciers, snowdrifts, frozen pine peaks, crisp sunlight | **Low-Friction Ice Surfaces**, **Enclosed Ice Tubes** (high-speed chutes), snowbank cushions |
| **4. Mayan Jungle** | Dense rainforest, moss-covered carved stone ruins, ancient temples | **Water Hazards / Rivers** (penalty + reset), **Moving Stone Doors**, tight risk-reward shortcuts |
| **5. Windy Cliffs** | Dramatic coastal ocean cliffs, animated sea waves, lighthouse props | **Dynamic Wind Zones** (lateral/head/tail wind forces + HUD compass + wind flag/particles) |
| **6. Sakura Garden** | Blooming cherry blossom trees, falling petals, koi ponds, arched wooden bridges | **High-Restitution Bumper Walls**, narrow precision turns, calm water hazards |

### Complete Obstacle & Interactive Element Catalog
1. **Jump Pads / Launchers:** Glowing spring pads applying calibrated upward + forward impulse to clear chasms or reach upper tiers.
2. **Speed Boost Pads:** Directional chevron strips accelerating the ball up steep slopes or through loops.
3. **Crazy Loopings (Loop-de-Loops):** Curved 360° track geometry requiring sufficient shot power and CCD physics to traverse cleanly.
4. **Enclosed Tunnels & Cold Ice Tubes:** Curved half-pipe/tube colliders guiding the ball across long sections.
5. **Moving Obstacles:** Oscillating barrier walls, timed sliding temple doors, rotating windmill blades, and moving platforms.
6. **Bumper Walls & Pinball Bumpers:** High-restitution (`restitution > 1.0` impulse cap) surfaces for bank shots and ricochets.
7. **Paired Portals / Teleporters:** Linked entry/exit rings teleporting the ball while preserving or redirecting its exit velocity vector.
8. **Sand Bunkers & Water Hazards:** Material/sensor zones that either severely damp rolling velocity (sand) or trigger splash VFX + `+1` penalty stroke + reset to last safe lie (water).
9. **Wind Streams (Global & Localized):** Force fields applying wind drag to the ball (stronger while airborne), paired with animated wind streaks and a directional HUD indicator.

---

## 3. Target Project Structure

```text
minigolf-3d/
├── IMPLEMENTATION_PLAN.md
├── README.md
├── .gitignore
├── backend/
│   ├── venv/                     # Python virtual environment
│   ├── requirements.txt          # Pinned Python dependencies
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORSMiddleware, WebSocket routes
│   │   ├── models.py             # Pydantic schemas & SQLite models
│   │   ├── rooms.py              # Lobby, room codes, turn/race state sync
│   │   └── leaderboard.py        # Persistent scores & venue records
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── engine/               # Three.js renderer, PBR materials, HDRI, audio
│       ├── physics/              # Rapier3D world, CCD ball, surfaces, wind
│       ├── controls/             # Mouse + Mobile touch aiming & camera rig
│       ├── courses/              # Modular track builder + 36 hole definitions
│       ├── venues/               # 6 realistic environment themes & props
│       ├── modes/                # Solo, AI Bots, Local Multi, Online Multi
│       └── ui/                   # HUD, scorecard, wind compass, lobbies
```

---

## 4. Detailed Phase-by-Phase Implementation Plan

### Phase 0: Project Scaffolding, Virtual Environment & Git Setup
- **Goals:** Create the project skeleton, isolate Python dependencies, verify Node/TypeScript tooling, and prepare Git tracking.
- **Tasks:**
  1. Create `backend/venv` and initialize `backend/requirements.txt` (`fastapi[standard]`, `uvicorn[standard]`, `websockets`, `aiosqlite`, `pytest`).
  2. Initialize `frontend/` with Vite + TypeScript and install `three`, `@dimforge/rapier3d-compat`, and `@types/three`.
  3. Create `.gitignore` (excluding `venv/`, `node_modules/`, `.env`, `dist/`, `*.db`) and an initial `README.md`.
  4. Verify both servers start cleanly (`uvicorn` on `:8000` with `CORSMiddleware` configured, `vite` on `:5173`) and confirm `/health` connectivity.
- **Verification Gate:** Local dev servers boot with zero errors; ready for user testing before GitHub push.

### Phase 1: Realistic 3D Rendering Core, Rapier Physics & Dual Input Controls
- **Goals:** Build the core playable golf loop on a realistic test green with full PBR lighting and desktop + mobile controls.
- **Tasks:**
  1. **Realistic PBR Engine:** WebGL2 renderer with ACES Filmic tone mapping, soft PCF shadows, procedural environment cubemap (`PMREMGenerator`), normal/roughness-mapped turf, dimpled clearcoat golf ball, and wooden/stone border trims.
  2. **Rapier3D Ball Physics:** Fixed-timestep (`1/60s` or `1/120s` substeps) simulation with CCD enabled on the golf ball, realistic rolling friction, angular damping, spin deceleration, and rest-state detection.
  3. **Input & Camera System:**
     - **Desktop:** Click-and-drag backward from ball to aim & set power (with predictive bounce dotted trajectory line), right-click drag to orbit camera, scroll wheel to zoom, `R` to reset camera.
     - **Mobile Touch:** Single-finger drag-back aiming (`touch-action: none`), two-finger drag to orbit / pinch to zoom, cancel-shot zone when dragging back to ball center.
  4. **Cup Detection & Audio:** Velocity-gated hole trigger (ball drops into physical cup when below max capture speed), procedural Web Audio API sound effects (putt hit, wood bounce, cup drop).
- **Verification Gate:** Playable single-hole prototype testable on desktop mouse and mobile touch emulation.

### Phase 2: Modular Course Builder, All Obstacles & Wind Physics
- **Goals:** Build the reusable modular track compiler and implement every obstacle type from Golf Battle & Mini Golf Club.
- **Tasks:**
  1. **Data-Driven Track Builder:** JSON/TypeScript course schema generating watertight visual + physics geometry (straight lanes, curves, banked corners, slopes, ramps, split paths, bridges, elevation tiers).
  2. **Obstacle Implementations:**
     - Jump pads (impulse triggers + spring animation) & speed boost pads.
     - Moving walls, timed temple doors, and rotating windmill blades (kinematic Rapier rigid bodies).
     - High-restitution bumper walls & round pinball bumpers.
     - Loop-de-loops (`Crazy Loopings`) & curved tube chutes (`Ice Tubes`).
     - Paired teleporter portals with cooldown guard.
     - Sand bunkers (high damping) & water hazards (splash particle burst + `+1` penalty + reset to last lie).
  3. **Wind Simulation:** Per-hole global wind vector + localized wind fan zones applying realistic aerodynamic drag force, plus animated 3D wind streaks, cup flag flutter, and a HUD wind compass.
- **Verification Gate:** Obstacle showcase test track exercising every obstacle type + wind without ball tunneling or physics glitches.

### Phase 3: The 6 Signature Venues & 36-Hole Campaign
- **Goals:** Author realistic thematic environments and build all 36 holes (6 per venue) plus an Elite Shuffle playlist.
- **Tasks:**
  1. Build environment generators (lighting, sky/fog, instanced foliage/rocks/buildings, animated water shaders, falling snow/sakura particles) for all 6 venues: *Pine Forest*, *Rocky Mountains*, *Snowy Valley*, *Mayan Jungle*, *Windy Cliffs*, and *Sakura Garden*.
  2. Design, balance, and par-calibrate **36 distinct holes** ensuring each venue highlights its signature obstacles and increasing difficulty.
  3. Add Venue Selector, Hole Preview flyover camera, and Elite Mix mode (randomized multi-venue tournament).
- **Verification Gate:** All 36 holes load cleanly, are completable under par/par+3, and maintain smooth FPS across desktop and mobile quality presets.

### Phase 4: Game Modes — Solo, Smart AI Bots & Local Multiplayer
- **Goals:** Deliver all offline/local game modes with complete scorecards and polished transitions.
- **Tasks:**
  1. **Single Player (Solo):** Full 6-hole venue cups, 36-hole Grand Tour, and Free Practice hole picker with local personal-best persistence.
  2. **Single Player vs. AI Bots:** 1–3 AI opponents with selectable skill tiers (*Rookie*, *Pro*, *Master*). Bots evaluate pathfinding waypoints, bank angles, obstacle timing, and wind compensation, and physically execute putts on the 3D course.
  3. **Local Pass-and-Play (Hot-Seat):** 2–4 local players with customizable ball colors/names, turn indicator banners, live multi-player scorecard, and automatic furthest-from-hole turn ordering.
- **Verification Gate:** Complete a 6-hole match in Solo, vs. Bots, and 2-player Pass-and-Play with accurate stroke counting and winner podium.

### Phase 5: Python FastAPI Backend & Online Multiplayer
- **Goals:** Implement real-time online multiplayer and persistent global leaderboards.
- **Tasks:**
  1. **FastAPI REST & WebSocket Server:** Room creation with 6-character join codes, public matchmaking queue, player ready states, and server-authoritative match lifecycle.
  2. **Real-Time State Sync:** Synchronized obstacle/wind seeds, ball position/velocity streaming with client-side interpolation, ghost-ball rendering for opponents, and both **Turn-Based** and **Simultaneous Race** (Golf Battle style) online modes.
  3. **Leaderboards & Profiles:** SQLite-backed venue records, hole-in-one stats, and ELO/win tracking via REST endpoints.
  4. **Reconnect & Edge-Case Handling:** Graceful disconnect recovery, host migration, and shot timer enforcement.
- **Verification Gate:** Two browser clients connect via WebSockets to the FastAPI server, play a synchronized multi-hole online match, and record scores to the leaderboard.

### Phase 6: Realism Polish, Mobile Optimization & Production Readiness
- **Goals:** Maximize visual polish, cross-device ergonomics, automated test coverage, and documentation.
- **Tasks:**
  1. **Graphics Quality Presets:** Auto-detect + manual toggle (*Low / Medium / High / Ultra*) adjusting shadow resolution, pixel ratio, particle count, and post-processing bloom/FXAA.
  2. **Apple-Grade UI Polish:** Glassmorphic translucent HUD cards, smooth spring animations, mobile safe-area padding, vibration feedback on putt/cup (where supported), and reduced-motion support.
  3. **Testing & Final Docs:** Automated backend `pytest` suite, frontend build & physics sanity tests, complete `README.md` with setup/play/deploy instructions.
- **Verification Gate:** Full end-to-end test pass across desktop and mobile viewports before final GitHub push.

