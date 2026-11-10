import * as THREE from 'three';
import { CameraRig } from './CameraRig';

export interface AimState {
  active: boolean;
  cancelled: boolean;
  direction: THREE.Vector3;
  power: number;
}

export interface InputCallbacks {
  canAim: () => boolean;
  getBallPosition: () => THREE.Vector3;
  onAimUpdate: (state: AimState) => void;
  onShoot: (direction: THREE.Vector3, power: number) => void;
  onInteraction: () => void;
}

const CANCEL_DEADZONE_PX = 18;
const MAX_PULL_PX = 175;

/**
 * Unified PointerEvents controller handling desktop mouse (drag-to-aim,
 * right-drag orbit, wheel zoom) and mobile touch (1-finger aim, 2-finger orbit/pinch).
 */
export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraRig: CameraRig;
  private readonly callbacks: InputCallbacks;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private mode: 'idle' | 'aim' | 'orbit' | 'pinch' = 'idle';
  private aimStartScreen = { x: 0, y: 0 };
  private aimStartWorld = new THREE.Vector3();
  private lastOrbitPos = { x: 0, y: 0 };
  private lastPinchCenter = { x: 0, y: 0 };
  private lastPinchDist = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly currentDir = new THREE.Vector3(0, 0, -1);
  private currentPower = 0;
  private aimCancelled = true;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    cameraRig: CameraRig,
    callbacks: InputCallbacks
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.cameraRig = cameraRig;
    this.callbacks = callbacks;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'r' || e.key === 'R') {
      this.cameraRig.reset();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cameraRig.zoom(e.deltaY * 0.008);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.callbacks.onInteraction();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      this.cancelAimVisual();
      this.mode = 'pinch';
      this.canvas.className = 'is-orbiting';
      const [p1, p2] = Array.from(this.pointers.values());
      this.lastPinchCenter = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      return;
    }

    if (this.pointers.size > 2) return;

    const wantsOrbit = e.button === 2 || e.shiftKey || !this.callbacks.canAim();
    if (wantsOrbit) {
      this.mode = 'orbit';
      this.canvas.className = 'is-orbiting';
      this.lastOrbitPos = { x: e.clientX, y: e.clientY };
      return;
    }

    this.mode = 'aim';
    this.canvas.className = 'is-aiming';
    this.aimStartScreen = { x: e.clientX, y: e.clientY };
    const ballPos = this.callbacks.getBallPosition();
    this.dragPlane.constant = -ballPos.y;
    this.raycastGroundPlane(e.clientX, e.clientY, this.aimStartWorld);
    this.aimCancelled = true;
    this.currentPower = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [p1, p2] = Array.from(this.pointers.values());
      const center = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      this.cameraRig.orbit(center.x - this.lastPinchCenter.x, center.y - this.lastPinchCenter.y);
      this.cameraRig.zoom((this.lastPinchDist - dist) * 0.035);

      this.lastPinchCenter = center;
      this.lastPinchDist = dist;
      return;
    }

    if (this.mode === 'orbit') {
      const dx = e.clientX - this.lastOrbitPos.x;
      const dy = e.clientY - this.lastOrbitPos.y;
      this.cameraRig.orbit(dx, dy);
      this.lastOrbitPos = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.mode === 'aim') {
      const dxScreen = this.aimStartScreen.x - e.clientX;
      const dyScreen = this.aimStartScreen.y - e.clientY;
      const screenPull = Math.hypot(dxScreen, dyScreen);

      if (screenPull < CANCEL_DEADZONE_PX) {
        this.aimCancelled = true;
        this.currentPower = 0;
        this.callbacks.onAimUpdate({
          active: true,
          cancelled: true,
          direction: this.currentDir,
          power: 0,
        });
        return;
      }

      const curWorld = new THREE.Vector3();
      const hitPlane = this.raycastGroundPlane(e.clientX, e.clientY, curWorld);
      if (hitPlane) {
        const delta = this.aimStartWorld.clone().sub(curWorld).setY(0);
        if (delta.lengthSq() > 0.0001) {
          this.currentDir.copy(delta.normalize());
        }
      } else {
        // Fallback to camera-aligned XZ vector if pointer moves above horizon
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        this.currentDir
          .copy(forward)
          .multiplyScalar(-dyScreen)
          .addScaledVector(right, dxScreen)
          .normalize();
      }

      const maxPx = Math.min(MAX_PULL_PX, window.innerHeight * 0.28);
      this.currentPower = Math.max(0.05, Math.min(1, (screenPull - CANCEL_DEADZONE_PX) / maxPx));
      this.aimCancelled = false;

      this.callbacks.onAimUpdate({
        active: true,
        cancelled: false,
        direction: this.currentDir,
        power: this.currentPower,
      });
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);

    if (this.mode === 'aim' && this.pointers.size === 0) {
      const shouldShoot = !this.aimCancelled && this.currentPower > 0.04 && this.callbacks.canAim();
      const dir = this.currentDir.clone();
      const power = this.currentPower;
      this.cancelAimVisual();
      this.mode = 'idle';
      this.canvas.className = '';
      if (shouldShoot) {
        this.callbacks.onShoot(dir, power);
      }
      return;
    }

    if (this.pointers.size === 0) {
      this.mode = 'idle';
      this.canvas.className = '';
    } else if (this.mode === 'pinch' && this.pointers.size === 1) {
      const remaining = Array.from(this.pointers.values())[0];
      this.mode = 'orbit';
      this.lastOrbitPos = { x: remaining.x, y: remaining.y };
    }
  };

  private cancelAimVisual(): void {
    this.aimCancelled = true;
    this.currentPower = 0;
    this.callbacks.onAimUpdate({
      active: false,
      cancelled: true,
      direction: this.currentDir,
      power: 0,
    });
  }

  private raycastGroundPlane(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.dragPlane, out) !== null;
  }
}

