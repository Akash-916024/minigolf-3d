import { HoleDefinition } from './CourseTypes';

const RAIL_Y = 0.17;
const RAIL_H = 0.38;
const RAIL_T = 0.24;

/**
 * Phase 2 Obstacle Showcase Course:
 * Exercises boost pads, 360° Crazy Looping, pinball bumpers, moving sweeper,
 * slick ice + curved half-pipe ice tube, jump pad over water with wind drift,
 * sand bunker, paired portal, sliding door, and bumper walls in one playable hole.
 */
export const OBSTACLE_SHOWCASE_HOLE: HoleDefinition = {
  id: 'showcase-02',
  number: 2,
  name: 'Obstacle Arena',
  venue: 'showcase',
  venueLabel: 'Phase 2 Showcase',
  par: 5,
  tee: [0, 0.24, 15.4],
  cup: [14.5, 0, -31.5],
  globalWind: { x: 0.45, z: -0.25, strength: 1.2 },
  slabs: [
    // Section 1: Tee & Boost Runway into Crazy Looping
    { pos: [0, -0.2, 11.4], size: [4.2, 0.4, 11.2], surface: 'fairway' },
    // Section 2: Loop Exit + Pinball Bumpers + Sweeper
    { pos: [0.9, -0.2, 1.9], size: [4.2, 0.4, 8.2], surface: 'fairway' },
    // Section 3: Ice Skating Lane leading into Half-Pipe Ice Tube
    { pos: [0.9, -0.2, -5.8], size: [4.2, 0.4, 7.2], surface: 'ice' },
    // Section 4: Launch Deck for Jump Pad over Water Hazard
    { pos: [6.5, -0.2, -16.5], size: [4.2, 0.4, 5.4], surface: 'stone' },
    // Section 5: Island Landing with Sand Bunker & Entry Portal
    { pos: [6.5, -0.2, -28.0], size: [5.6, 0.4, 6.8], surface: 'fairway' },
    // Section 6: Final Green with Sliding Door & Cup
    { pos: [14.5, -0.2, -28.5], size: [4.6, 0.4, 10.2], surface: 'fairway', hasCupCutout: true },
  ],
  rails: [
    // Section 1 rails
    { pos: [-2.22, RAIL_Y, 11.4], size: [RAIL_T, RAIL_H, 11.4], style: 'wood' },
    { pos: [2.22, RAIL_Y, 11.4], size: [RAIL_T, RAIL_H, 11.4], style: 'wood' },
    { pos: [0, RAIL_Y, 17.12], size: [4.68, RAIL_H, RAIL_T], style: 'wood' },

    // Section 2 bumper walls
    { pos: [-1.32, RAIL_Y, 1.9], size: [RAIL_T, RAIL_H, 8.4], style: 'bumper' },
    { pos: [3.12, RAIL_Y, 1.9], size: [RAIL_T, RAIL_H, 8.4], style: 'bumper' },

    // Section 3 ice rails
    { pos: [-1.32, RAIL_Y, -5.8], size: [RAIL_T, RAIL_H, 7.4], style: 'stone' },
    { pos: [3.12, RAIL_Y, -5.8], size: [RAIL_T, RAIL_H, 7.4], style: 'stone' },

    // Section 4 jump deck side rails (front open for jump)
    { pos: [4.28, RAIL_Y, -16.5], size: [RAIL_T, RAIL_H, 5.6], style: 'stone' },
    { pos: [8.72, RAIL_Y, -16.5], size: [RAIL_T, RAIL_H, 5.6], style: 'stone' },

    // Section 5 landing island side & back rails
    { pos: [3.58, RAIL_Y, -28.0], size: [RAIL_T, RAIL_H, 7.0], style: 'wood' },
    { pos: [9.42, RAIL_Y, -28.0], size: [RAIL_T, RAIL_H, 7.0], style: 'wood' },
    { pos: [6.5, RAIL_Y, -31.52], size: [6.08, RAIL_H, RAIL_T], style: 'bumper' },

    // Section 6 final green enclosure
    { pos: [12.08, RAIL_Y, -28.5], size: [RAIL_T, RAIL_H, 10.4], style: 'wood' },
    { pos: [16.92, RAIL_Y, -28.5], size: [RAIL_T, RAIL_H, 10.4], style: 'wood' },
    { pos: [14.5, RAIL_Y, -23.28], size: [5.08, RAIL_H, RAIL_T], style: 'wood' },
    { pos: [14.5, RAIL_Y, -33.72], size: [5.08, RAIL_H, RAIL_T], style: 'bumper' },
  ],
  boostPads: [
    { pos: [0, 0, 9.2], size: [1.9, 3.0], direction: [0, -1], force: 38 },
  ],
  loops: [
    { origin: [0, 0, 5.8], radius: 2.25, width: 2.1, lateralOffset: 0.9 },
  ],
  pinballBumpers: [
    { pos: [0.05, 0, 1.5], radius: 0.42, bounceImpulse: 6.4 },
    { pos: [1.75, 0, 0.3], radius: 0.42, bounceImpulse: 6.4 },
  ],
  movingObstacles: [
    // Sweeper in Section 2
    { kind: 'sweeper', origin: [0.9, 0.24, -1.2], size: [1.45, 0.42, 0.28], axis: 'x', amplitude: 1.15, speed: 2.0, style: 'bumper' },
    // Rotating Windmill guarding Section 3 entry
    { kind: 'windmill', origin: [0.9, 0.95, -4.4], size: [2.2, 0.28, 0.22], speed: 1.55, style: 'wood' },
    // Sliding Temple Door guarding the final cup
    { kind: 'door', origin: [14.5, 0.24, -28.0], size: [1.8, 0.44, 0.28], axis: 'x', amplitude: 1.25, speed: 1.65, style: 'stone' },
  ],
  iceZones: [
    { pos: [0.9, 0, -5.8], size: [4.2, 0.4, 7.2] },
  ],
  tubes: [
    // Curved half-pipe ice chute guiding from Section 3 to Section 4 launch deck
    {
      points: [
        [0.9, 0.72, -9.3],
        [1.4, 0.72, -11.4],
        [4.2, 0.72, -12.6],
        [6.5, 0.72, -14.0],
      ],
      radius: 0.72,
      enclosed: false,
      surface: 'ice',
    },
  ],
  jumpPads: [
    { pos: [6.5, 0, -18.2], size: [2.0, 1.5], impulse: [0, 9.2, -7.8] },
  ],
  waterZones: [
    { pos: [6.5, -0.52, -21.9], size: [8.0, 0.35, 5.4] },
  ],
  windZones: [
    { pos: [6.5, 1.6, -21.9], size: [6.8, 3.8, 5.4], direction: [1, 0, 0.15], strength: 2.1 },
  ],
  sandZones: [
    { pos: [4.85, 0, -28.0], size: [2.0, 0.2, 3.4] },
  ],
  portals: [
    {
      entryPos: [6.5, 0.56, -30.3],
      entryYaw: 0,
      exitPos: [14.5, 0.56, -24.4],
      exitYaw: Math.PI,
      color: 0x38bdf8,
    },
  ],
  treeCoords: [
    [-5.5, 14.0, 1.1],
    [-6.2, 4.0, 1.25],
    [-5.4, -7.0, 1.0],
    [6.8, 7.5, 1.15],
    [11.5, -15.5, 1.2],
    [19.5, -24.0, 1.15],
    [19.8, -33.5, 1.25],
    [10.2, -35.5, 1.1],
  ],
};
