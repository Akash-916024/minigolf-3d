import * as THREE from 'three';
import './style.css';
import { SceneManager } from './engine/SceneManager';
import { createCourseMaterials } from './engine/Materials';
import { AudioEngine } from './engine/AudioEngine';
import { ParticleSystem } from './engine/ParticleSystem';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { BallController, BALL_RADIUS } from './physics/BallController';
import { CameraRig } from './controls/CameraRig';
import { AimVisualizer } from './controls/AimVisualizer';
import { InputManager } from './controls/InputManager';
import { buildCourseFromDefinition, BuiltCourse } from './courses/CourseBuilder';
import { HoleDefinition } from './courses/CourseTypes';
import { HOLE_01_PINE_STARTER } from './courses/Hole01PineStarter';
import { OBSTACLE_SHOWCASE_HOLE } from './courses/ObstacleShowcaseHole';
import { HudManager } from './ui/HudManager';

const BEST_SCORE_PREFIX = 'minigolf3d_best_';
const MAX_CUP_CAPTURE_SPEED = 4.2;

const HOLES: HoleDefinition[] = [OBSTACLE_SHOWCASE_HOLE, HOLE_01_PINE_STARTER];

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('hud-root');
  if (!canvas || !hudRoot) {
    throw new Error('Required DOM containers (#game-canvas, #hud-root) not found.');
  }

  const sceneManager = new SceneManager(canvas);
  const materials = createCourseMaterials(sceneManager.getMaxAnisotropy());
  const audio = new AudioEngine();
  const particles = new ParticleSystem(sceneManager.scene);
  const physics = await PhysicsWorld.create();

  let currentHoleIdx = 0;
  let currentCourse: BuiltCourse | null = null;
  let strokes = 0;
  let bestScore: number | null = null;
  let lastLipOutAt = 0;

  const ball = new BallController(
    sceneManager.scene,
    physics,
    materials.ball,
    new THREE.Vector3(...HOLES[0].tee)
  );
  const cameraRig = new CameraRig(sceneManager.camera, new THREE.Vector3(...HOLES[0].tee));
  const aimVisualizer = new AimVisualizer(sceneManager.scene, []);

  const hud = new HudManager(hudRoot, {
    onResetCamera: () => cameraRig.reset(),
    onResetBall: () => {
      if (ball.isSunk()) return;
      ball.resetToLastSafe();
      aimVisualizer.hide();
      hud.setPowerReadout(false, true, 0);
      hud.showBanner('Ball reset to last lie');
    },
    onToggleMute: () => audio.toggleMute(),
    onReplayHole: () => {
      if (!currentCourse) return;
      strokes = 0;
      hud.setStrokes(0);
      hud.hideHoleComplete();
      ball.resetToTee(currentCourse.teePosition);
      cameraRig.reset();
    },
    onNextHole: () => {
      loadHole((currentHoleIdx + 1) % HOLES.length);
    },
    onSwitchHole: () => {
      loadHole((currentHoleIdx + 1) % HOLES.length);
    },
  });

  const applyPenalty = (message: string): void => {
    strokes += 1;
    hud.setStrokes(strokes);
    hud.showBanner(message);
  };

  function loadHole(index: number): void {
    currentHoleIdx = index;
    const def = HOLES[index];
    const nextDef = HOLES[(index + 1) % HOLES.length];

    if (currentCourse) {
      currentCourse.dispose();
    }

    currentCourse = buildCourseFromDefinition(def, sceneManager.scene, physics, materials);
    aimVisualizer.setWallObjects(currentCourse.wallObjects);
    aimVisualizer.hide();

    strokes = 0;
    bestScore = loadBestScore(def.id);
    hud.hideHoleComplete();
    hud.setPowerReadout(false, true, 0);
    hud.setHoleInfo(
      def.number,
      def.name,
      def.venueLabel,
      def.par,
      bestScore,
      `Go to: ${nextDef.name}`
    );

    ball.resetToTee(currentCourse.teePosition);
    cameraRig.reset();
  }

  loadHole(0);

  // Step kinematic obstacles and continuous boost/wind forces on every fixed physics tick
  const stepBallPos = new THREE.Vector3();
  physics.addStepHook((fixedDt, elapsedPhysics) => {
    if (!currentCourse) return;
    const grounded = physics.isGrounded(ball.getPosition(stepBallPos), BALL_RADIUS);
    currentCourse.obstacles.onPhysicsStep(fixedDt, elapsedPhysics, ball, grounded);
  });

  // Dispatch collision events for cup, walls, and Phase 2 interactive obstacles
  physics.onColliderEvent(ball.colliderHandle, (otherHandle, started) => {
    if (!currentCourse) return;

    if (
      currentCourse.obstacles.handleBallCollision(
        otherHandle,
        started,
        ball,
        audio,
        particles,
        () => applyPenalty('Water Hazard (+1 Penalty)')
      )
    ) {
      return;
    }

    if (!started) return;

    if (otherHandle === currentCourse.cupSensorHandle && !ball.isSunk()) {
      const speed = ball.getHorizontalSpeed();
      if (speed <= MAX_CUP_CAPTURE_SPEED) {
        ball.sinkIntoCup(currentCourse.cupCenter);
        audio.playCupDrop();
        aimVisualizer.hide();
        hud.setPowerReadout(false, true, 0);

        if (bestScore === null || strokes < bestScore) {
          bestScore = strokes;
          saveBestScore(currentCourse.definition.id, bestScore);
          hud.setBest(bestScore);
        }
        hud.showHoleComplete(strokes, currentCourse.definition.par, bestScore);
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

    if (currentCourse.wallHandles.has(otherHandle)) {
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
  const activeWind = new THREE.Vector3();

  function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    physics.step(delta);

    ball.getPosition(ballPos);
    const grounded = physics.isGrounded(ballPos, BALL_RADIUS);
    const outOfBounds = ball.update(delta, grounded);
    if (outOfBounds) {
      audio.playOutOfBounds();
      applyPenalty('Out of Bounds (+1 Penalty)');
    }

    if (currentCourse) {
      currentCourse.updateVisuals(delta, elapsed);
      currentCourse.obstacles.getEffectiveWind(activeWind);
      particles.update(delta, activeWind, ballPos);
      hud.setWind(activeWind.x, activeWind.z, cameraRig.getYaw());
    }

    aimVisualizer.updateReadyIndicator(ball.isAtRest(), ballPos, elapsed);
    cameraRig.update(ball.getPosition(ballPos), delta);
    sceneManager.render();
  }

  animate();
}

function loadBestScore(holeId: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${BEST_SCORE_PREFIX}${holeId}`);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveBestScore(holeId: string, score: number): void {
  try {
    window.localStorage.setItem(`${BEST_SCORE_PREFIX}${holeId}`, String(score));
  } catch {
    // Ignore storage quota errors in private browsing modes
  }
}

bootstrap().catch((err) => {
  console.error('Failed to initialize Apex Minigolf 3D:', err);
});
