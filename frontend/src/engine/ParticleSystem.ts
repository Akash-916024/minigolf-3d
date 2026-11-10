import * as THREE from 'three';

interface ActiveParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

interface WindStreak {
  mesh: THREE.Mesh;
  offset: THREE.Vector3;
  life: number;
  maxLife: number;
}

/**
 * Lightweight 3D particle manager for water splashes, sand puffs,
 * jump/portal bursts, and drifting wind streaks.
 */
export class ParticleSystem {
  private readonly group = new THREE.Group();
  private readonly particles: ActiveParticle[] = [];
  private readonly windStreaks: WindStreak[] = [];
  private readonly burstGeo = new THREE.SphereGeometry(0.055, 8, 6);
  private readonly streakGeo = new THREE.BoxGeometry(0.025, 0.025, 0.9);
  private readonly streakMat = new THREE.MeshBasicMaterial({
    color: 0xe6f7ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(this.streakGeo, this.streakMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.windStreaks.push({
        mesh,
        offset: new THREE.Vector3((Math.random() - 0.5) * 20, 0.5 + Math.random() * 2.8, (Math.random() - 0.5) * 20),
        life: Math.random() * 2.2,
        maxLife: 1.8 + Math.random() * 1.1,
      });
    }
  }

  public spawnSplash(pos: THREE.Vector3): void {
    this.spawnBurst(pos, 0x7dd3fc, 16, 4.6, 12.0);
  }

  public spawnSandPuff(pos: THREE.Vector3): void {
    this.spawnBurst(pos, 0xe7c88d, 10, 2.2, 6.0);
  }

  public spawnBurst(
    pos: THREE.Vector3,
    colorHex: number,
    count = 14,
    speed = 4.2,
    gravity = 9.0
  ): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(this.burstGeo, mat);
      mesh.position.copy(pos);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const horiz = (0.35 + Math.random() * 0.65) * speed;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horiz,
        (0.55 + Math.random() * 0.75) * speed,
        Math.sin(angle) * horiz
      );

      this.particles.push({
        mesh,
        vel,
        life: 0,
        maxLife: 0.42 + Math.random() * 0.25,
        gravity,
      });
    }
  }

  public update(
    delta: number,
    windVec: THREE.Vector3,
    windCenter: THREE.Vector3,
    windSpread = new THREE.Vector3(18, 2.8, 18)
  ): void {
    // Update burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= p.gravity * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(0.5 + t * 0.7);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t * 0.9;
    }

    // Update wind streaks strictly within wind zone bounds
    const windSpeed = windVec.length();
    if (windSpeed < 0.05) {
      for (const s of this.windStreaks) {
        s.mesh.visible = false;
      }
      return;
    }

    const windDir = windVec.clone().normalize();
    const yaw = Math.atan2(windDir.x, windDir.z);

    for (const s of this.windStreaks) {
      s.mesh.visible = true;
      s.life += delta;
      if (s.life >= s.maxLife) {
        s.life = 0;
        s.offset.set(
          (Math.random() - 0.5) * windSpread.x * 0.85,
          (Math.random() - 0.5) * windSpread.y * 0.8,
          (Math.random() - 0.5) * windSpread.z * 0.85
        );
      }

      s.offset.addScaledVector(windDir, (3.8 + windSpeed * 0.85) * delta);
      if (Math.abs(s.offset.x) > windSpread.x * 0.5) s.offset.x = -Math.sign(s.offset.x) * windSpread.x * 0.45;
      if (Math.abs(s.offset.z) > windSpread.z * 0.5) s.offset.z = -Math.sign(s.offset.z) * windSpread.z * 0.45;

      s.mesh.position.copy(windCenter).add(s.offset);
      s.mesh.rotation.set(0, yaw, 0);

      const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * Math.min(0.5, 0.18 + windSpeed * 0.05);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, alpha);
    }
  }

  public dispose(): void {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    for (const s of this.windStreaks) {
      this.group.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.burstGeo.dispose();
    this.streakGeo.dispose();
    this.streakMat.dispose();
  }
}

