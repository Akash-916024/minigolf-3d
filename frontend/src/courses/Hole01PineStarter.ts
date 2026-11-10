import { HoleDefinition } from './CourseTypes';

const RAIL_Y = 0.17;
const RAIL_H = 0.38;
const RAIL_T = 0.24;

/**
 * Hole 1: Pine Forest Dogleg migrated to the declarative Phase 2 CourseTypes schema.
 */
export const HOLE_01_PINE_STARTER: HoleDefinition = {
  id: 'pine-01',
  number: 1,
  name: 'Pine Dogleg',
  venue: 'pine-forest',
  venueLabel: 'Pine Forest',
  par: 3,
  tee: [0, 0.24, 6.4],
  cup: [7.5, 0, -3.0],
  slabs: [
    // Main tee lane
    { pos: [0, -0.2, 1.5], size: [4.0, 0.4, 13.0], surface: 'fairway' },
    // Gentle mid-fairway rise
    { pos: [0, -0.02, 1.6], size: [3.4, 0.16, 1.8], surface: 'fairway', rotX: 0.09 },
    { pos: [0, -0.02, -0.15], size: [3.4, 0.16, 1.8], surface: 'fairway', rotX: -0.09 },
    // Right green wing with recessed cup cutout
    { pos: [5.8, -0.2, -3.0], size: [7.6, 0.4, 4.0], surface: 'fairway', hasCupCutout: true },
  ],
  rails: [
    { pos: [-2.12, RAIL_Y, 1.5], size: [RAIL_T, RAIL_H, 13.4], style: 'wood' },
    { pos: [0, RAIL_Y, 8.12], size: [4.48, RAIL_H, RAIL_T], style: 'wood' },
    { pos: [2.12, RAIL_Y, 3.56], size: [RAIL_T, RAIL_H, 9.24], style: 'wood' },
    { pos: [3.74, RAIL_Y, -5.12], size: [11.96, RAIL_H, RAIL_T], style: 'wood' },
    { pos: [5.86, RAIL_Y, -0.88], size: [7.72, RAIL_H, RAIL_T], style: 'wood' },
    { pos: [9.72, RAIL_Y, -3.0], size: [RAIL_T, RAIL_H, 4.48], style: 'wood' },
    // 45° angled bank rail
    { pos: [-1.1, RAIL_Y, -4.1], size: [2.6, RAIL_H, RAIL_T], style: 'wood', rotY: Math.PI / 4, restitution: 0.85 },
  ],
  treeCoords: [
    [-6.5, 7.0, 1.05],
    [-7.2, 0.5, 1.25],
    [-6.0, -7.8, 0.95],
    [1.2, -9.2, 1.15],
    [8.4, -9.4, 1.3],
    [13.4, -4.5, 1.1],
    [12.8, 2.2, 0.95],
    [6.2, 4.8, 1.2],
    [5.8, 10.5, 1.0],
    [-4.8, 11.8, 1.15],
  ],
};
