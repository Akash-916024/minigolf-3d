import { HoleDefinition } from './CourseTypes';

const RAIL_Y = 0.17;
const RAIL_H = 0.38;
const RAIL_T = 0.24;

/**
 * Phase 2 Obstacle Showcase Course (Aligned Seam-to-Seam):
 * - Tee & Split Runway (z: 5..17, x: -2.1..2.1): Left lane has Boost Pad + 360° Crazy Looping;
 *   Right lane is an open skill bypass past a Pinball Bumper.
 * - Arena & Ice Lane (z: -9..5, x: -2.1..2.1): Pinball Bumpers, Moving Sweeper, Rotating Windmill,
 *   slick Ice surface, and angled funnel rails feeding cleanly into the curved Half-Pipe Ice Tube.
 * - Jump Deck (x: 3.9..8.1, z: -20..-15): Jump Pad launches across Water Hazard + Wind Zone onto Island.
 * - Landing Island (x: 3.2..8.8, z: -30.2..-23.4): Sand Bunker + Paired Portal.
 * - Final Green (x: 11.6..16.4, z: -33..-23): Sliding Temple Door guarding the recessed Cup.
 */
export const OBSTACLE_SHOWCASE_HOLE: HoleDefinition = {
  id: 'showcase-02',
  number: 2,
  name: 'Obstacle Arena',
  venue: 'showcase',
  venueLabel: 'Phase 2 Showcase',
  par: 5,
  tee: [0, 0.24, 15.2],
  cup: [14.0, 0, -31.0],
  slabs: [
    // Section 1: Tee & Split Approach (x: -2.1..2.1, z: 5.0..17.0)
    { pos: [0, -0.2, 11.0], size: [4.2, 0.4, 12.0], surface: 'fairway' },
    // Section 2: Loop Exit & Pinball Arena (x: -2.1..2.1, z: -3.0..5.0) - flush at z=5.0
    { pos: [0, -0.2, 1.0], size: [4.2, 0.4, 8.0], surface: 'fairway' },
    // Section 3: Ice Skating Lane (x: -2.1..2.1, z: -9.0..-3.0) - flush at z=-3.0
    { pos: [0, -0.2, -6.0], size: [4.2, 0.4, 6.0], surface: 'ice' },
    // Section 4: Jump Deck (x: 3.9..8.1, z: -20.0..-15.0) - flush with tube exit at (6, 0, -15)
    { pos: [6.0, -0.2, -17.5], size: [4.2, 0.4, 5.0], surface: 'stone' },
    // Section 5: Landing Island (x: 3.2..8.8, z: -30.2..-23.4)
    { pos: [6.0, -0.2, -26.8], size: [5.6, 0.4, 6.8], surface: 'fairway' },
    // Section 6: Final Putting Green (x: 11.6..16.4, z: -33.0..-23.0)
    { pos: [14.0, -0.2, -28.0], size: [4.8, 0.4, 10.0], surface: 'fairway', hasCupCutout: true },
  ],
  rails: [
    // Continuous outer rails for Sections 1-3 (z: -9.0..17.0, x: ±2.22)
    { pos: [-2.22, RAIL_Y, 4.0], size: [RAIL_T, RAIL_H, 26.48], style: 'wood' },
    { pos: [2.22, RAIL_Y, 4.0], size: [RAIL_T, RAIL_H, 26.48], style: 'wood' },
    // Tee back wall (z = 17.12)
    { pos: [0, RAIL_Y, 17.12], size: [4.68, RAIL_H, RAIL_T], style: 'wood' },
    // Divider rail separating Loop Lane (left) and Bypass Lane (right) from z=5.0..11.2
    { pos: [0.05, RAIL_Y, 8.1], size: [0.2, RAIL_H, 6.2], style: 'stone' },

    // Funnel rails at z=-9.0 guiding smoothly into the Ice Tube mouth (x: -0.72..0.72)
    { pos: [-1.45, RAIL_Y, -8.7], size: [1.55, RAIL_H, RAIL_T], style: 'stone', rotY: -0.36 },
    { pos: [1.45, RAIL_Y, -8.7], size: [1.55, RAIL_H, RAIL_T], style: 'stone', rotY: 0.36 },

    // Section 4 Jump Deck rails (side walls + back funnel at tube exit)
    { pos: [3.78, RAIL_Y, -17.5], size: [RAIL_T, RAIL_H, 5.24], style: 'stone' },
    { pos: [8.22, RAIL_Y, -17.5], size: [RAIL_T, RAIL_H, 5.24], style: 'stone' },
    { pos: [4.62, RAIL_Y, -14.88], size: [1.45, RAIL_H, RAIL_T], style: 'stone' },
    { pos: [7.38, RAIL_Y, -14.88], size: [1.45, RAIL_H, RAIL_T], style: 'stone' },

    // Section 5 Landing Island rails (side + back bumper wall)
    { pos: [3.08, RAIL_Y, -26.8], size: [RAIL_T, RAIL_H, 7.04], style: 'wood' },
    { pos: [8.92, RAIL_Y, -26.8], size: [RAIL_T, RAIL_H, 7.04], style: 'wood' },
    { pos: [6.0, RAIL_Y, -30.32], size: [6.08, RAIL_H, RAIL_T], style: 'bumper' },

    // Section 6 Final Green enclosure
    { pos: [11.48, RAIL_Y, -28.0], size: [RAIL_T, RAIL_H, 10.24], style: 'wood' },
    { pos: [16.52, RAIL_Y, -28.0], size: [RAIL_T, RAIL_H, 10.24], style: 'wood' },
    { pos: [14.0, RAIL_Y, -22.88], size: [5.28, RAIL_H, RAIL_T], style: 'wood' },
    { pos: [14.0, RAIL_Y, -33.12], size: [5.28, RAIL_H, RAIL_T], style: 'bumper' },
  ],
  boostPads: [
    // Left sub-lane boost accelerates straight into the 360° Crazy Looping
    { pos: [-0.95, 0, 9.0], size: [1.7, 3.6], direction: [0, -1], force: 72 },
  ],
  loops: [
    // Starts at x=-0.95, z=5.0 and exits at x=+0.85, z=5.0 directly onto Slab 2
    { origin: [-0.95, 0, 5.0], radius: 1.45, width: 1.7, lateralOffset: 1.8 },
  ],
  pinballBumpers: [
    { pos: [1.15, 0, 7.8], radius: 0.36, bounceImpulse: 6.0 },
    { pos: [-0.95, 0, 0.8], radius: 0.42, bounceImpulse: 6.4 },
    { pos: [0.95, 0, -0.4], radius: 0.42, bounceImpulse: 6.4 },
  ],
  movingObstacles: [
    { kind: 'sweeper', origin: [0, 0.24, -1.9], size: [1.5, 0.42, 0.28], axis: 'x', amplitude: 1.25, speed: 1.9, style: 'bumper' },
    { kind: 'windmill', origin: [0, 0.92, -4.6], size: [2.2, 0.26, 0.22], speed: 1.5, style: 'wood' },
    { kind: 'door', origin: [14.0, 0.24, -27.5], size: [1.9, 0.44, 0.28], axis: 'x', amplitude: 1.35, speed: 1.6, style: 'stone' },
  ],
  iceZones: [
    { pos: [0, 0, -6.0], size: [4.2, 0.4, 6.0] },
  ],
  tubes: [
    // Curved half-pipe ice chute with straight entry/exit tangents connecting z=-9.0 to (6, 0, -15.0)
    {
      points: [
        [0, 0.72, -8.8],
        [0, 0.72, -10.5],
        [3.0, 0.72, -12.0],
        [6.0, 0.72, -13.6],
        [6.0, 0.72, -15.2],
      ],
      radius: 0.72,
      enclosed: false,
      surface: 'ice',
    },
  ],
  jumpPads: [
    // Calibrated launch velocity (m/s) clearing the water chasm onto Landing Island (~7.2m range)
    { pos: [6.0, 0, -19.0], size: [2.1, 1.5], impulse: [0, 7.3, -7.8] },
  ],
  waterZones: [
    { pos: [6.0, -0.52, -21.7], size: [7.6, 0.35, 3.6] },
  ],
  windZones: [
    // Elevated exclusively above the jump chasm (y: 0.55..2.95) so table balls stay completely unaffected
    { pos: [6.0, 1.75, -21.7], size: [7.0, 2.4, 4.2], direction: [1, 0, 0.1], strength: 2.8 },
  ],
  sandZones: [
    { pos: [4.35, 0, -26.8], size: [2.0, 0.2, 3.4] },
  ],
  portals: [
    {
      entryPos: [6.0, 0.56, -29.0],
      entryYaw: 0,
      exitPos: [14.0, 0.56, -24.0],
      exitYaw: Math.PI,
      color: 0x38bdf8,
    },
  ],
  treeCoords: [
    [-5.8, 14.0, 1.1],
    [-6.2, 4.0, 1.25],
    [-5.4, -7.0, 1.0],
    [6.6, 7.5, 1.15],
    [11.4, -15.5, 1.2],
    [19.2, -23.5, 1.15],
    [19.5, -33.0, 1.25],
    [9.8, -34.5, 1.1],
  ],
};
