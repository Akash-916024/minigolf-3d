# Phase 2 Implementation Plan: Modular Course Builder, Obstacles & Wind Physics

> **Repository:** `https://github.com/Akash-916024/minigolf-3d` (Public)  
> **Builds On:** Phase 1 (`SceneManager`, `PhysicsWorld`, `BallController`, `InputManager`, `AudioEngine`, `HudManager`)

---

## 1. Phase 2 Goal & Deliverable

Phase 2 transforms the Phase 1 prototype into a **reusable, data-driven 3D minigolf course engine** capable of spawning every surface, obstacle, hazard, and wind mechanic from **Miniclip *Golf Battle*** and **CrazyGames *Mini Golf Club***:

- **Modular Course Compiler (`CourseBuilder`):** Builds watertight 3D PBR visuals + Rapier3D static/kinematic/trimesh colliders from clean TypeScript `HoleDefinition` data objects—with full `dispose()` cleanup for hole switching.
- **All Surface Types:** Standard Fairway, Low-Friction **Ice**, High-Damping **Sand Bunkers**, **Water Hazards** (animated ripple surface + splash VFX + penalty reset), and **Bumper Rubber** walls.
- **All Dynamic & Arcade Obstacles:**
  - **Jump Pads / Launchers** (spring animation + upward/forward impulse)
  - **Speed Boost Pads** (animated glowing chevrons + directional acceleration)
  - **Crazy Loopings** (360° curved `trimesh` loop-de-loop requiring sufficient speed)
  - **Enclosed Ice Tubes / Tunnels** (curved half-pipe & full-tube `trimesh` chutes)
  - **Moving Obstacles** (`kinematicPositionBased` sliding doors, oscillating barrier walls, rotating windmill blades, and moving bridges)
  - **Pinball Bumpers & Bumper Walls** (radial/surface elastic kick + pulse animation)
  - **Paired Portals / Teleporters** (entry/exit ring pairs preserving momentum along exit heading)
- **Wind Simulation:** Global per-hole wind + localized wind fan tunnels applying continuous force (amplified while airborne), animated 3D wind streaks, cup flag direction alignment, and a **HUD Wind Compass**.
- **Phase 2 Showcase Arena:** A dedicated multi-feature **Obstacle Showcase Course** (plus an updated modular Hole 1) with a quick course/hole switcher in the HUD so every single mechanic can be tested before authoring all 36 holes in Phase 3.

---

## 2. File-by-File Architecture Additions & Refactors

```text
frontend/src/
├── engine/
│   ├── Materials.ts              # Extended with PBR ice, sand, animated water, bumper, neon jump/boost/portal mats
│   ├── ParticleSystem.ts         # Lightweight pooled 3D VFX (water splash, sand puff, jump burst, wind streaks)
│   └── AudioEngine.ts            # Added jumpPad, boostPad, bumper, portal, waterSplash, sandTrap SFX
├── physics/
│   ├── PhysicsWorld.ts           # Added dynamic world lifecycle (removeBody/collider cleanup) + raycast helpers
│   └── BallController.ts         # Per-surface damping/friction overrides, airborne check, wind force & portal cooldown
├── courses/
│   ├── CourseTypes.ts            # Strongly typed HoleDefinition schema (segments, surfaces, obstacles, wind, cup)
│   ├── GeometryHelpers.ts        # Parametric 3D builders: ramps, curved rails, 360° loops, half-pipe tubes, cup cutout
│   ├── ObstacleController.ts     # Runtime update & sensor logic for kinematic doors/windmills, pads, bumpers, portals, wind
│   ├── CourseBuilder.ts          # Compiles HoleDefinition -> Three.js meshes + Rapier colliders + clean dispose()
│   ├── Hole01PineStarter.ts      # Migrated Phase 1 hole into declarative HoleDefinition format
│   └── ObstacleShowcaseHole.ts   # Phase 2 comprehensive test track exercising every obstacle & wind zone
└── ui/
    └── HudManager.ts             # Added Wind Compass widget & Phase 2 Showcase Hole switcher pill
```

---

## 3. Detailed Technical Specifications

### A. Declarative Course Schema (`CourseTypes.ts`)
Each hole is described purely as structured data (`HoleDefinition`):
- `id`, `name`, `venue`, `par`
- `tee`: `[x, y, z]`
- `cup`: `[x, y, z]`
- `globalWind?`: `{ x: number; z: number; strength: number }`
- `slabs[]`: Fairway/ice/sand/wood boxes with optional `rotX`, `rotY`, `rotZ` slopes, `surface: 'fairway' | 'ice' | 'sand' | 'wood' | 'stone'`
- `rails[]`: Border walls with `style: 'wood' | 'stone' | 'bumper'` (`bumper` sets high restitution + impulse boost)
- `loops[]`: 360° Crazy Looping specs (`center`, `radius`, `width`, `entryAngle`, `yaw`)
- `tubes[]`: Curved enclosed/half-pipe chutes (`points`, `radius`, `surface: 'ice' | 'metal'`, `enclosed: boolean`)
- `jumpPads[]`: `{ pos, size, impulse: [x, y, z], yaw }`
- `boostPads[]`: `{ pos, size, direction: [x, z], force, yaw }`
- `pinballBumpers[]`: `{ pos, radius, height, bounceImpulse }`
- `movingObstacles[]`: `{ kind: 'door' | 'sweeper' | 'windmill' | 'platform', origin, size, axis, amplitude, speed, phase }`
- `portals[]`: `{ id, entryPos, entryYaw, exitPos, exitYaw, color }`
- `waterZones[]`: `{ pos, size }` (visual animated water plane + Rapier sensor triggering `+1` penalty & last-safe reset)
- `sandZones[]`: `{ pos, size }` (visual sunken sand patch + sensor increasing ball linear/angular damping)
- `windZones[]`: `{ pos, size, direction: [x, y, z], strength }`

### B. Parametric Geometry & Trimesh Physics (`GeometryHelpers.ts`)
- **Cup Cutout Generator:** Generalizes the Phase 1 4-slab + 8-segment inner sleeve cup cutout so *any* green slab containing the cup (`cup: [x, y, z]`) automatically gets a watertight recessed circular hole.
- **360° Crazy Looping Builder:**
  - Generates a smooth helical-offset loop strip (slight lateral offset `~0.65m` between entry and exit so the ball doesn't hit the back of the loop wall on exit, just like Miniclip *Golf Battle*!).
  - Builds synchronized `THREE.BufferGeometry` (with side guard rails along the loop curve) and `RAPIER.ColliderDesc.trimesh(vertices, indices)`.
- **Curved Tube / Ice Chute Builder:**
  - Extrudes an open U-channel or closed cylindrical pipe along a `THREE.CatmullRomCurve3` spline into a `trimesh` collider + translucent frosted ice mesh.

### C. Kinematic & Sensor Obstacle Runtime (`ObstacleController.ts`)
- **Kinematic Obstacles (`RigidBodyDesc.kinematicPositionBased()`):**
  - Every frame inside the fixed physics step, compute target position/quaternion and call `setNextKinematicTranslation(...)` / `setNextKinematicRotation(...)` so Rapier calculates true surface contact velocity when striking the ball.
- **Trigger Sensors (`setSensor(true)`):**
  - **Jump Pads:** Apply vertical + forward impulse (`ball.applyImpulse(...)`), play spring bounce animation + `playJumpPad()`.
  - **Speed Boost Pads:** Apply continuous forward acceleration while overlapping, play scrolling chevron glow + `playBoostPad()`.
  - **Portals:** On enter (if `portalCooldown <= 0`), teleport ball to `exitPos`, rotate horizontal velocity vector to `exitYaw` while preserving speed, set `portalCooldown = 0.65s`, spawn burst particles + `playPortalWarp()`.
  - **Water Hazards:** On enter, spawn blue water splash droplets, play `playWaterSplash()`, show banner `Water Hazard (+1 Penalty)`, and restore ball to `lastSafePosition`.
  - **Sand Bunkers:** Track `inSandCount`; while `> 0`, dynamically raise linear damping (`3.6`) and angular damping (`3.8`) so the ball slows sharply just like real bunker sand.
  - **Ice Slabs:** Track `onIceCount`; while `> 0`, lower linear damping (`0.04`) and collider friction (`0.03`) so the ball glides rapidly across frozen sections.

### D. Wind Physics & Visuals (`BallController.ts`, `ParticleSystem.ts`, `HudManager.ts`)
- **Ground vs. Airborne Wind Scaling:**
  - Check downward ray (`world.castRay`) from ball center (`maxToi = BALL_RADIUS + 0.08`) to detect `isAirborne`.
  - Apply `windForce = effectiveWind * (isAirborne ? 1.0 : 0.28)` each physics step so wind gently nudges rolling shots and strongly curves mid-air jump-pad shots!
- **Visual Cues:**
  - **3D Wind Streaks:** Pooled translucent ribbon/streak particles drifting along the wind vector across the active course and inside localized wind fan zones.
  - **Course Flag Alignment:** Cup flag aligns smoothly with `globalWind` direction and flutters faster at higher wind speeds.
  - **HUD Wind Compass:** Compact glassmorphic badge beside the top score pill showing the wind arrow rotated relative to the camera's current yaw (so "left" on the compass always means "pushes left on your screen"!).

---

## 4. Phase 2 Verification Checklist (Before GitHub Push)

1. **TypeScript & Build Check:** `npx tsc --noEmit` and `npm run build` pass with zero errors.
2. **Backend Regression Check:** `pytest` continues to pass cleanly in `backend/venv`.
3. **Obstacle Showcase Verification (Desktop & Mobile):**
   - **Jump Pad & Boost Pad:** Launches ball cleanly across gaps; airborne wind noticeably curves flight path.
   - **Crazy Looping:** Slow shot falls back down cleanly; full-power shot + boost clears the 360° loop with zero tunneling.
   - **Ice Surface & Enclosed Ice Tube:** Ball glides with low friction and exits the curved ice chute smoothly.
   - **Moving Doors & Rotating Windmill:** Kinematic collisions impart realistic momentum without clipping.
   - **Pinball Bumpers & Bumper Walls:** High-energy elastic ricochets with audio & visual pulse.
   - **Portals:** Teleports cleanly while preserving momentum; no infinite teleport loop.
   - **Sand & Water Hazards:** Sand slows ball dramatically; water triggers splash particles + `+1` penalty reset.
   - **Hole Switching & Cleanup:** Switching between *Hole 1* and the *Obstacle Showcase* leaks zero Rapier bodies or Three.js render artifacts.
4. **User Sign-off & GitHub Push:** After you test Phase 2 and confirm satisfaction, push the Phase 2 update to `https://github.com/Akash-916024/minigolf-3d`.

