# Apex Minigolf 3D

A realistic 3D browser-based minigolf game built with **Three.js**, **Rapier3D (WebAssembly)**, **TypeScript/Vite**, and a **FastAPI** backend — supporting desktop mouse and mobile touch controls.

---

## Project Roadmap

- [x] **Phase 0 & 1:** Realistic PBR 3D Engine, Rapier3D CCD Physics, Desktop + Mobile Touch Controls, Procedural Audio, Starter Hole & FastAPI Health Backend
- [x] **Phase 2:** Modular Track Builder, Obstacles (Jump Pads, Boosts, Loops, Ice Tubes, Moving Doors/Windmills, Portals, Sand/Water) & Wind Physics
- [ ] **Phase 3:** 6 Signature Venues × 6 Holes (36 Holes Total) + Elite Shuffle Mode
- [ ] **Phase 4:** Single Player, Smart AI Bots & Local Pass-and-Play (2–4 Players)
- [ ] **Phase 5:** FastAPI WebSocket Online Multiplayer & Persistent Leaderboards
- [ ] **Phase 6:** Graphics Quality Presets, Mobile Polish & End-to-End Test Suite

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) and [`PHASE_1_PLAN.md`](./PHASE_1_PLAN.md) for architecture details.

---

## Tech Stack

- **3D Rendering:** Three.js (`ACESFilmicToneMapping`, `PMREMGenerator` + `RoomEnvironment`, `PCFSoftShadowMap`, procedural PBR textures)
- **Physics:** `@dimforge/rapier3d-compat` (Rust/WASM rigid bodies with Continuous Collision Detection)
- **Frontend Tooling:** Vite + TypeScript
- **Backend:** Python 3.12, FastAPI, Uvicorn, Pytest

---

## Local Development Setup

### 1. Backend (Python `venv` + FastAPI)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run backend tests:
```powershell
pytest
```

### 2. Frontend (Vite + TypeScript + Three.js + Rapier3D)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your desktop or mobile browser.

---

## Controls

| Action | Desktop (Mouse / Keyboard) | Mobile (Touch) |
| :--- | :--- | :--- |
| **Aim & Putt** | Left-click & drag backward from ball; release to shoot (drag near center to cancel) | Single-finger touch & drag backward; release to shoot |
| **Orbit Camera** | Right-click & drag (or `Shift` + Left-drag) | Two-finger drag |
| **Zoom Camera** | Mouse wheel | Two-finger pinch |
| **Reset Camera** | `R` key or Camera Reset button | Camera Reset button |

