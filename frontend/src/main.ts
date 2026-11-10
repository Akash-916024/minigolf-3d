import * as THREE from 'three';
import './style.css';
import { SceneManager } from './engine/SceneManager';
import { createCourseMaterials } from './engine/Materials';
import { AudioEngine } from './engine/AudioEngine';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { BallController } from './physics/BallController';
import { CameraRig } from './controls/CameraRig';
import { AimVisualizer } from './controls/AimVisualizer';
import { InputManager } from './controls/InputManager';
import { buildStarterHole } from './courses/StarterHole';
import { HudManager } from './ui/HudManager';

const HOLE_PAR = 3;
const BEST_SCORE_STORAGE_KEY = 'minigolf3d_phase1_best';
const MAX_CUP_CAPTURE_SPEED = 4.2;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('hud-root');
  if (!canvas || !hudRoot) {
    throw new Error('Required DOM containers (#game-canvas, #hud-root) not found.');
  }

  const sceneManager = new SceneManager(canvas);
  const materials = createCourseMaterials(sceneManager.getMaxAnisotropy());
  const audio = new AudioEngine();
  const physics = await PhysicsWorld.create();

  const hole = buildStarterHole(sceneManager.scene, physics, materials);
  const ball = new BallController(sceneManager.scene, physics, materials.ball, hole.teePosition);
  const cameraRig = new CameraRig(sceneManager.camera, hole.teePosition);
  const aimVisualizer = new AimVisualizer(sceneManager.scene, hole.wallObjects);

  let strokes = 0;
  let bestScore = loadBestScore();
  let lastLipOutAt = 0;

  const hud = new HudManager(hudRoot, HOLE_PAR, {
    onResetCamera: () => cameraRig.reset(),
    onToggleMute: () => audio.toggleMute(),
    onReplayHole: () => {
      strokes = 0;
      hud.setStrokes(0);
      hud.hideHoleComplete();
      ball.resetToTee();
      cameraRig.reset();
    },
  });
  hud.setBest(bestScore);

  // Register collision events for wall bounce SFX & velocity-gated cup capture
  physics.onColliderEvent(ball.colliderHandle, (otherHandle, started) => {
    if (!started) return;

    if (otherHandle === hole.cupSensorHandle && !ball.isSunk()) {
      const speed = ball.getHorizontalSpeed();
      if (speed <= MAX_CUP_CAPTURE_SPEED) {
        ball.sinkIntoCup(hole.cupCenter);
        audio.playCupDrop();
        aimVisualizer.hide();
        hud.setPowerReadout(false, true, 0);

        if (bestScore === null || strokes < bestScore) {
          bestScore = strokes;
          saveBestScore(bestScore);
          hud.setBest(bestScore);
        }
        hud.showHoleComplete(strokes, HOLE_PAR, bestScore);
      } else {
        const now = performance.now();
        if (now - lastLipOutAt > 400) {
          lastLipOutAt = now;
          audio.playLipOut();
          hud.showBanner('Too fast — lip-out!');
        }
      }
      return;
    }

    if (hole.wallHandles.has(otherHandle)) {
      audio.playWallBounce(ball.getHorizontalSpeed());
    }
  });

  new InputManager(canvas, sceneManager.camera, cameraRig, {
    canAim: () => ball.isAtRest(),
    getBallPosition: () => ball.getPosition(),
    onInteraction: () => audio.unlock(),
    onAimUpdate: (state) => {
      hud.setPowerReadout(state.active, state.cancelled, state.power);
      if (state.active && !state.cancelled) {
        aimVisualizer.update(ball.getPosition(), state.direction, state.power);
      } else {
        aimVisualizer.hide();
      }
    },
    onShoot: (direction, power) => {
      aimVisualizer.hide();
      hud.setPowerReadout(false, true, 0);
      strokes += 1;
      hud.setStrokes(strokes);
      audio.playPutt(power);
      ball.shoot(direction, power);
    },
  });

  const clock = new THREE.Clock();
  const ballPos = new THREE.Vector3();

  function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    physics.step(delta);
    const outOfBounds = ball.update(delta);
    if (outOfBounds) {
      strokes += 1;
      hud.setStrokes(strokes);
      audio.playOutOfBounds();
      hud.showBanner('Out of Bounds (+1 Penalty)');
    }

    hole.update(elapsed);
    cameraRig.update(ball.getPosition(ballPos), delta);
    sceneManager.render();
  }

  animate();
}

function loadBestScore(): number | null {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
  } catch {
    // Ignore storage quota errors in private browsing modes
  }
}

bootstrap().catch((err) => {
  console.error('Failed to initialize Apex Minigolf 3D:', err);
});

