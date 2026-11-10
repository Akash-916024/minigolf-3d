import * as THREE from 'three';

const MIN_DISTANCE = 4.0;
const MAX_DISTANCE = 20.0;
const MIN_PITCH = 0.22;
const MAX_PITCH = 1.28;
const DEFAULT_YAW = 0.0;
const DEFAULT_PITCH = 0.56;
const DEFAULT_DISTANCE = 9.5;

/**
 * Smooth follow + orbit camera rig supporting desktop right-drag/wheel
 * and mobile two-finger orbit/pinch.
 */
export class CameraRig {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private yaw = DEFAULT_YAW;
  private pitch = DEFAULT_PITCH;
  private distance = DEFAULT_DISTANCE;

  private desiredYaw = DEFAULT_YAW;
  private desiredPitch = DEFAULT_PITCH;
  private desiredDistance = DEFAULT_DISTANCE;

  constructor(camera: THREE.PerspectiveCamera, initialTarget: THREE.Vector3) {
    this.camera = camera;
    this.target.copy(initialTarget);
    this.updateCameraTransform(1);
  }

  public orbit(deltaX: number, deltaY: number): void {
    this.desiredYaw -= deltaX * 0.0065;
    this.desiredPitch = THREE.MathUtils.clamp(
      this.desiredPitch + deltaY * 0.0055,
      MIN_PITCH,
      MAX_PITCH
    );
  }

  public zoom(delta: number): void {
    this.desiredDistance = THREE.MathUtils.clamp(
      this.desiredDistance + delta,
      MIN_DISTANCE,
      MAX_DISTANCE
    );
  }

  public getYaw(): number {
    return this.yaw;
  }

  public reset(yaw = DEFAULT_YAW): void {
    this.desiredYaw = yaw;
    this.desiredPitch = DEFAULT_PITCH;
    this.desiredDistance = DEFAULT_DISTANCE;
  }

  /** Smoothly follow the target ball and interpolate orbit angles. */
  public update(followPos: THREE.Vector3, delta: number): void {
    const posLerp = 1 - Math.exp(-9 * delta);
    const orbitLerp = 1 - Math.exp(-14 * delta);

    this.target.lerp(followPos, posLerp);
    this.yaw += (this.desiredYaw - this.yaw) * orbitLerp;
    this.pitch += (this.desiredPitch - this.pitch) * orbitLerp;
    this.distance += (this.desiredDistance - this.distance) * orbitLerp;

    this.updateCameraTransform(1);
  }

  private updateCameraTransform(_alpha: number): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    const offsetX = Math.sin(this.yaw) * horiz;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * horiz;

    this.camera.position.set(
      this.target.x + offsetX,
      this.target.y + offsetY + 0.35,
      this.target.z + offsetZ
    );
    this.camera.lookAt(this.target.x, this.target.y + 0.15, this.target.z);
  }
}

