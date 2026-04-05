import * as THREE from 'three';
import { Bounds } from '../utils/Bounds';
import { ObjectPool } from '../utils/ObjectPool';

const TANK_BULLET_SPEED = 250;
const POOL_SIZE = 30;
const TANK_BULLET_RADIUS = 6;

export interface TankBulletData {
  mesh: THREE.Group;
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  active: boolean;
  age: number;
}

export { TANK_BULLET_RADIUS };

export class TankBulletManager {
  readonly group = new THREE.Group();
  private bullets: TankBulletData[] = [];
  private pool: ObjectPool<TankBulletData>;

  constructor() {
    this.pool = new ObjectPool<TankBulletData>(
      () => this.createBulletData(),
      (b) => this.resetBullet(b),
      POOL_SIZE,
    );
    this.group.position.z = 0.6;
  }

  private createBulletData(): TankBulletData {
    const mesh = this.createTankBulletMesh();
    mesh.visible = false;
    this.group.add(mesh);

    return {
      mesh,
      posX: 0, posY: 0,
      velX: 0, velY: 0,
      active: false,
      age: 0,
    };
  }

  /** Purple neon diamond projectile */
  private createTankBulletMesh(): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(0xbb55ff);

    // Diamond shape (4 points)
    const verts = [
      0, 8, 0,   // top
      5, 0, 0,   // right
      0, -4, 0,  // bottom
      -5, 0, 0,  // left
    ];

    // Core fill (solid-ish small shape)
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    coreGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xdd88ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    // Outline
    const outlineGeo = new THREE.BufferGeometry();
    outlineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const outlineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.LineLoop(outlineGeo, outlineMat));

    // Glow (larger, faint)
    const glowScale = 1.6;
    const glowVerts = verts.map((v, i) => i % 3 === 2 ? -0.01 : v * glowScale);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowVerts, 3));
    const glowMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.LineLoop(glowGeo, glowMat));

    return group;
  }

  private resetBullet(b: TankBulletData): void {
    b.active = false;
    b.mesh.visible = false;
    b.age = 0;
  }

  /** Spawn a tank bullet at (x,y) traveling in direction angle (radians) */
  fire(x: number, y: number, angle: number): void {
    const b = this.pool.acquire();
    b.active = true;
    b.age = 0;
    // The tank mesh rotation.z: 0 = pointing up (+Y). The bullet fires from the "nose".
    // rotation.z rotates CCW, so direction vector is (-sin(angle), cos(angle))
    const dirX = -Math.sin(angle);
    const dirY = Math.cos(angle);
    b.posX = x + dirX * 30; // spawn ahead of tank center
    b.posY = y + dirY * 30;
    b.velX = dirX * TANK_BULLET_SPEED;
    b.velY = dirY * TANK_BULLET_SPEED;

    b.mesh.visible = true;
    b.mesh.position.set(b.posX, b.posY, 0);
    b.mesh.rotation.z = angle;
    b.mesh.scale.set(1, 1, 1);

    this.bullets.push(b);
  }

  update(dt: number): void {
    const halfW = Bounds.halfW + 50;
    const halfH = Bounds.halfH + 50;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) {
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
        this.pool.release(b);
        continue;
      }

      b.age += dt;
      b.posX += b.velX * dt;
      b.posY += b.velY * dt;

      // Off-screen removal
      if (b.posX < -halfW || b.posX > halfW || b.posY < -halfH || b.posY > halfH) {
        b.active = false;
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
        this.pool.release(b);
        continue;
      }

      b.mesh.position.x = b.posX;
      b.mesh.position.y = b.posY;

      // Subtle pulsing glow
      const pulse = 0.8 + 0.2 * Math.sin(b.age * 12);
      const glow = b.mesh.children[2] as THREE.LineLoop | undefined;
      if (glow?.material) {
        (glow.material as THREE.LineBasicMaterial).opacity = 0.25 * pulse;
      }
    }
  }

  get activeBullets(): ReadonlyArray<TankBulletData> {
    return this.bullets;
  }

  get activeCount(): number {
    return this.bullets.length;
  }

  reset(): void {
    for (const b of this.bullets) {
      b.active = false;
      b.mesh.visible = false;
      this.pool.release(b);
    }
    this.bullets.length = 0;
  }
}
