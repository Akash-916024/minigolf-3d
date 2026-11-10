export type VenueId =
  | 'pine-forest'
  | 'rocky-mountains'
  | 'snowy-valley'
  | 'mayan-jungle'
  | 'windy-cliffs'
  | 'sakura-garden'
  | 'showcase';

export type SurfaceType = 'fairway' | 'ice' | 'sand' | 'wood' | 'stone';
export type RailStyle = 'wood' | 'stone' | 'bumper';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface SlabDef {
  pos: [number, number, number];
  size: [number, number, number];
  surface?: SurfaceType;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  /** Set true on the flat slab that contains the recessed cup hole. */
  hasCupCutout?: boolean;
}

export interface RailDef {
  pos: [number, number, number];
  size: [number, number, number];
  style?: RailStyle;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  restitution?: number;
}

export interface LoopDef {
  /** Center of the bottom entry of the loop. */
  origin: [number, number, number];
  radius: number;
  width: number;
  /** Lateral offset across the 360° helix so exit lane clears entry lane. */
  lateralOffset: number;
  yaw?: number;
}

export interface TubeDef {
  points: [number, number, number][];
  radius: number;
  enclosed?: boolean;
  surface?: 'ice' | 'stone';
}

export interface JumpPadDef {
  pos: [number, number, number];
  size: [number, number];
  impulse: [number, number, number];
  yaw?: number;
}

export interface BoostPadDef {
  pos: [number, number, number];
  size: [number, number];
  /** World-space horizontal acceleration vector. */
  direction: [number, number];
  force: number;
  yaw?: number;
}

export interface PinballBumperDef {
  pos: [number, number, number];
  radius: number;
  height?: number;
  bounceImpulse?: number;
}

export interface MovingObstacleDef {
  kind: 'door' | 'sweeper' | 'windmill' | 'platform';
  origin: [number, number, number];
  size: [number, number, number];
  axis?: 'x' | 'y' | 'z';
  amplitude?: number;
  speed: number;
  phase?: number;
  style?: RailStyle;
}

export interface PortalPairDef {
  entryPos: [number, number, number];
  entryYaw?: number;
  exitPos: [number, number, number];
  exitYaw: number;
  color?: number;
}

export interface ZoneDef {
  pos: [number, number, number];
  size: [number, number, number];
  yaw?: number;
}

export interface WindZoneDef extends ZoneDef {
  direction: [number, number, number];
  strength: number;
}

export interface HoleDefinition {
  id: string;
  number: number;
  name: string;
  venue: VenueId;
  venueLabel: string;
  par: number;
  tee: [number, number, number];
  cup: [number, number, number];
  globalWind?: { x: number; z: number; strength: number };
  slabs: SlabDef[];
  rails: RailDef[];
  loops?: LoopDef[];
  tubes?: TubeDef[];
  jumpPads?: JumpPadDef[];
  boostPads?: BoostPadDef[];
  pinballBumpers?: PinballBumperDef[];
  movingObstacles?: MovingObstacleDef[];
  portals?: PortalPairDef[];
  waterZones?: ZoneDef[];
  sandZones?: ZoneDef[];
  iceZones?: ZoneDef[];
  windZones?: WindZoneDef[];
  treeCoords?: Array<[number, number, number]>;
}
