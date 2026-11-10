import * as THREE from 'three';

export interface TrimeshBuffers {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  indices: Uint32Array;
}

/**
 * Generates a U-channel 360° Crazy Looping track with subtle helical lateral
 * offset so the ball enters cleanly and exits alongside the entry lane.
 */
export function buildLoopGeometry(
  radius: number,
  width: number,
  lateralOffset: number,
  segments = 128
): TrimeshBuffers {
  const halfW = width * 0.5;
  const curbH = 0.26;
  const thickness = 0.14;

  // Cross-section profile (U-channel with thickness so all collision normals point outward)
  const profile: Array<[number, number]> = [
    [-halfW - 0.1, curbH],
    [-halfW, curbH],
    [-halfW, 0],
    [halfW, 0],
    [halfW, curbH],
    [halfW + 0.1, curbH],
    [halfW + 0.1, -thickness],
    [-halfW - 0.1, -thickness],
  ];

  return extrudeProfileAlongLoop(profile, radius, lateralOffset, segments);
}

function extrudeProfileAlongLoop(
  profile: Array<[number, number]>,
  radius: number,
  lateralOffset: number,
  segments: number
): TrimeshBuffers {
  const ringLen = profile.length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = t * Math.PI * 2;
    // Start at bottom (0, 0, 0), loop forward (-Z), up (+Y), back (+Z), down
    const cy = radius * (1 - Math.cos(theta));
    const cz = -radius * Math.sin(theta);
    const cx = t * lateralOffset;

    // Inward normal toward center of loop
    const ny = Math.cos(theta);
    const nz = Math.sin(theta);

    for (let p = 0; p < ringLen; p++) {
      const [px, py] = profile[p];
      positions.push(cx + px, cy + ny * py, cz + nz * py);
    }
  }

  for (let i = 0; i < segments; i++) {
    const rowA = i * ringLen;
    const rowB = (i + 1) * ringLen;
    for (let p = 0; p < ringLen; p++) {
      const nextP = (p + 1) % ringLen;
      const a = rowA + p;
      const b = rowA + nextP;
      const c = rowB + nextP;
      const d = rowB + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  const vertices = new Float32Array(positions);
  const indexArray = new Uint32Array(indices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  geometry.computeVertexNormals();

  return { geometry, vertices, indices: indexArray };
}

/**
 * Generates a curved open half-pipe or enclosed tube chute along 3D control points.
 */
export function buildSplineTubeGeometry(
  controlPoints: [number, number, number][],
  radius: number,
  enclosed: boolean,
  pathSegments = 42,
  radialSegments = 12
): TrimeshBuffers {
  const curve = new THREE.CatmullRomCurve3(
    controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );

  const wallThickness = 0.12;
  const startAngle = enclosed ? 0 : Math.PI * 0.08;
  const endAngle = enclosed ? Math.PI * 2 : Math.PI * 0.92;
  const profile: Array<[number, number]> = [];

  if (enclosed) {
    // Outer ring then inner ring? Simpler for trimesh: open U or enclosed double-shell.
    // For enclosed tube, build inner surface facing inward and outer surface facing outward.
    return buildEnclosedTube(curve, radius, wallThickness, pathSegments, radialSegments);
  }

  // Open half-pipe U-channel profile (lower arc from -PI to 0 in local XY)
  for (let r = 0; r <= radialSegments; r++) {
    const u = r / radialSegments;
    const ang = -Math.PI + startAngle + u * (endAngle - startAngle);
    profile.push([Math.cos(ang) * radius, Math.sin(ang) * radius]);
  }
  for (let r = radialSegments; r >= 0; r--) {
    const u = r / radialSegments;
    const ang = -Math.PI + startAngle + u * (endAngle - startAngle);
    const outerR = radius + wallThickness;
    profile.push([Math.cos(ang) * outerR, Math.sin(ang) * outerR]);
  }

  return extrudeProfileAlongCurve(curve, profile, pathSegments);
}

function buildEnclosedTube(
  curve: THREE.CatmullRomCurve3,
  radius: number,
  wallThickness: number,
  pathSegments: number,
  radialSegments: number
): TrimeshBuffers {
  const positions: number[] = [];
  const indices: number[] = [];
  const frames = computeStableFrames(curve, pathSegments);
  const ringVerts = radialSegments;

  // 2 shells per station: inner shell (verts 0..ringVerts-1) + outer shell
  for (let i = 0; i <= pathSegments; i++) {
    const { point, right, up } = frames[i];
    for (let shell = 0; shell < 2; shell++) {
      const r = shell === 0 ? radius : radius + wallThickness;
      for (let j = 0; j < ringVerts; j++) {
        const ang = (j / ringVerts) * Math.PI * 2;
        const cx = Math.cos(ang) * r;
        const cy = Math.sin(ang) * r;
        const wx = point.x + right.x * cx + up.x * cy;
        const wy = point.y + right.y * cx + up.y * cy;
        const wz = point.z + right.z * cx + up.z * cy;
        positions.push(wx, wy, wz);
      }
    }
  }

  const stride = ringVerts * 2;
  for (let i = 0; i < pathSegments; i++) {
    const baseA = i * stride;
    const baseB = (i + 1) * stride;
    for (let j = 0; j < ringVerts; j++) {
      const nextJ = (j + 1) % ringVerts;
      // Inner shell (normals pointing inward toward tube center)
      const ia = baseA + j;
      const ib = baseA + nextJ;
      const ic = baseB + nextJ;
      const id = baseB + j;
      indices.push(ia, ic, ib, ia, id, ic);

      // Outer shell (normals pointing outward)
      const oa = baseA + ringVerts + j;
      const ob = baseA + ringVerts + nextJ;
      const oc = baseB + ringVerts + nextJ;
      const od = baseB + ringVerts + j;
      indices.push(oa, ob, oc, oa, oc, od);
    }
  }

  const vertices = new Float32Array(positions);
  const indexArray = new Uint32Array(indices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  geometry.computeVertexNormals();
  return { geometry, vertices, indices: indexArray };
}

function extrudeProfileAlongCurve(
  curve: THREE.CatmullRomCurve3,
  profile: Array<[number, number]>,
  pathSegments: number
): TrimeshBuffers {
  const positions: number[] = [];
  const indices: number[] = [];
  const frames = computeStableFrames(curve, pathSegments);
  const ringLen = profile.length;

  for (let i = 0; i <= pathSegments; i++) {
    const { point, right, up } = frames[i];
    for (let p = 0; p < ringLen; p++) {
      const [px, py] = profile[p];
      positions.push(
        point.x + right.x * px + up.x * py,
        point.y + right.y * px + up.y * py,
        point.z + right.z * px + up.z * py
      );
    }
  }

  for (let i = 0; i < pathSegments; i++) {
    const rowA = i * ringLen;
    const rowB = (i + 1) * ringLen;
    for (let p = 0; p < ringLen; p++) {
      const nextP = (p + 1) % ringLen;
      const a = rowA + p;
      const b = rowA + nextP;
      const c = rowB + nextP;
      const d = rowB + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  const vertices = new Float32Array(positions);
  const indexArray = new Uint32Array(indices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  geometry.computeVertexNormals();
  return { geometry, vertices, indices: indexArray };
}

function computeStableFrames(
  curve: THREE.CatmullRomCurve3,
  segments: number
): Array<{ point: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 }> {
  const frames: Array<{ point: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 }> = [];
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, worldUp);
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();
    frames.push({ point, right, up });
  }
  return frames;
}

