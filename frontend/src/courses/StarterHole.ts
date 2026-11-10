import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CourseMaterials } from '../engine/Materials';
import { PhysicsWorld } from '../physics/PhysicsWorld';

const CUP_RADIUS = 0.36;
const CUP_DEPTH = 0.34;
const FLOOR_THICKNESS = 0.4;
const RAIL_HEIGHT = 0.38;
const RAIL_THICKNESS = 0.24;

export interface StarterHoleResult {
  teePosition: THREE.Vector3;
  cupCenter: THREE.Vector3;
  wallObjects: THREE.Object3D[];
  wallHandles: Set<number>;
  cupSensorHandle: number;
  update: (elapsed: number) => void;
}

/**
 * Builds the Phase 1 Pine Forest starter hole:
 * an L-dogleg green with a subtle rise, an angled oak bank rail,
 * surrounding pine trees, and a physically recessed cup with a waving flag.
 */
export function buildStarterHole(
  scene: THREE.Scene,
  physics: PhysicsWorld,
  materials: CourseMaterials
): StarterHoleResult {
  const wallObjects: THREE.Object3D[] = [];
  const wallHandles = new Set<number>();
  const cupCenter = new THREE.Vector3(7.5, 0, -3.0);
  const teePosition = new THREE.Vector3(0, 0.24, 6.4);

  // Surrounding parkland ground
  const parkGeo = new THREE.PlaneGeometry(160, 160);
  parkGeo.rotateX(-Math.PI / 2);
  const parkMesh = new THREE.Mesh(parkGeo, materials.roughGround);
  parkMesh.position.y = -0.41;
  parkMesh.receiveShadow = true;
  scene.add(parkMesh);

  // Helper to create static box floor or wall with synced Rapier cuboid collider
  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    options: { rotY?: number; rotX?: number; isWall?: boolean; friction?: number; restitution?: number } = {}
  ): number => {
    const rotY = options.rotY ?? 0;
    const rotX = options.rotX ?? 0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = rotY;
    mesh.rotation.x = rotX;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (options.isWall) {
      wallObjects.push(mesh);
    }

    const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(w * 0.5, h * 0.5, d * 0.5)
      .setFriction(options.friction ?? 0.45)
      .setRestitution(options.restitution ?? 0.55)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = physics.world.createCollider(colliderDesc, body);

    if (options.isWall) {
      wallHandles.add(collider.handle);
    }
    return collider.handle;
  };

  // --- Main Lane Fairway (x: -2..2, z: -5..8) ---
  addBox(4.0, FLOOR_THICKNESS, 13.0, 0, -FLOOR_THICKNESS * 0.5, 1.5, materials.fairway, {
    friction: 0.46,
    restitution: 0.15,
  });

  // Gentle speed-bump / bridge accent mid-fairway
  addBox(3.4, 0.16, 1.8, 0, -0.02, 1.6, materials.fairway, {
    rotX: 0.09,
    friction: 0.45,
    restitution: 0.15,
  });
  addBox(3.4, 0.16, 1.8, 0, -0.02, -0.15, materials.fairway, {
    rotX: -0.09,
    friction: 0.45,
    restitution: 0.15,
  });

  // --- Right Wing Fairway around recessed cup (x: 2..9.6, z: -5..-1) ---
  // Cut a square opening around (7.5, -3.0) of half-size CUP_RADIUS for physical cup drop
  const holeMinX = cupCenter.x - CUP_RADIUS;
  const holeMaxX = cupCenter.x + CUP_RADIUS;
  const holeMinZ = cupCenter.z - CUP_RADIUS;
  const holeMaxZ = cupCenter.z + CUP_RADIUS;

  // Left slab of right wing (x: 2 .. holeMinX, z: -5..-1)
  const leftW = holeMinX - 2.0;
  addBox(leftW, FLOOR_THICKNESS, 4.0, 2.0 + leftW * 0.5, -FLOOR_THICKNESS * 0.5, -3.0, materials.fairway, {
    friction: 0.46,
    restitution: 0.15,
  });

  // Right slab (x: holeMaxX .. 9.6, z: -5..-1)
  const rightW = 9.6 - holeMaxX;
  addBox(rightW, FLOOR_THICKNESS, 4.0, holeMaxX + rightW * 0.5, -FLOOR_THICKNESS * 0.5, -3.0, materials.fairway, {
    friction: 0.46,
    restitution: 0.15,
  });

  // Top slab above hole (x: holeMinX .. holeMaxX, z: -5 .. holeMinZ)
  const topD = holeMinZ - -5.0;
  addBox(CUP_RADIUS * 2, FLOOR_THICKNESS, topD, cupCenter.x, -FLOOR_THICKNESS * 0.5, -5.0 + topD * 0.5, materials.fairway, {
    friction: 0.46,
    restitution: 0.15,
  });

  // Bottom slab below hole (x: holeMinX .. holeMaxX, z: holeMaxZ .. -1.0)
  const botD = -1.0 - holeMaxZ;
  addBox(CUP_RADIUS * 2, FLOOR_THICKNESS, botD, cupCenter.x, -FLOOR_THICKNESS * 0.5, holeMaxZ + botD * 0.5, materials.fairway, {
    friction: 0.46,
    restitution: 0.15,
  });

  // Recessed cup bottom + octagonal inner wall sleeve so fast shots lip out realistically
  addBox(CUP_RADIUS * 2.2, 0.1, CUP_RADIUS * 2.2, cupCenter.x, -CUP_DEPTH - 0.05, cupCenter.z, materials.cupInterior, {
    friction: 0.8,
    restitution: 0.1,
  });
  buildCupVisualsAndWalls(scene, physics, materials, cupCenter);

  // Cup capture sensor at the bottom of the recessed cup
  const sensorBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(cupCenter.x, -0.22, cupCenter.z)
  );
  const sensorCollider = physics.world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.12, CUP_RADIUS * 0.78)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    sensorBody
  );

  // --- Wooden Oak Border Rails ---
  const railY = RAIL_HEIGHT * 0.5 - 0.02;
  // Left main wall (x = -2.12)
  addBox(RAIL_THICKNESS, RAIL_HEIGHT, 13.4, -2.12, railY, 1.5, materials.woodRail, { isWall: true, restitution: 0.75 });
  // Tee back wall (z = 8.12)
  addBox(4.48, RAIL_HEIGHT, RAIL_THICKNESS, 0, railY, 8.12, materials.woodRail, { isWall: true, restitution: 0.75 });
  // Right main lower wall (x = 2.12, z: -1..8.12)
  addBox(RAIL_THICKNESS, RAIL_HEIGHT, 9.24, 2.12, railY, 3.56, materials.woodRail, { isWall: true, restitution: 0.75 });
  // Back wall across main + right wing (z = -5.12, x: -2.24 .. 9.72)
  addBox(11.96, RAIL_HEIGHT, RAIL_THICKNESS, 3.74, railY, -5.12, materials.woodRail, { isWall: true, restitution: 0.75 });
  // Front wall of right wing (z = -0.88, x: 2.0 .. 9.72)
  addBox(7.72, RAIL_HEIGHT, RAIL_THICKNESS, 5.86, railY, -0.88, materials.woodRail, { isWall: true, restitution: 0.75 });
  // End wall behind cup (x = 9.72, z: -5.12 .. -0.88)
  addBox(RAIL_THICKNESS, RAIL_HEIGHT, 4.48, 9.72, railY, -3.0, materials.woodRail, { isWall: true, restitution: 0.75 });

  // 45-degree angled bank wall in far-left corner for satisfying trick shots
  addBox(2.6, RAIL_HEIGHT, RAIL_THICKNESS, -1.1, railY, -4.1, materials.woodRail, {
    rotY: Math.PI / 4,
    isWall: true,
    restitution: 0.85,
  });

  // Tee marker pegs
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.35 });
  [-0.9, 0.9].forEach((mx) => {
    const peg = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 12), markerMat);
    peg.position.set(mx, 0.06, teePosition.z);
    peg.castShadow = true;
    scene.add(peg);
  });

  // Decorative Pine Trees around perimeter
  populatePineTrees(scene);

  // Flagpole + waving flag
  const flagPivot = buildFlag(scene, materials, cupCenter);

  return {
    teePosition,
    cupCenter,
    wallObjects,
    wallHandles,
    cupSensorHandle: sensorCollider.handle,
    update: (elapsed: number) => {
      flagPivot.rotation.y = Math.sin(elapsed * 2.4) * 0.14;
      flagPivot.rotation.z = Math.cos(elapsed * 3.1) * 0.04;
    },
  };
}

function buildCupVisualsAndWalls(
  scene: THREE.Scene,
  physics: PhysicsWorld,
  materials: CourseMaterials,
  cupCenter: THREE.Vector3
): void {
  // Visual dark interior cylinder + stainless steel rim ring
  const holeVoid = new THREE.Mesh(
    new THREE.CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_DEPTH, 28, 1, true),
    materials.cupInterior
  );
  holeVoid.position.set(cupCenter.x, -CUP_DEPTH * 0.5, cupCenter.z);
  scene.add(holeVoid);

  const holeFloor = new THREE.Mesh(new THREE.CircleGeometry(CUP_RADIUS, 28), materials.cupInterior);
  holeFloor.rotation.x = -Math.PI / 2;
  holeFloor.position.set(cupCenter.x, -CUP_DEPTH + 0.01, cupCenter.z);
  scene.add(holeFloor);

  const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_RADIUS * 0.92, CUP_RADIUS * 1.08, 32), materials.cupMetal);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(cupCenter.x, 0.004, cupCenter.z);
  scene.add(rim);

  // 8-segment physical cup sleeve wall so corner squares don't catch the ball
  const segCount = 8;
  for (let i = 0; i < segCount; i++) {
    const angle = (i / segCount) * Math.PI * 2;
    const dist = CUP_RADIUS + 0.06;
    const wx = cupCenter.x + Math.cos(angle) * dist;
    const wz = cupCenter.z + Math.sin(angle) * dist;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(wx, -CUP_DEPTH * 0.5, wz)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle));
    const body = physics.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(0.06, CUP_DEPTH * 0.5, 0.16)
      .setFriction(0.25)
      .setRestitution(0.35);
    physics.world.createCollider(colDesc, body);
  }
}

function buildFlag(
  scene: THREE.Scene,
  materials: CourseMaterials,
  cupCenter: THREE.Vector3
): THREE.Group {
  const poleHeight = 2.35;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, poleHeight, 12),
    materials.cupMetal
  );
  pole.position.set(cupCenter.x, poleHeight * 0.5 - CUP_DEPTH, cupCenter.z);
  pole.castShadow = true;
  scene.add(pole);

  const pivot = new THREE.Group();
  pivot.position.set(cupCenter.x, poleHeight - CUP_DEPTH - 0.12, cupCenter.z);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.14);
  shape.lineTo(0.68, 0.0);
  shape.lineTo(0, -0.18);
  shape.closePath();

  const flagMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), materials.flagCloth);
  flagMesh.castShadow = true;
  pivot.add(flagMesh);
  scene.add(pivot);
  return pivot;
}

function populatePineTrees(scene: THREE.Scene): void {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3322, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.85 });

  const treeCoords: Array<[number, number, number]> = [
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
  ];

  for (const [x, z, scale] of treeCoords) {
    const group = new THREE.Group();
    group.position.set(x, -0.4, z);
    group.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8), trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    group.add(trunk);

    [
      [1.35, 2.1, 1.7],
      [1.05, 1.8, 2.75],
      [0.72, 1.4, 3.65],
    ].forEach(([r, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), leafMat);
      cone.position.y = y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    });

    scene.add(group);
  }
}

