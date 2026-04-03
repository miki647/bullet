import * as THREE from 'three';

/**
 * TankDebris — 6-directional triangle debris on Tank kill.
 * Pooled for up to 3 concurrent tank deaths (18 debris pieces).
 */

const DEBRIS_PER_TANK = 6;
const POOL_SIZE = DEBRIS_PER_TANK * 3;
const SPEED = 200;
const LIFETIME = 0.8;

interface DebrisEntry {
  mesh: THREE.LineLoop;
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  rotSpeed: number;
  elapsed: number;
  active: boolean;
}

// Small triangle shape
const TRI_VERTS = [
  new THREE.Vector3(0, 6, 0),
  new THREE.Vector3(-5, -4, 0),
  new THREE.Vector3(5, -4, 0),
];

const colorStart = new THREE.Color(0xbb55ff);
const colorEnd = new THREE.Color(0xff2222);

export class TankDebris {
  readonly group = new THREE.Group();
  private pool: DebrisEntry[] = [];

  constructor() {
    this.group.position.z = 1.2;

    const geo = new THREE.BufferGeometry().setFromPoints(TRI_VERTS);

    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: 0xbb55ff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.LineLoop(geo.clone(), mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.pool.push({
        mesh,
        posX: 0, posY: 0,
        velX: 0, velY: 0,
        rotSpeed: 0,
        elapsed: 0,
        active: false,
      });
    }
  }

  trigger(x: number, y: number): void {
    for (let i = 0; i < DEBRIS_PER_TANK; i++) {
      const entry = this.pool.find(e => !e.active);
      if (!entry) break;

      const angle = (i / DEBRIS_PER_TANK) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      entry.posX = x;
      entry.posY = y;
      entry.velX = Math.cos(angle) * SPEED * (0.8 + Math.random() * 0.4);
      entry.velY = Math.sin(angle) * SPEED * (0.8 + Math.random() * 0.4);
      entry.rotSpeed = (Math.random() - 0.5) * 12;
      entry.elapsed = 0;
      entry.active = true;
      entry.mesh.visible = true;
      entry.mesh.scale.set(1, 1, 1);
    }
  }

  update(dt: number): void {
    for (const e of this.pool) {
      if (!e.active) continue;

      e.elapsed += dt;
      const t = e.elapsed / LIFETIME;

      if (t >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }

      e.posX += e.velX * dt;
      e.posY += e.velY * dt;
      e.velX *= 0.97; // drag
      e.velY *= 0.97;

      e.mesh.position.set(e.posX, e.posY, 0);
      e.mesh.rotation.z += e.rotSpeed * dt;

      // Scale shrink
      const s = 1 - t * 0.5;
      e.mesh.scale.set(s, s, 1);

      // Color: purple → red
      const color = colorStart.clone().lerp(colorEnd, t);
      (e.mesh.material as THREE.LineBasicMaterial).color.copy(color);
      (e.mesh.material as THREE.LineBasicMaterial).opacity = 1 - t;
    }
  }
}
