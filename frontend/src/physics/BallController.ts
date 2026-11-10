import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';

export const BALL_RADIUS = 0.18;
const MAX_IMPULSE = 14.5;
const BASE_LINEAR_DAMPING = 0.32;
const BASE_ANGULAR_DAMPING = 0.45;
const BASE_FRICTION = 0.48;
const REST_LINEAR_EPS = 0.085;
const REST_ANGULAR_EPS = 0.28;
const REST_HOLD_SECONDS = 0.32;
const OUT_OF_BOUNDS_Y = -3.2;

/**
 * Controls the golf ball's Rapier rigid body, Three.js mesh sync,
 * dynamic surface friction/damping (fairway, ice, sand), wind forces,
 * portal cooldowns, and out-of-bounds recovery.
 */
export class BallController {
  public readonly mesh: THREE.Mesh;
  public readonly body: RAPIER.RigidBody;
  public readonly collider: RAPIER.Collider;
  public readonly colliderHandle: number;

  private readonly startPosition: THREE.Vector3;
  private readonly lastSafePosition = new THREE.Vector3();
  private restTimer = 0;
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
      .setRestitution(0.52)
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

  /** Apply an impulse along a horizontal direction scaled by normalized power (0..1). */
  public shoot(direction: THREE.Vector3, power: number): void {
    if (!this.isAtRest()) return;

    this.saveSafePosition();
    const clampedPower = Math.max(0.03, Math.min(1, power));
    const impulseMag = clampedPower * MAX_IMPULSE;

    this.body.wakeUp();
    this.body.applyImpulse(
      {
        x: direction.x * impulseMag,
        y: 0,
        z: direction.z * impulseMag,
      },
      true
    );
    this.moving = true;
    this.restTimer = 0;
  }

  /** Launch ball from a jump pad if cooldown allows. */
  public triggerJumpPad(impulse: THREE.Vector3): boolean {
    if (this.jumpCooldown > 0 || this.sunk) return false;
    this.jumpCooldown = 0.35;
    this.moving = true;
    this.restTimer = 0;
    this.body.wakeUp();

    const lv = this.body.linvel();
    // Reset downward velocity so jumps feel crisp even when descending a slope
    if (lv.y < 0) {
      this.body.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
    }
    this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    return true;
  }

  /** Apply continuous directional acceleration from boost pads or wind zones. */
  public applyContinuousForce(fx: number, fy: number, fz: number, dt: number): void {
    if (this.sunk) return;
    this.body.wakeUp();
    this.body.applyImpulse({ x: fx * dt, y: fy * dt, z: fz * dt }, true);
  }

  /** Apply aerodynamic wind force (stronger while airborne, gentler on turf). */
  public applyWind(windVec: THREE.Vector3, isGrounded: boolean, dt: number): void {
    if (this.sunk || !this.moving) return;
    if (windVec.lengthSq() < 0.0001) return;

    const factor = isGrounded ? 0.24 : 1.05;
    this.body.applyImpulse(
      {
        x: windVec.x * factor * dt,
        y: 0,
        z: windVec.z * factor * dt,
      },
      true
    );
  }

  /** Teleport through a paired portal while redirecting horizontal velocity. */
  public teleportThroughPortal(exitPos: THREE.Vector3, exitYaw: number): boolean {
    if (this.portalCooldown > 0 || this.sunk) return false;
    this.portalCooldown = 0.65;

    const v = this.body.linvel();
    const horizSpeed = Math.max(2.6, Math.hypot(v.x, v.z));
    const dirX = Math.sin(exitYaw);
    const dirZ = Math.cos(exitYaw);

    this.body.setTranslation({ x: exitPos.x, y: exitPos.y + BALL_RADIUS + 0.04, z: exitPos.z }, true);
    this.body.setLinvel({ x: dirX * horizSpeed, y: Math.max(0, v.y * 0.4), z: dirZ * horizSpeed }, true);
    this.moving = true;
    this.restTimer = 0;
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
    this.resetSurfaceState();
    this.lastSafePosition.copy(this.startPosition);
    this.teleportTo(this.startPosition);
  }

  /** Update mesh transform and monitor rest state / out-of-bounds. Returns true if reset OOB. */
  public update(delta: number, isGrounded: boolean): boolean {
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - delta);
    if (this.jumpCooldown > 0) this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);

    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    if (this.sunk) {
      return false;
    }

    if (pos.y < OUT_OF_BOUNDS_Y) {
      this.resetToLastSafe();
      return true;
    }

    if (this.moving) {
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
      this.body.setLinearDamping(0.05);
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
