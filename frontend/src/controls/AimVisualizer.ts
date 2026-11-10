import * as THREE from 'three';

const DOT_COUNT = 18;
const DOT_SPACING = 0.42;

/**
 * Renders the 3D power ring around the ball and a dotted predictive
 * aim line including the first wall-bounce reflection.
 */
export class AimVisualizer {
  private readonly group = new THREE.Group();
  private readonly powerRing: THREE.Mesh;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly dots: THREE.Mesh[] = [];
  private readonly dotMaterial: THREE.MeshBasicMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private readonly wallObjects: THREE.Object3D[];

  private readonly colorLow = new THREE.Color(0x34d399);
  private readonly colorMid = new THREE.Color(0xfbbf24);
  private readonly colorHigh = new THREE.Color(0xf87171);
  private readonly tempColor = new THREE.Color();

  constructor(scene: THREE.Scene, wallObjects: THREE.Object3D[]) {
    this.wallObjects = wallObjects;

    const ringGeo = new THREE.RingGeometry(0.3, 0.44, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.powerRing = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.group.add(this.powerRing);

    const dotGeo = new THREE.SphereGeometry(0.055, 12, 10);
    this.dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    for (let i = 0; i < DOT_COUNT; i++) {
      const dot = new THREE.Mesh(dotGeo, this.dotMaterial);
      dot.visible = false;
      this.dots.push(dot);
      this.group.add(dot);
    }

    this.group.visible = false;
    scene.add(this.group);
  }

  public hide(): void {
    this.group.visible = false;
  }

  public update(ballPos: THREE.Vector3, direction: THREE.Vector3, power: number): void {
    this.group.visible = true;

    const ringScale = 0.85 + power * 1.15;
    this.powerRing.position.set(ballPos.x, ballPos.y - 0.14, ballPos.z);
    this.powerRing.scale.setScalar(ringScale);

    if (power < 0.5) {
      this.tempColor.lerpColors(this.colorLow, this.colorMid, power * 2);
    } else {
      this.tempColor.lerpColors(this.colorMid, this.colorHigh, (power - 0.5) * 2);
    }
    this.ringMaterial.color.copy(this.tempColor);
    this.dotMaterial.color.copy(this.tempColor);

    const totalLen = 1.4 + power * 6.8;
    const activeDots = Math.max(2, Math.min(DOT_COUNT, Math.floor(totalLen / DOT_SPACING)));

    // Trace primary ray and compute single bounce off rails
    const origin = new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z);
    const dir = direction.clone().normalize();
    let remaining = activeDots * DOT_SPACING;
    let placed = 0;
    let stepCursor = 0.45;

    for (let bounce = 0; bounce < 2 && placed < activeDots; bounce++) {
      this.raycaster.set(origin, dir);
      this.raycaster.far = remaining;
      const hits = this.raycaster.intersectObjects(this.wallObjects, false);

      const segLength = hits.length > 0 ? Math.max(0.18, hits[0].distance - 0.18) : remaining;
      while (stepCursor <= segLength && placed < activeDots) {
        const p = origin.clone().addScaledVector(dir, stepCursor);
        const dot = this.dots[placed];
        dot.position.set(p.x, ballPos.y, p.z);
        const fadeScale = 1 - (placed / activeDots) * 0.45;
        dot.scale.setScalar(fadeScale);
        dot.visible = true;
        placed++;
        stepCursor += DOT_SPACING;
      }

      if (hits.length === 0 || !hits[0].face) break;

      remaining -= segLength;
      if (remaining <= 0.2) break;

      const normal = hits[0].face.normal
        .clone()
        .transformDirection(hits[0].object.matrixWorld)
        .setY(0)
        .normalize();

      origin.copy(hits[0].point).addScaledVector(normal, 0.2);
      dir.reflect(normal).setY(0).normalize();
      stepCursor = 0.22;
    }

    for (let i = placed; i < DOT_COUNT; i++) {
      this.dots[i].visible = false;
    }
  }
}

