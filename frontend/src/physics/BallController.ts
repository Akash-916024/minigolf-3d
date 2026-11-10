import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';

export const BALL_RADIUS = 0.18;
const MIN_PUTT_SPEED = 0.45;
const MAX_PUTT_SPEED = 17.5;
const MAX_WORLD_SPEED = 24.0;
const BASE_LINEAR_DAMPING = 0.62;
const BASE_ANGULAR_DAMPING = 0.72;
const BASE_FRICTION = 0.5;
const REST_LINEAR_EPS = 0.09;
const REST_ANGULAR_EPS = 0.32;
const REST_HOLD_SECONDS = 0.3;
const OUT_OF_BOUNDS_MIN_Y = -3.0;
const OUT_OF_BOUNDS_MAX_Y = 22.0;
const MAX_DRIFT_DISTANCE = 75.0;
const MAX_STROKE_DURATION = 11.0;

/**
 * Controls the golf ball's Rapier rigid body, Three.js mesh sync,
 * mass-normalized velocity/force application, surface damping (fairway, ice, sand),
 * wind forces, portal cooldowns, and out-of-bounds recovery.
 */
export class BallController {
  public readonly mesh: THREE.Mesh;
  public readonly body: RAPIER.RigidBody;
  public readonly collider: RAPIER.Collider;
  public readonly colliderHandle: number;

  private readonly startPosition: THREE.Vector3;
  private readonly lastSafePosition = new THREE.Vector3();
  private restTimer = 0;
  private strokeElapsed = 0;
  private moving = false;
  private sunk = false;

  private sandOverlapCount = 0;
  private iceOverlapCount = 0;
  private portalCooldown = 0;
  private jumpCooldown = 0;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    material: THREE.Material,
    startPos: THREE.Vector3
  ) {
    this.startPosition = startPos.clone();
    this.lastSafePosition.copy(startPos);

    const geo = new THREE.SphereGeometry(BALL_RADIUS, 36, 28);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(startPos);
    scene.add(this.mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setCcdEnabled(true)
      .setLinearDamping(BASE_LINEAR_DAMPING)
      .setAngularDamping(BASE_ANGULAR_DAMPING);
    this.body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setFriction(BASE_FRICTION)
      .setRestitution(0.48)
      .setDensity(1.4)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.collider = physics.world.createCollider(colliderDesc, this.body);
    this.colliderHandle = this.collider.handle;
  }

  public isAtRest(): boolean {
    return !this.moving && !this.sunk;
  }

  public isSunk(): boolean {
    return this.sunk;
  }

  public isMoving(): boolean {
    return this.moving;
  }

  public getPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  public getHorizontalSpeed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.z);
  }

  public getSpeed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /**
   * Apply a mass-normalized putt velocity along a horizontal direction.
   * Supports fine low-power putts from 1% (0.01) up to full 100% (1.0).
   */
  public shoot(direction: THREE.Vector3, power: number): void {
    if (!this.isAtRest()) return;

    this.saveSafePosition();
    const clampedPower = Math.max(0.01, Math.min(1, power));
    const targetSpeed =
      MIN_PUTT_SPEED + Math.pow(clampedPower, 1.45) * (MAX_PUTT_SPEED - MIN_PUTT_SPEED);
    const mass = this.body.mass();

    this.body.wakeUp();
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.applyImpulse(
      {
        x: direction.x * targetSpeed * mass,
        y: 0,
        z: direction.z * targetSpeed * mass,
      },
      true
    );
    this.moving = true;
    this.restTimer = 0;
    this.strokeElapsed = 0;
  }

  /** Launch ball from a jump pad using mass-normalized target launch velocity. */
  public triggerJumpPad(launchVelocity: THREE.Vector3): boolean {
    if (this.jumpCooldown > 0 || this.sunk) return false;
    this.jumpCooldown = 0.35;
    this.moving = true;
    this.restTimer = 0;
    this.strokeElapsed = 0;
    this.body.wakeUp();

    const lv = this.body.linvel();
    this.body.setLinvel(
      {
        x: lv.x * 0.4 + launchVelocity.x,
        y: launchVelocity.y,
        z: lv.z * 0.4 + launchVelocity.z,
      },
      true
    );
    return true;
  }

  /** Apply radial velocity kick from a pinball bumper. */
  public applyBumperKick(dirX: number, dirZ: number, kickSpeed: number): void {
    if (this.sunk) return;
    const mass = this.body.mass();
    this.body.wakeUp();
    this.body.applyImpulse(
      {
        x: dirX * kickSpeed * mass,
        y: 0,
        z: dirZ * kickSpeed * mass,
      },
      true
    );
  }

  /** Apply continuous acceleration (m/s^2) from boost pads, scaled by ball mass. */
  public applyContinuousAcceleration(ax: number, ay: number, az: number, dt: number): void {
    if (this.sunk) return;
    const mass = this.body.mass();
    this.body.wakeUp();
    this.body.applyImpulse({ x: ax * mass * dt, y: ay * mass * dt, z: az * mass * dt }, true);
  }

  /** Apply aerodynamic wind acceleration strictly while the ball is airborne (jumping). */
  public applyWind(windVec: THREE.Vector3, isGrounded: boolean, dt: number): void {
    if (this.sunk || !this.moving || isGrounded) return;
    if (windVec.lengthSq() < 0.0001) return;

    const mass = this.body.mass();
    this.body.applyImpulse(
      {
        x: windVec.x * mass * dt,
        y: 0,
        z: windVec.z * mass * dt,
      },
      true
    );
  }

  /** Teleport through a paired portal while redirecting horizontal velocity. */
  public teleportThroughPortal(exitPos: THREE.Vector3, exitYaw: number): boolean {
    if (this.portalCooldown > 0 || this.sunk) return false;
    this.portalCooldown = 0.65;

    const v = this.body.linvel();
    const horizSpeed = Math.max(3.2, Math.min(12.0, Math.hypot(v.x, v.z)));
    const dirX = Math.sin(exitYaw);
    const dirZ = Math.cos(exitYaw);

    this.body.setTranslation({ x: exitPos.x, y: exitPos.y + BALL_RADIUS + 0.04, z: exitPos.z }, true);
    this.body.setLinvel({ x: dirX * horizSpeed, y: Math.max(0, v.y * 0.25), z: dirZ * horizSpeed }, true);
    this.moving = true;
    this.restTimer = 0;
    this.strokeElapsed = 0;
    return true;
  }

  public setSandOverlap(entered: boolean): void {
    this.sandOverlapCount = Math.max(0, this.sandOverlapCount + (entered ? 1 : -1));
    this.refreshSurfaceDamping();
  }

  public setIceOverlap(entered: boolean): void {
    this.iceOverlapCount = Math.max(0, this.iceOverlapCount + (entered ? 1 : -1));
    this.refreshSurfaceDamping();
  }

  public resetSurfaceState(): void {
    this.sandOverlapCount = 0;
    this.iceOverlapCount = 0;
    this.portalCooldown = 0;
    this.jumpCooldown = 0;
    this.refreshSurfaceDamping();
  }

  /** Mark ball as captured in the cup and settle it cleanly at the cup bottom. */
  public sinkIntoCup(cupCenter: THREE.Vector3): void {
    this.sunk = true;
    this.moving = false;
    this.body.setLinvel({ x: 0, y: -1.5, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setTranslation(
      { x: cupCenter.x, y: cupCenter.y - 0.14, z: cupCenter.z },
      true
    );
  }

  /** Restore ball to its last safe lie before the stroke (used by water hazards & OOB). */
  public resetToLastSafe(): void {
    this.moving = false;
    this.restTimer = 0;
    this.strokeElapsed = 0;
    this.resetSurfaceState();
    this.teleportTo(this.lastSafePosition);
  }

  /** Reset ball back to a specified or initial tee position for hole switch / replay. */
  public resetToTee(newTee?: THREE.Vector3): void {
    if (newTee) {
      this.startPosition.copy(newTee);
    }
    this.sunk = false;
    this.moving = false;
    this.restTimer = 0;
    this.strokeElapsed = 0;
    this.resetSurfaceState();
    this.lastSafePosition.copy(this.startPosition);
    this.teleportTo(this.startPosition);
  }

  /** Clamp runaway speeds, sync mesh transform, and monitor rest / OOB states. */
  public update(delta: number, isGrounded: boolean): boolean {
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - delta);
    if (this.jumpCooldown > 0) this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);

    // Clamp extreme velocities to keep simulation realistic and prevent tunneling
    const lvClamp = this.body.linvel();
    const speedSq = lvClamp.x * lvClamp.x + lvClamp.y * lvClamp.y + lvClamp.z * lvClamp.z;
    if (speedSq > MAX_WORLD_SPEED * MAX_WORLD_SPEED) {
      const scale = MAX_WORLD_SPEED / Math.sqrt(speedSq);
      this.body.setLinvel(
        { x: lvClamp.x * scale, y: lvClamp.y * scale, z: lvClamp.z * scale },
        true
      );
    }

    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    if (this.sunk) {
      return false;
    }

    const driftDist = Math.hypot(
      pos.x - this.lastSafePosition.x,
      pos.z - this.lastSafePosition.z
    );
    if (
      pos.y < OUT_OF_BOUNDS_MIN_Y ||
      pos.y > OUT_OF_BOUNDS_MAX_Y ||
      driftDist > MAX_DRIFT_DISTANCE ||
      (this.moving && this.strokeElapsed > MAX_STROKE_DURATION && !isGrounded)
    ) {
      this.resetToLastSafe();
      return true;
    }

    if (this.moving) {
      this.strokeElapsed += delta;
      const lv = this.body.linvel();
      const av = this.body.angvel();
      const linSpeed = Math.hypot(lv.x, lv.y, lv.z);
      const angSpeed = Math.hypot(av.x, av.y, av.z);

      if (isGrounded && linSpeed < REST_LINEAR_EPS && angSpeed < REST_ANGULAR_EPS) {
        this.restTimer += delta;
        if (this.restTimer >= REST_HOLD_SECONDS) {
          this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          this.moving = false;
          this.restTimer = 0;
          this.strokeElapsed = 0;
        }
      } else {
        this.restTimer = 0;
      }
    }

    return false;
  }

  private refreshSurfaceDamping(): void {
    if (this.sandOverlapCount > 0) {
      this.body.setLinearDamping(3.8);
      this.body.setAngularDamping(4.2);
      this.collider.setFriction(0.95);
    } else if (this.iceOverlapCount > 0) {
      this.body.setLinearDamping(0.06);
      this.body.setAngularDamping(0.08);
      this.collider.setFriction(0.04);
    } else {
      this.body.setLinearDamping(BASE_LINEAR_DAMPING);
      this.body.setAngularDamping(BASE_ANGULAR_DAMPING);
      this.collider.setFriction(BASE_FRICTION);
    }
  }

  private saveSafePosition(): void {
    const pos = this.body.translation();
    this.lastSafePosition.set(pos.x, pos.y + 0.02, pos.z);
  }

  private teleportTo(target: THREE.Vector3): void {
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setTranslation({ x: target.x, y: target.y, z: target.z }, true);
    this.mesh.position.copy(target);
  }
}
