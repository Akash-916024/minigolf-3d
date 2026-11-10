import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export type CollisionHandler = (otherHandle: number, started: boolean) => void;
export type FixedStepHook = (fixedDt: number, elapsedPhysics: number) => void;

/**
 * Wraps Rapier3D initialization, deterministic fixed-timestep stepping,
 * dynamic rigid-body cleanup, ground raycasting, and collision dispatch.
 */
export class PhysicsWorld {
  public readonly world: RAPIER.World;
  private readonly eventQueue: RAPIER.EventQueue;
  private readonly handlers = new Map<number, CollisionHandler>();
  private readonly stepHooks = new Set<FixedStepHook>();
  private accumulator = 0;
  private elapsedPhysics = 0;
  private static readonly FIXED_DT = 1 / 60;
  private static readonly MAX_FRAME_DT = 0.05;

  private constructor(world: RAPIER.World, eventQueue: RAPIER.EventQueue) {
    this.world = world;
    this.eventQueue = eventQueue;
  }

  public static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0.0, y: -15.5, z: 0.0 });
    const eventQueue = new RAPIER.EventQueue(true);
    return new PhysicsWorld(world, eventQueue);
  }

  /** Register a collision listener for a specific collider handle. */
  public onColliderEvent(handle: number, handler: CollisionHandler): void {
    this.handlers.set(handle, handler);
  }

  public unregisterCollider(handle: number): void {
    this.handlers.delete(handle);
  }

  /** Register a hook invoked before each 1/60s Rapier physics step. */
  public addStepHook(hook: FixedStepHook): () => void {
    this.stepHooks.add(hook);
    return () => this.stepHooks.delete(hook);
  }

  /** Remove a rigid body and its attached colliders cleanly when unloading a hole. */
  public removeRigidBody(body: RAPIER.RigidBody): void {
    for (let i = 0; i < body.numColliders(); i++) {
      this.handlers.delete(body.collider(i).handle);
    }
    this.world.removeRigidBody(body);
  }

  /** Check whether a sphere at `pos` is resting on or very close to a solid surface. */
  public isGrounded(pos: THREE.Vector3, radius: number): boolean {
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(
      ray,
      radius + 0.09,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC
    );
    return hit !== null;
  }

  /** Advance physics in deterministic 1/60s steps and emit collision callbacks. */
  public step(frameDelta: number): void {
    const clampedDelta = Math.min(frameDelta, PhysicsWorld.MAX_FRAME_DT);
    this.accumulator += clampedDelta;

    while (this.accumulator >= PhysicsWorld.FIXED_DT) {
      this.elapsedPhysics += PhysicsWorld.FIXED_DT;
      for (const hook of this.stepHooks) {
        hook(PhysicsWorld.FIXED_DT, this.elapsedPhysics);
      }

      this.world.step(this.eventQueue);
      this.eventQueue.drainCollisionEvents((h1, h2, started) => {
        const cb1 = this.handlers.get(h1);
        if (cb1) cb1(h2, started);
        const cb2 = this.handlers.get(h2);
        if (cb2) cb2(h1, started);
      });
      this.accumulator -= PhysicsWorld.FIXED_DT;
    }
  }

  public dispose(): void {
    this.handlers.clear();
    this.stepHooks.clear();
    this.eventQueue.free();
    this.world.free();
  }
}
