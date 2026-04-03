import * as THREE from 'three';

interface DustParticle {
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  parallaxFactor: number;
  mesh: THREE.Mesh;
}

const DUST_COLORS = [0x00ffff, 0x8844cc, 0x4488ff, 0x6622aa, 0x2266aa];

/**
 * Very faint, large, floating circles that add "life" to empty space.
 * Moves with parallax relative to player position.
 */
export class AmbientDust {
  readonly group = new THREE.Group();
  private particles: DustParticle[] = [];
  private worldW: number;
  private worldH: number;

  constructor(worldWidth: number, worldHeight: number, count = 25) {
    this.worldW = worldWidth * 1.5;
    this.worldH = worldHeight * 1.5;
    this.group.position.z = -8;

    for (let i = 0; i < count; i++) {
      const radius = 30 + Math.random() * 50;
      const geo = new THREE.CircleGeometry(radius, 24);
      const color = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)];
      const opacity = 0.02 + Math.random() * 0.04;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const baseX = (Math.random() - 0.5) * this.worldW;
      const baseY = (Math.random() - 0.5) * this.worldH;
      mesh.position.set(baseX, baseY, 0);

      this.group.add(mesh);

      this.particles.push({
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 6,
        parallaxFactor: 0.3 + Math.random() * 0.4,
        mesh,
      });
    }
  }

  update(dt: number, playerX: number, playerY: number): void {
    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;

    for (const p of this.particles) {
      // Drift
      p.baseX += p.vx * dt;
      p.baseY += p.vy * dt;

      // Wrap
      if (p.baseX < -halfW) p.baseX += this.worldW;
      if (p.baseX > halfW) p.baseX -= this.worldW;
      if (p.baseY < -halfH) p.baseY += this.worldH;
      if (p.baseY > halfH) p.baseY -= this.worldH;

      // Parallax offset based on player position
      const px = p.baseX - playerX * (1 - p.parallaxFactor);
      const py = p.baseY - playerY * (1 - p.parallaxFactor);

      p.mesh.position.x = px;
      p.mesh.position.y = py;
    }
  }
}
