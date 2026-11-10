import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CourseMaterials } from '../engine/Materials';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import {
  HoleDefinition,
  RailStyle,
  SlabDef,
  SurfaceType,
} from './CourseTypes';
import { buildLoopGeometry, buildSplineTubeGeometry } from './GeometryHelpers';
import { ObstacleController } from './ObstacleController';

const CUP_RADIUS = 0.36;
const CUP_DEPTH = 0.34;

export interface BuiltCourse {
  definition: HoleDefinition;
  teePosition: THREE.Vector3;
  cupCenter: THREE.Vector3;
  wallObjects: THREE.Object3D[];
  wallHandles: Set<number>;
  cupSensorHandle: number;
  obstacles: ObstacleController;
  updateVisuals: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Compiles any declarative HoleDefinition into Three.js meshes,
 * Rapier3D static/kinematic/trimesh colliders, and an ObstacleController,
 * tracking all resources for clean disposal on hole switch.
 */
export function buildCourseFromDefinition(
  def: HoleDefinition,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  materials: CourseMaterials
): BuiltCourse {
  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const createdBodies: RAPIER.RigidBody[] = [];
  const createdGeometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];
  const wallObjects: THREE.Object3D[] = [];
  const wallHandles = new Set<number>();

  const teePosition = new THREE.Vector3(...def.tee);
  const cupCenter = new THREE.Vector3(...def.cup);
  const obstacles = new ObstacleController(def.globalWind);

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    createdGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };

  // Surrounding parkland ground
  const parkGeo = trackGeo(new THREE.PlaneGeometry(240, 240));
  parkGeo.rotateX(-Math.PI / 2);
  const parkMesh = new THREE.Mesh(parkGeo, materials.roughGround);
  parkMesh.position.y = -0.65;
  parkMesh.receiveShadow = true;
  rootGroup.add(parkMesh);

  const surfaceMat = (surface?: SurfaceType): THREE.Material => {
    switch (surface) {
      case 'ice':
        return materials.ice;
      case 'sand':
        return materials.sand;
      case 'wood':
        return materials.woodRail;
      case 'stone':
        return materials.stoneRail;
      default:
        return materials.fairway;
    }
  };

  const railMat = (style?: RailStyle): THREE.Material => {
    switch (style) {
      case 'stone':
        return materials.stoneRail;
      case 'bumper':
        return materials.bumper;
      default:
        return materials.woodRail;
    }
  };

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    options: {
      rotX?: number;
      rotY?: number;
      rotZ?: number;
      isWall?: boolean;
      friction?: number;
      restitution?: number;
    } = {}
  ): number => {
    const geo = trackGeo(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(options.rotX ?? 0, options.rotY ?? 0, options.rotZ ?? 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    if (options.isWall) wallObjects.push(mesh);

    const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = physics.world.createRigidBody(bodyDesc);
    createdBodies.push(body);

    const colDesc = RAPIER.ColliderDesc.cuboid(w * 0.5, h * 0.5, d * 0.5)
      .setFriction(options.friction ?? 0.45)
      .setRestitution(options.restitution ?? 0.55)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const col = physics.world.createCollider(colDesc, body);
    if (options.isWall) wallHandles.add(col.handle);
    return col.handle;
  };

  const buildCupSlab = (slab: SlabDef): number => {
    const [sx, sy, sz] = slab.pos;
    const [w, h, d] = slab.size;
    const mat = surfaceMat(slab.surface);
    const minX = sx - w * 0.5;
    const maxX = sx + w * 0.5;
    const minZ = sz - d * 0.5;
    const maxZ = sz + d * 0.5;

    const holeMinX = cupCenter.x - CUP_RADIUS;
    const holeMaxX = cupCenter.x + CUP_RADIUS;
    const holeMinZ = cupCenter.z - CUP_RADIUS;
    const holeMaxZ = cupCenter.z + CUP_RADIUS;

    const friction = slab.surface === 'ice' ? 0.04 : 0.46;

    const leftW = holeMinX - minX;
    if (leftW > 0.01) addBox(leftW, h, d, minX + leftW * 0.5, sy, sz, mat, { friction, restitution: 0.15 });

    const rightW = maxX - holeMaxX;
    if (rightW > 0.01) addBox(rightW, h, d, holeMaxX + rightW * 0.5, sy, sz, mat, { friction, restitution: 0.15 });

    const topD = holeMinZ - minZ;
    if (topD > 0.01) addBox(CUP_RADIUS * 2, h, topD, cupCenter.x, sy, minZ + topD * 0.5, mat, { friction, restitution: 0.15 });

    const botD = maxZ - holeMaxZ;
    if (botD > 0.01) addBox(CUP_RADIUS * 2, h, botD, cupCenter.x, sy, holeMaxZ + botD * 0.5, mat, { friction, restitution: 0.15 });

    // Cup floor + octagonal sleeve + visual rim
    addBox(CUP_RADIUS * 2.2, 0.1, CUP_RADIUS * 2.2, cupCenter.x, cupCenter.y - CUP_DEPTH - 0.05, cupCenter.z, materials.cupInterior, {
      friction: 0.8,
      restitution: 0.1,
    });

    const holeVoid = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_DEPTH, 28, 1, true)),
      materials.cupInterior
    );
    holeVoid.position.set(cupCenter.x, cupCenter.y - CUP_DEPTH * 0.5, cupCenter.z);
    rootGroup.add(holeVoid);

    const holeFloor = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(CUP_RADIUS, 28)), materials.cupInterior);
    holeFloor.rotation.x = -Math.PI / 2;
    holeFloor.position.set(cupCenter.x, cupCenter.y - CUP_DEPTH + 0.01, cupCenter.z);
    rootGroup.add(holeFloor);

    const rim = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(CUP_RADIUS * 0.92, CUP_RADIUS * 1.08, 32)),
      materials.cupMetal
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(cupCenter.x, cupCenter.y + 0.004, cupCenter.z);
    rootGroup.add(rim);

    const segCount = 8;
    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const dist = CUP_RADIUS + 0.06;
      const wx = cupCenter.x + Math.cos(angle) * dist;
      const wz = cupCenter.z + Math.sin(angle) * dist;
      const sleeveBody = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(wx, cupCenter.y - CUP_DEPTH * 0.5, wz)
          .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle))
      );
      createdBodies.push(sleeveBody);
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.06, CUP_DEPTH * 0.5, 0.16).setFriction(0.25).setRestitution(0.35),
        sleeveBody
      );
    }

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cupCenter.x, cupCenter.y - 0.22, cupCenter.z)
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.12, CUP_RADIUS * 0.78)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );
    return sensorCol.handle;
  };

  // --- Slabs & Cup ---
  let cupSensorHandle = -1;
  for (const slab of def.slabs) {
    if (slab.hasCupCutout) {
      cupSensorHandle = buildCupSlab(slab);
    } else {
      const friction = slab.surface === 'ice' ? 0.04 : slab.surface === 'sand' ? 0.92 : 0.46;
      addBox(slab.size[0], slab.size[1], slab.size[2], slab.pos[0], slab.pos[1], slab.pos[2], surfaceMat(slab.surface), {
        rotX: slab.rotX,
        rotY: slab.rotY,
        rotZ: slab.rotZ,
        friction,
        restitution: 0.15,
      });
    }
  }

  // --- Rails & Bumper Walls ---
  for (const rail of def.rails) {
    const isBumper = rail.style === 'bumper';
    addBox(rail.size[0], rail.size[1], rail.size[2], rail.pos[0], rail.pos[1], rail.pos[2], railMat(rail.style), {
      rotX: rail.rotX,
      rotY: rail.rotY,
      rotZ: rail.rotZ,
      isWall: true,
      restitution: rail.restitution ?? (isBumper ? 1.18 : 0.78),
    });
  }

  // --- 360° Crazy Loopings ---
  for (const loop of def.loops ?? []) {
    const { geometry, vertices, indices } = buildLoopGeometry(loop.radius, loop.width, loop.lateralOffset);
    trackGeo(geometry);
    const mesh = new THREE.Mesh(geometry, materials.loopTrack);
    mesh.position.set(...loop.origin);
    mesh.rotation.y = loop.yaw ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(...loop.origin)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );
    createdBodies.push(body);
    physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(0.0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0.0)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min),
      body
    );
  }

  // --- Curved Ice Tubes / Tunnels ---
  for (const tube of def.tubes ?? []) {
    const { geometry, vertices, indices } = buildSplineTubeGeometry(
      tube.points,
      tube.radius,
      Boolean(tube.enclosed)
    );
    trackGeo(geometry);
    const mat = tube.surface === 'stone' ? materials.stoneRail : materials.tubeIce;
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    createdBodies.push(body);
    const col = physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(tube.surface === 'stone' ? 0.4 : 0.02)
        .setFrictionCombineRule(
          tube.surface === 'stone' ? RAPIER.CoefficientCombineRule.Average : RAPIER.CoefficientCombineRule.Min
        )
        .setRestitution(0.05)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    if (tube.surface !== 'stone') {
      obstacles.iceHandles.add(col.handle);
    }
  }

  // --- Jump Pads ---
  for (const pad of def.jumpPads ?? []) {
    const padMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(pad.size[0], 0.09, pad.size[1])),
      materials.jumpPad
    );
    padMesh.position.set(pad.pos[0], pad.pos[1] + 0.045, pad.pos[2]);
    padMesh.rotation.y = pad.yaw ?? 0;
    padMesh.castShadow = true;
    rootGroup.add(padMesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pad.pos[0], pad.pos[1] + 0.14, pad.pos[2])
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(pad.size[0] * 0.45, 0.18, pad.size[1] * 0.45)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );

    obstacles.jumpPads.set(sensorCol.handle, {
      mesh: padMesh,
      baseY: padMesh.position.y,
      impulse: new THREE.Vector3(...pad.impulse),
      bounceTimer: 0,
    });
  }

  // --- Speed Boost Pads ---
  for (const boost of def.boostPads ?? []) {
    const mesh = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(boost.size[0], boost.size[1])),
      materials.boostPad
    );
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -(boost.yaw ?? 0);
    mesh.position.set(boost.pos[0], boost.pos[1] + 0.012, boost.pos[2]);
    rootGroup.add(mesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(boost.pos[0], boost.pos[1] + 0.15, boost.pos[2])
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(boost.size[0] * 0.48, 0.2, boost.size[1] * 0.48)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );

    const dir2 = new THREE.Vector2(boost.direction[0], boost.direction[1]).normalize();
    obstacles.boostZones.set(sensorCol.handle, { direction: dir2, force: boost.force });
  }

  // --- Pinball Bumpers ---
  for (const bumper of def.pinballBumpers ?? []) {
    const h = bumper.height ?? 0.42;
    const mesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(bumper.radius, bumper.radius * 1.06, h, 24)),
      materials.bumper
    );
    mesh.position.set(bumper.pos[0], bumper.pos[1] + h * 0.5, bumper.pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    const cap = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(bumper.radius * 0.68, bumper.radius * 0.68, 0.06, 20)),
      materials.cupMetal
    );
    cap.position.y = h * 0.5 + 0.02;
    mesh.add(cap);

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(bumper.pos[0], bumper.pos[1] + h * 0.5, bumper.pos[2])
    );
    createdBodies.push(body);
    const col = physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(h * 0.5, bumper.radius)
        .setRestitution(1.1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );

    obstacles.bumpers.set(col.handle, {
      mesh,
      center: new THREE.Vector3(...bumper.pos),
      bounceImpulse: bumper.bounceImpulse ?? 6.2,
      pulse: 0,
    });
  }

  // --- Kinematic Moving Obstacles (Doors, Sweepers, Windmills, Platforms) ---
  for (const mov of def.movingObstacles ?? []) {
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...mov.origin)
    );
    createdBodies.push(body);

    const mat = railMat(mov.style ?? 'stone');
    let visual: THREE.Object3D;

    if (mov.kind === 'windmill') {
      const hub = new THREE.Group();
      hub.position.set(...mov.origin);
      const bladeA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mov.size[0], mov.size[1], mov.size[2])), mat);
      const bladeB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mov.size[1], mov.size[0], mov.size[2])), mat);
      bladeA.castShadow = true;
      bladeB.castShadow = true;
      hub.add(bladeA, bladeB);
      rootGroup.add(hub);
      visual = hub;

      const colA = physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(mov.size[0] * 0.5, mov.size[1] * 0.5, mov.size[2] * 0.5)
          .setRestitution(0.7)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body
      );
      const colB = physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(mov.size[1] * 0.5, mov.size[0] * 0.5, mov.size[2] * 0.5)
          .setRestitution(0.7)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body
      );
      wallHandles.add(colA.handle);
      wallHandles.add(colB.handle);
    } else {
      const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...mov.size)), mat);
      mesh.position.set(...mov.origin);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      rootGroup.add(mesh);
      visual = mesh;

      const col = physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(mov.size[0] * 0.5, mov.size[1] * 0.5, mov.size[2] * 0.5)
          .setRestitution(0.75)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body
      );
      wallHandles.add(col.handle);
    }

    obstacles.kinematics.push({
      kind: mov.kind,
      body,
      mesh: visual,
      origin: new THREE.Vector3(...mov.origin),
      axis: mov.axis ?? 'x',
      amplitude: mov.amplitude ?? 1.2,
      speed: mov.speed,
      phase: mov.phase ?? 0,
    });
  }

  // --- Paired Portals ---
  for (const portal of def.portals ?? []) {
    const colorHex = portal.color ?? 0x38bdf8;
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.42, 0.075, 14, 32));
    const entryMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
    );
    const exitMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      })
    );

    const entryMesh = new THREE.Mesh(ringGeo, entryMat);
    entryMesh.position.set(...portal.entryPos);
    entryMesh.rotation.y = portal.entryYaw ?? 0;
    rootGroup.add(entryMesh);

    const exitMesh = new THREE.Mesh(ringGeo, exitMat);
    exitMesh.position.set(...portal.exitPos);
    exitMesh.rotation.y = portal.exitYaw;
    rootGroup.add(exitMesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(...portal.entryPos)
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.45, 0.42)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );

    obstacles.portals.set(sensorCol.handle, {
      mesh: entryMesh,
      exitPos: new THREE.Vector3(...portal.exitPos),
      exitYaw: portal.exitYaw,
      color: colorHex,
    });
  }

  // --- Water Hazards ---
  for (const water of def.waterZones ?? []) {
    const mesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(water.size[0], water.size[1], water.size[2])),
      materials.water
    );
    mesh.position.set(...water.pos);
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(...water.pos)
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(water.size[0] * 0.5, water.size[1] * 0.5 + 0.12, water.size[2] * 0.5)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );
    obstacles.waterHandles.add(sensorCol.handle);
  }

  // --- Sand Bunkers ---
  for (const sand of def.sandZones ?? []) {
    const mesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(sand.size[0], 0.04, sand.size[2])),
      materials.sand
    );
    mesh.position.set(sand.pos[0], sand.pos[1] + 0.015, sand.pos[2]);
    mesh.receiveShadow = true;
    rootGroup.add(mesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(sand.pos[0], sand.pos[1] + 0.16, sand.pos[2])
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(sand.size[0] * 0.48, 0.2, sand.size[2] * 0.48)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );
    obstacles.sandHandles.add(sensorCol.handle);
  }

  // --- Ice Friction Sensors ---
  for (const ice of def.iceZones ?? []) {
    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(ice.pos[0], ice.pos[1] + 0.18, ice.pos[2])
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ice.size[0] * 0.5, 0.22, ice.size[2] * 0.5)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );
    obstacles.iceHandles.add(sensorCol.handle);
  }

  // --- Localized Wind Tunnel Zones ---
  for (const wz of def.windZones ?? []) {
    const boxMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
      })
    );
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...wz.size)), boxMat);
    mesh.position.set(...wz.pos);
    rootGroup.add(mesh);

    const sensorBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(...wz.pos)
    );
    createdBodies.push(sensorBody);
    const sensorCol = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(wz.size[0] * 0.5, wz.size[1] * 0.5, wz.size[2] * 0.5)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      sensorBody
    );

    obstacles.windZones.set(sensorCol.handle, {
      direction: new THREE.Vector3(...wz.direction).normalize(),
      strength: wz.strength,
      center: new THREE.Vector3(...wz.pos),
      size: new THREE.Vector3(...wz.size),
    });
  }

  // Tee markers
  const markerMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.35 }));
  [-0.9, 0.9].forEach((mx) => {
    const peg = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 14, 12)), markerMat);
    peg.position.set(teePosition.x + mx, teePosition.y - 0.18, teePosition.z);
    peg.castShadow = true;
    rootGroup.add(peg);
  });

  // Trees
  if (def.treeCoords && def.treeCoords.length > 0) {
    populatePineTrees(rootGroup, def.treeCoords, trackGeo, trackMat);
  }

  // Flag aligned with global wind
  const flagPivot = buildFlag(rootGroup, materials, cupCenter, trackGeo);
  const windYaw = def.globalWind
    ? Math.atan2(def.globalWind.x, def.globalWind.z) - Math.PI * 0.5
    : 0;
  const windFlutterAmp = def.globalWind ? 0.14 + def.globalWind.strength * 0.04 : 0.12;

  return {
    definition: def,
    teePosition,
    cupCenter,
    wallObjects,
    wallHandles,
    cupSensorHandle,
    obstacles,
    updateVisuals: (delta: number, elapsed: number) => {
      obstacles.updateVisuals(delta, elapsed);
      materials.boostTexture.offset.y -= delta * 2.2;
      flagPivot.rotation.y = windYaw + Math.sin(elapsed * (2.6 + (def.globalWind?.strength ?? 0) * 0.5)) * windFlutterAmp;
      flagPivot.rotation.z = Math.cos(elapsed * 3.1) * 0.04;
    },
    dispose: () => {
      scene.remove(rootGroup);
      for (const body of createdBodies) {
        physics.removeRigidBody(body);
      }
      for (const geo of createdGeometries) {
        geo.dispose();
      }
      for (const mat of localMaterials) {
        mat.dispose();
      }
    },
  };
}

function buildFlag(
  parent: THREE.Group,
  materials: CourseMaterials,
  cupCenter: THREE.Vector3,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const poleHeight = 2.35;
  const pole = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.024, 0.024, poleHeight, 12)),
    materials.cupMetal
  );
  pole.position.set(cupCenter.x, cupCenter.y + poleHeight * 0.5 - CUP_DEPTH, cupCenter.z);
  pole.castShadow = true;
  parent.add(pole);

  const pivot = new THREE.Group();
  pivot.position.set(cupCenter.x, cupCenter.y + poleHeight - CUP_DEPTH - 0.12, cupCenter.z);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.14);
  shape.lineTo(0.68, 0.0);
  shape.lineTo(0, -0.18);
  shape.closePath();

  const flagMesh = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(shape)), materials.flagCloth);
  flagMesh.castShadow = true;
  pivot.add(flagMesh);
  parent.add(pivot);
  return pivot;
}

function populatePineTrees(
  parent: THREE.Group,
  coords: Array<[number, number, number]>,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4b3322, roughness: 0.92 }));
  const leafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.85 }));

  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8));
  const cone1Geo = trackGeo(new THREE.ConeGeometry(1.35, 2.1, 9));
  const cone2Geo = trackGeo(new THREE.ConeGeometry(1.05, 1.8, 9));
  const cone3Geo = trackGeo(new THREE.ConeGeometry(0.72, 1.4, 9));

  for (const [x, z, scale] of coords) {
    const group = new THREE.Group();
    group.position.set(x, -0.62, z);
    group.scale.setScalar(scale);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    group.add(trunk);

    [
      [cone1Geo, 1.7],
      [cone2Geo, 2.75],
      [cone3Geo, 3.65],
    ].forEach(([geo, y]) => {
      const cone = new THREE.Mesh(geo as THREE.BufferGeometry, leafMat);
      cone.position.y = y as number;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    });

    parent.add(group);
  }
}
