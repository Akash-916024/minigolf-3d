import RAPIER from '@dimforge/rapier3d-compat';

export type CollisionHandler = (otherHandle: number, started: boolean) => void;

/**
 * Wraps Rapier3D initialization, fixed-timestep stepping, and collision dispatch.
 */
export class PhysicsWorld {
  public readonly world: RAPIER.World;
  private readonly eventQueue: RAPIER.EventQueue;
  private readonly handlers = new Map<number, CollisionHandler>();
  private accumulator = 0;
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

  /** Advance physics in deterministic 1/60s steps and emit collision callbacks. */
  public step(frameDelta: number): void {
    const clampedDelta = Math.min(frameDelta, PhysicsWorld.MAX_FRAME_DT);
    this.accumulator += clampedDelta;

    while (this.accumulator >= PhysicsWorld.FIXED_DT) {
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
    this.eventQueue.free();
    this.world.free();
  }
}

