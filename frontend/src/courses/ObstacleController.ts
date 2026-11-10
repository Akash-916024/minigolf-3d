import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { AudioEngine } from '../engine/AudioEngine';
import { ParticleSystem } from '../engine/ParticleSystem';
import { BallController, BALL_RADIUS } from '../physics/BallController';

export interface KinematicEntry {
  kind: 'door' | 'sweeper' | 'windmill' | 'platform';
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  origin: THREE.Vector3;
  axis: 'x' | 'y' | 'z';
  amplitude: number;
  speed: number;
  phase: number;
}

export interface BoostZoneEntry {
  direction: THREE.Vector2;
  force: number;
}

export interface WindZoneEntry {
  direction: THREE.Vector3;
  strength: number;
}

export interface PinballBumperEntry {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  bounceImpulse: number;
  pulse: number;
}

export interface PortalEntry {
  mesh: THREE.Mesh;
  exitPos: THREE.Vector3;
  exitYaw: number;
  color: number;
}

export interface JumpPadEntry {
  mesh: THREE.Mesh;
  baseY: number;
  impulse: THREE.Vector3;
  bounceTimer: number;
}

/**
 * Runtime controller for kinematic obstacles, sensor triggers (jump pads,
 * boost strips, portals, sand, ice, water, wind zones), and pinball bumpers.
 */
export class ObstacleController {
  public readonly kinematics: KinematicEntry[] = [];
  public readonly jumpPads = new Map<number, JumpPadEntry>();
  public readonly boostZones = new Map<number, BoostZoneEntry>();
  public readonly activeBoosts = new Set<number>();
  public readonly windZones = new Map<number, WindZoneEntry>();
  public readonly activeWindZones = new Set<number>();
  public readonly portals = new Map<number, PortalEntry>();
  public readonly bumpers = new Map<number, PinballBumperEntry>();
  public readonly waterHandles = new Set<number>();
  public readonly sandHandles = new Set<number>();
  public readonly iceHandles = new Set<number>();

  private readonly globalWind = new THREE.Vector3();
  private readonly tempWind = new THREE.Vector3();
  private readonly tempPos = new THREE.Vector3();
  private readonly qTemp = new THREE.Quaternion();
  private readonly eulerTemp = new THREE.Euler();

  constructor(globalWind?: { x: number; z: number; strength: number }) {
    if (globalWind && globalWind.strength > 0) {
      this.globalWind.set(globalWind.x, 0, globalWind.z).normalize().multiplyScalar(globalWind.strength);
    }
  }

  public getEffectiveWind(out = new THREE.Vector3()): THREE.Vector3 {
    out.copy(this.globalWind);
    for (const handle of this.activeWindZones) {
      const zone = this.windZones.get(handle);
      if (zone) {
        out.addScaledVector(zone.direction, zone.strength);
      }
    }
    return out;
  }

  /** Step kinematic rigid bodies and apply continuous wind/boost forces before Rapier step. */
  public onPhysicsStep(
    fixedDt: number,
    elapsedPhysics: number,
    ball: BallController,
    isGrounded: boolean
  ): void {
    for (const k of this.kinematics) {
      if (k.kind === 'windmill') {
        const angle = elapsedPhysics * k.speed + k.phase;
        this.eulerTemp.set(0, 0, angle);
        this.qTemp.setFromEuler(this.eulerTemp);
        k.body.setNextKinematicRotation({
          x: this.qTemp.x,
          y: this.qTemp.y,
          z: this.qTemp.z,
          w: this.qTemp.w,
        });
      } else {
        const offset = Math.sin(elapsedPhysics * k.speed + k.phase) * k.amplitude;
        const x = k.origin.x + (k.axis === 'x' ? offset : 0);
        const y = k.origin.y + (k.axis === 'y' ? offset : 0);
        const z = k.origin.z + (k.axis === 'z' ? offset : 0);
        k.body.setNextKinematicTranslation({ x, y, z });
      }
    }

    // Apply boost pad acceleration while ball overlaps boost sensor
    for (const handle of this.activeBoosts) {
      const boost = this.boostZones.get(handle);
      if (boost) {
        ball.applyContinuousForce(
          boost.direction.x * boost.force,
          0,
          boost.direction.y * boost.force,
          fixedDt
        );
      }
    }

    // Apply global + localized wind zone forces
    const wind = this.getEffectiveWind(this.tempWind);
    ball.applyWind(wind, isGrounded, fixedDt);
  }

  /** Sync kinematic visual meshes and animate jump pads / bumpers / portals. */
  public updateVisuals(delta: number, elapsed: number): void {
    for (const k of this.kinematics) {
      const pos = k.body.translation();
      const rot = k.body.rotation();
      k.mesh.position.set(pos.x, pos.y, pos.z);
      k.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }

    for (const pad of this.jumpPads.values()) {
      if (pad.bounceTimer > 0) {
        pad.bounceTimer = Math.max(0, pad.bounceTimer - delta);
        const lift = Math.sin((pad.bounceTimer / 0.28) * Math.PI) * 0.14;
        pad.mesh.position.y = pad.baseY + lift;
      } else {
        pad.mesh.position.y = pad.baseY;
      }
    }

    for (const bumper of this.bumpers.values()) {
      if (bumper.pulse > 0) {
        bumper.pulse = Math.max(0, bumper.pulse - delta * 4.5);
        bumper.mesh.scale.setScalar(1 + bumper.pulse * 0.25);
      } else {
        bumper.mesh.scale.setScalar(1);
      }
    }

    for (const portal of this.portals.values()) {
      portal.mesh.rotation.z = elapsed * 1.8;
    }
  }

  /** Handle Rapier collision enter/exit between the ball and any obstacle collider. */
  public handleBallCollision(
    otherHandle: number,
    started: boolean,
    ball: BallController,
    audio: AudioEngine,
    particles: ParticleSystem,
    onWaterPenalty: () => void
  ): boolean {
    if (this.boostZones.has(otherHandle)) {
      if (started) {
        this.activeBoosts.add(otherHandle);
        audio.playBoostPad();
      } else {
        this.activeBoosts.delete(otherHandle);
      }
      return true;
    }

    if (this.windZones.has(otherHandle)) {
      if (started) this.activeWindZones.add(otherHandle);
      else this.activeWindZones.delete(otherHandle);
      return true;
    }

    if (this.sandHandles.has(otherHandle)) {
      ball.setSandOverlap(started);
      if (started && ball.getSpeed() > 1.2) {
        audio.playSandTrap();
        particles.spawnSandPuff(ball.getPosition(this.tempPos));
      }
      return true;
    }

    if (this.iceHandles.has(otherHandle)) {
      ball.setIceOverlap(started);
      return true;
    }

    if (!started) return false;

    const jumpPad = this.jumpPads.get(otherHandle);
    if (jumpPad) {
      if (ball.triggerJumpPad(jumpPad.impulse)) {
        jumpPad.bounceTimer = 0.28;
        audio.playJumpPad();
        particles.spawnBurst(ball.getPosition(this.tempPos), 0x34d399, 12, 3.8);
      }
      return true;
    }

    const portal = this.portals.get(otherHandle);
    if (portal) {
      if (ball.teleportThroughPortal(portal.exitPos, portal.exitYaw)) {
        audio.playPortalWarp();
        particles.spawnBurst(portal.exitPos, portal.color, 18, 4.5);
      }
      return true;
    }

    const bumper = this.bumpers.get(otherHandle);
    if (bumper) {
      const bPos = ball.getPosition(this.tempPos);
      const pushDir = bPos.clone().sub(bumper.center).setY(0);
      if (pushDir.lengthSq() > 0.0001) {
        pushDir.normalize();
      } else {
        pushDir.set(0, 0, 1);
      }
      ball.body.wakeUp();
      ball.body.applyImpulse(
        {
          x: pushDir.x * bumper.bounceImpulse,
          y: 0,
          z: pushDir.z * bumper.bounceImpulse,
        },
        true
      );
      bumper.pulse = 1;
      audio.playBumperHit();
      particles.spawnBurst(
        bPos.clone().setY(bPos.y + BALL_RADIUS * 0.2),
        0xfbbf24,
        10,
        3.2
      );
      return true;
    }

    if (this.waterHandles.has(otherHandle)) {
      const bPos = ball.getPosition(this.tempPos);
      particles.spawnSplash(bPos);
      audio.playWaterSplash();
      ball.resetToLastSafe();
      onWaterPenalty();
      return true;
    }

    return false;
  }
}
