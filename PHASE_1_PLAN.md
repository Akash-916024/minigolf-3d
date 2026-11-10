# Phase 1 Implementation Plan: Core 3D Engine, Realistic PBR Visuals, Physics & Controls

> **Repository:** `https://github.com/Akash-916024/minigolf-3d` (Public)  
> **Prerequisite Included:** Phase 0 scaffolding (`venv`, `requirements.txt`, Vite + TypeScript setup, `.gitignore`, `README.md`)

---

## 1. Phase 1 Goal & Playable Deliverable

By the end of Phase 1, you will have a **runnable, realistic 3D minigolf vertical slice** in the browser featuring:
- A sunlit, realistic 3D **Pine Forest starter hole** (fairway turf with directional mowing stripes, wooden border rails, an angled bank wall, a gentle slope, and a recessed metal cup with a fluttering flag).
- **Rapier3D WebAssembly physics** with Continuous Collision Detection (CCD) for accurate rolling, bank rebounds, and realistic cup lip-outs/captures.
- **Desktop Mouse & Mobile Touch controls** (drag-back slingshot aiming with bounce preview line, power meter, cancel zone, and smooth orbit/follow camera).
- **Procedural Web Audio** sound effects (putt strike, wood wall bounce, cup rattle, hole-complete chime).
- **Minimal FastAPI backend** running in a Python `venv` with `/health` and `CORSMiddleware` ready for Phase 5 online multiplayer.

---

## 2. File-by-File Architecture for Phase 1

```text
minigolf-3d/
├── .gitignore
├── README.md
├── IMPLEMENTATION_PLAN.md
├── PHASE_1_PLAN.md
├── backend/
│   ├── venv/                         # Python virtual environment
│   ├── requirements.txt              # fastapi[standard], uvicorn[standard], pytest, httpx
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py                   # FastAPI app + CORSMiddleware + /health endpoint
│   └── tests/
│       └── test_health.py            # FastAPI health endpoint verification
└── frontend/
    ├── package.json                  # three@^0.186.0, @dimforge/rapier3d-compat@^0.20.0, vite, typescript
    ├── tsconfig.json
    ├── index.html                    # Mobile-native viewport meta (viewport-fit=cover)
    └── src/
        ├── main.ts                   # Entry point & fixed-timestep game loop
        ├── style.css                 # Apple-grade translucent HUD, 100dvh, safe-area insets
        ├── engine/
        │   ├── SceneManager.ts       # WebGLRenderer, ACESFilmicToneMapping, PCFSoftShadowMap, PMREM RoomEnvironment
        │   ├── Materials.ts          # Procedural PBR textures (dimpled ball, striped turf, oak wood, brushed metal)
        │   └── AudioEngine.ts        # Web Audio API procedural SFX (putt, bounce, cup drop, fanfare)
        ├── physics/
        │   ├── PhysicsWorld.ts       # Rapier3D init, fixed-step accumulator, EventQueue & collision handling
        │   └── BallController.ts     # CCD sphere rigid body, rolling/angular damping, rest detection, safe-lie reset
        ├── controls/
        │   ├── InputManager.ts       # Unified PointerEvents (mouse drag + 1-finger aim + 2-finger orbit/pinch)
        │   ├── AimVisualizer.ts      # 3D power ring, directional arrow & raycast bounce preview line
        │   └── CameraRig.ts          # Smooth follow camera, orbit yaw/pitch, zoom clamping, R-key / button reset
        ├── courses/
        │   └── StarterHole.ts        # Phase 1 test green (fairway, slope, angled bank rail, recessed cup + flag)
        └── ui/
            └── HudManager.ts         # Glassmorphic stroke/par pill, power bar, mute/reset buttons, hole-clear modal
```

---

## 3. Technical Specifications

### A. Backend Foundation (`backend/`)
- **Virtual Environment:** Create `backend/venv` first before installing any Python packages.
- **`backend/requirements.txt`:**
  - `fastapi[standard]`
  - `uvicorn[standard]`
  - `pytest`
  - `httpx`
- **CORS & Health (`backend/app/main.py`):**
  - Configure `CORSMiddleware` immediately for `http://localhost:5173` and `http://127.0.0.1:5173`.
  - Expose `GET /health` returning `{"status": "ok", "service": "minigolf-3d-api"}`.

### B. Realistic 3D PBR Visuals (`SceneManager.ts` & `Materials.ts`)
- **Renderer Settings:**
  - `THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping`
  - `renderer.toneMappingExposure = 1.05`
  - `renderer.shadowMap.enabled = true` and `renderer.shadowMap.type = THREE.PCFSoftShadowMap`
  - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- **Lighting & Reflections:**
  - `PMREMGenerator` + `RoomEnvironment` for crisp realistic specular reflections on the clearcoated golf ball and brushed steel cup rim.
  - Warm directional sunlight (`DirectionalLight` with 2048×2048 shadow map covering the course bounds) + hemisphere sky/ground fill (`HemisphereLight`).
  - Procedural gradient sky dome + subtle atmospheric fog (`THREE.FogExp2`) + surrounding pine-green ground plane.
- **Procedural Canvas PBR Maps (Zero external broken texture URLs):**
  - **Golf Ball:** `MeshPhysicalMaterial` (`clearcoat: 1.0`, `clearcoatRoughness: 0.08`, procedural dimple normal/bump map).
  - **Fairway Turf:** `MeshStandardMaterial` with procedural alternating mower stripe albedo + micro-blade roughness/bump map (`roughness: 0.85`).
  - **Border Rails:** Procedural wood-grain oak texture with subtle bevel/specular highlight.
  - **Cup & Flag:** Dark recessed cylinder interior, metallic rim ring, and gently waving red/white flag mesh.

### C. Rapier3D Physics & Scale (`PhysicsWorld.ts` & `BallController.ts`)
- **Scale:** `1.0` scene unit = `1.0` meter. Golf ball radius = `0.18` (large enough for crisp mobile readability and smooth shadow contact).
- **Fixed Timestep Loop:** Accumulate frame `delta` (clamped at `<= 0.05s` to avoid tab-switch spikes) and step Rapier in fixed `1/60s` ticks (`world.step(eventQueue)`).
- **Golf Ball Rigid Body:**
  - `RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(0.45)`
  - `RAPIER.ColliderDesc.ball(0.18).setFriction(0.45).setRestitution(0.55).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)`
- **Rest & Recovery Logic:**
  - Track consecutive low-speed frames (`linearSpeed < 0.06 && angularSpeed < 0.15` for `0.35s`) → snap ball cleanly to rest and unlock next stroke.
  - Save `lastSafePosition` before every stroke; if `ball.y < -3.0` (falls off course), smoothly reset ball to `lastSafePosition` with `+1` penalty stroke.
- **Cup Detection (Velocity-Gated Sensor):**
  - Place a sensor collider (`setSensor(true)`) inside the recessed cup.
  - On collision enter with the ball, check horizontal speed:
    - If `speed <= 4.2`, capture the ball (play cup rattle + chime, drop ball to cup bottom, open Hole Complete modal).
    - If `speed > 4.2`, allow the physical rim/cup walls to naturally lip-out or bounce the ball past!

### D. Unified Desktop Mouse & Mobile Touch Controls (`InputManager.ts`, `AimVisualizer.ts`, `CameraRig.ts`)
- **Mobile-Native CSS Safeguards (`style.css` & `index.html`):**
  - `touch-action: none` on the WebGL canvas to eliminate browser pull-to-refresh or page scrolling during putts.
  - `height: 100dvh`, `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`, and `env(safe-area-inset-*)` padding on HUD elements.
- **Input Mapping:**
  - **Aim & Putt (only enabled when ball is at rest):**
    - *Desktop:* Left-click near/on ball (or anywhere on canvas in Aim mode) + drag backward to pull power; release to strike. Drag back within dead-zone radius (`< 18px`) to cancel shot.
    - *Mobile:* Single-finger touch + drag backward to aim/power; release to putt; return finger to center dead-zone to cancel.
  - **Camera Orbit & Zoom:**
    - *Desktop:* Right-click drag (or Shift + Left-drag) to orbit yaw/pitch; Mouse Wheel to zoom.
    - *Mobile:* Two-finger drag to orbit yaw/pitch; Two-finger pinch to zoom.
- **Visual Aim Feedback (`AimVisualizer.ts`):**
  - Ground power ring around ball transitioning smoothly from **Emerald Green → Amber → Crimson** (`0% → 100%` power).
  - Dotted 3D trajectory raycast line showing **primary path + first wall reflection angle**.

### E. Apple-Grade Translucent HUD (`HudManager.ts`)
- **Top Floating Pill:** `Hole 1 • Par 3` | `Strokes: 0` | `Best: --` with frosted glass (`backdrop-filter: blur(20px) saturate(180%)`).
- **Bottom-Right Quick Actions:** Camera Reset (`R`), Mute/Unmute Audio, and Controls Hint toggle.
- **Power Percentage Toast:** Smooth tabular-nums readout while aiming (`48%` / `CANCEL` when inside dead-zone).
- **Hole Complete Sheet:** Smooth `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) scorecard summary (Eagle/Birdie/Par/Bogey badge + `Play Again` button).

---

## 4. Phase 1 Verification Checklist (Before GitHub Push)

1. **Backend Test:** Activate `backend/venv`, run `pytest`, start `uvicorn app.main:app --port 8000`, and verify `GET /health` returns `200 OK`.
2. **Frontend Build & Typecheck:** Run `npx tsc --noEmit` and `npm run build` with zero errors.
3. **Gameplay & Physics Verification:**
   - Ball rolls smoothly, casts soft shadows, reflects environment light, and rebounds accurately off the angled wall (zero tunneling even at 100% power).
   - Fast shot over the cup lips out instead of falsely scoring; controlled shot drops into the cup and triggers the completion modal.
   - Out-of-bounds drop resets to `lastSafePosition` with `+1` stroke.
4. **Dual-Input Verification:**
   - Desktop mouse drag-to-aim, cancel dead-zone, right-drag orbit, and scroll zoom work smoothly.
   - Mobile viewport emulation (touch events) allows single-finger putting without scrolling the page, plus two-finger orbit/pinch zoom.
5. **User Sign-off & GitHub Push:** After you test Phase 1 and confirm you are satisfied, create the initial commit and push to `https://github.com/Akash-916024/minigolf-3d`.

