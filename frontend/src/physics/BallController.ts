import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';

export const BALL_RADIUS = 0.18;
const MAX_IMPULSE = 14.5;
const REST_LINEAR_EPS = 0.075;
const REST_ANGULAR_EPS = 0.25;
const REST_HOLD_SECONDS = 0.32;
const OUT_OF_BOUNDS_Y = -2.5;

/**
 * Controls the golf ball's Rapier rigid body, Three.js mesh sync,
 * rest-state detection, and out-of-bounds recovery.
 */
export class BallController {
  public readonly mesh: THREE.Mesh;
  public readonly body: RAPIER.RigidBody;
  public readonly colliderHandle: number;

  private readonly startPosition: THREE.Vector3;
  private readonly lastSafePosition = new THREE.Vector3();
  private restTimer = 0;
  private moving = false;
  private sunk = false;

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
      .setLinearDamping(0.32)
      .setAngularDamping(0.45);
    this.body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setFriction(0.48)
      .setRestitution(0.52)
      .setDensity(1.4)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = physics.world.createCollider(colliderDesc, this.body);
    this.colliderHandle = collider.handle;
  }

  public isAtRest(): boolean {
    return !this.moving && !this.sunk;
  }

  public isSunk(): boolean {
    return this.sunk;
  }

  public getPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  public getHorizontalSpeed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.z);
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

  /** Reset ball back to the hole tee position for replay. */
  public resetToTee(): void {
    this.sunk = false;
    this.moving = false;
    this.restTimer = 0;
    this.lastSafePosition.copy(this.startPosition);
    this.teleportTo(this.startPosition);
  }

  /** Update mesh transform and monitor rest state / out-of-bounds. Returns true if reset OOB. */
  public update(delta: number): boolean {
    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    if (this.sunk) {
      return false;
    }

    if (pos.y < OUT_OF_BOUNDS_Y) {
      this.teleportTo(this.lastSafePosition);
      this.moving = false;
      this.restTimer = 0;
      return true;
    }

    if (this.moving) {
      const lv = this.body.linvel();
      const av = this.body.angvel();
      const linSpeed = Math.hypot(lv.x, lv.y, lv.z);
      const angSpeed = Math.hypot(av.x, av.y, av.z);

      if (linSpeed < REST_LINEAR_EPS && angSpeed < REST_ANGULAR_EPS) {
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

