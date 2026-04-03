import * as THREE from 'three';
import { Game } from '../game/Game';
import { createBulletShape } from '../rendering/NeonShapes';
import { ObjectPool } from '../utils/ObjectPool';

const BULLET_SPEED = 800;
const FIRE_COOLDOWN = 0.12;
const POOL_SIZE = 100;
const TRAIL_LENGTH = 6;
const POP_DURATION = 0.1;

interface BulletData {
  mesh: THREE.Group;
  trail: THREE.Group; // trail points + line
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  active: boolean;
  age: number; // for pop animation
  trailPositions: Float32Array; // [x0,y0, x1,y1, ...]
  visualOffsetX: number;
  visualOffsetY: number;
}

export class BulletManager {
  readonly group = new THREE.Group();
  private bullets: BulletData[] = [];
  private pool: ObjectPool<BulletData>;
  private fireCooldown = 0;

  constructor() {
    this.pool = new ObjectPool<BulletData>(
      () => this.createBulletData(),
      (b) => this.resetBullet(b),
      POOL_SIZE,
    );
    this.group.position.z = 0.5; // between background and player
  }

  private createBulletData(): BulletData {
    const mesh = createBulletShape();
    mesh.visible = false;
    this.group.add(mesh);

    // Trail: points + connecting line
    const trail = new THREE.Group();
    const trailPositions = new Float32Array(TRAIL_LENGTH * 3);

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    const pointsColors = new Float32Array(TRAIL_LENGTH * 4);
    pointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(pointsColors, 4));
    const pointsMat = new THREE.PointsMaterial({
      size: 4,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    trail.add(new THREE.Points(pointsGeo, pointsMat));

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    const lineColors = new Float32Array(TRAIL_LENGTH * 4);
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4));
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    trail.add(new THREE.Line(lineGeo, lineMat));

    trail.visible = false;
    this.group.add(trail);

    return {
      mesh,
      trail,
      posX: 0,
      posY: 0,
      velX: 0,
      velY: 0,
      active: false,
      age: 0,
      trailPositions: new Float32Array(TRAIL_LENGTH * 2),
      visualOffsetX: 0,
      visualOffsetY: 0,
    };
  }

  private resetBullet(b: BulletData): void {
    b.active = false;
    b.mesh.visible = false;
    b.trail.visible = false;
    b.age = 0;
  }

  tryFire(playerX: number, playerY: number, aimX: number, aimY: number): void {
    if (this.fireCooldown > 0) return;

    const dx = aimX - playerX;
    const dy = aimY - playerY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const dirX = dx / len;
    const dirY = dy / len;

    const b = this.pool.acquire();
    b.active = true;
    b.age = 0;
    // Spawn slightly ahead of player
    b.posX = playerX + dirX * 25;
    b.posY = playerY + dirY * 25;
    b.velX = dirX * BULLET_SPEED;
    b.velY = dirY * BULLET_SPEED;

    b.mesh.visible = true;
    b.mesh.position.set(b.posX, b.posY, 0);
    b.mesh.rotation.z = -Math.atan2(dirX, dirY);
    b.mesh.scale.set(2, 2, 1); // pop start

    b.trail.visible = true;

    // Initialize trail positions to spawn point
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      b.trailPositions[i * 2] = b.posX;
      b.trailPositions[i * 2 + 1] = b.posY;
    }

    this.bullets.push(b);
    this.fireCooldown = FIRE_COOLDOWN;
  }

  update(dt: number): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const halfW = Game.WORLD_WIDTH / 2 + 50; // margin
    const halfH = Game.WORLD_HEIGHT / 2 + 50;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) {
        this.bullets.splice(i, 1);
        this.pool.release(b);
        continue;
      }

      b.age += dt;

      // Move
      b.posX += b.velX * dt;
      b.posY += b.velY * dt;

      // Off-screen check
      if (b.posX < -halfW || b.posX > halfW || b.posY < -halfH || b.posY > halfH) {
        b.active = false;
        this.bullets.splice(i, 1);
        this.pool.release(b);
        continue;
      }

      // Decay visual offset
      const decay = Math.pow(0.9, dt * 60);
      b.visualOffsetX *= decay;
      b.visualOffsetY *= decay;

      // Update mesh position (includes visual offset)
      b.mesh.position.x = b.posX + b.visualOffsetX;
      b.mesh.position.y = b.posY + b.visualOffsetY;

      // Pop animation: scale 2 → 1 over POP_DURATION
      if (b.age < POP_DURATION) {
        const t = b.age / POP_DURATION;
        const s = 2 - t; // 2 → 1
        b.mesh.scale.set(s, s, 1);
      } else if (b.mesh.scale.x !== 1) {
        b.mesh.scale.set(1, 1, 1);
      }

      // Shift trail positions (newest at index 0)
      for (let j = TRAIL_LENGTH - 1; j > 0; j--) {
        b.trailPositions[j * 2] = b.trailPositions[(j - 1) * 2];
        b.trailPositions[j * 2 + 1] = b.trailPositions[(j - 1) * 2 + 1];
      }
      b.trailPositions[0] = b.posX;
      b.trailPositions[1] = b.posY;

      // Update trail geometry
      this.updateTrailGeometry(b);
    }
  }

  private updateTrailGeometry(b: BulletData): void {
    const points = b.trail.children[0] as THREE.Points;
    const line = b.trail.children[1] as THREE.Line;

    const posArr = points.geometry.getAttribute('position').array as Float32Array;
    const colArr = points.geometry.getAttribute('color').array as Float32Array;
    const linePosArr = line.geometry.getAttribute('position').array as Float32Array;
    const lineColArr = line.geometry.getAttribute('color').array as Float32Array;

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const x = b.trailPositions[i * 2];
      const y = b.trailPositions[i * 2 + 1];

      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = 0;

      linePosArr[i * 3] = x;
      linePosArr[i * 3 + 1] = y;
      linePosArr[i * 3 + 2] = 0;

      // Quadratic fade: alpha = (1 - i/length)^2
      const t = 1 - i / TRAIL_LENGTH;
      const alpha = t * t;
      // Color: white-yellow → dim
      colArr[i * 4] = 1.0;
      colArr[i * 4 + 1] = 1.0 * t + 0.6 * (1 - t);
      colArr[i * 4 + 2] = 0.8 * t;
      colArr[i * 4 + 3] = alpha * 0.7;

      lineColArr[i * 4] = 1.0;
      lineColArr[i * 4 + 1] = 1.0 * t + 0.6 * (1 - t);
      lineColArr[i * 4 + 2] = 0.8 * t;
      lineColArr[i * 4 + 3] = alpha * 0.4;
    }

    points.geometry.getAttribute('position').needsUpdate = true;
    points.geometry.getAttribute('color').needsUpdate = true;
    line.geometry.getAttribute('position').needsUpdate = true;
    line.geometry.getAttribute('color').needsUpdate = true;
  }

  get activeBullets(): ReadonlyArray<BulletData> {
    return this.bullets;
  }

  get activeCount(): number {
    return this.bullets.length;
  }

  /** Apply visual-only knockback push from an origin point */
  applyVisualKnockback(originX: number, originY: number, radius = 100, strength = 6): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      const dx = b.posX - originX;
      const dy = b.posY - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 0.01) {
        const factor = (1 - dist / radius) * strength;
        b.visualOffsetX += (dx / dist) * factor;
        b.visualOffsetY += (dy / dist) * factor;
      }
    }
  }

  reset(): void {
    // Deactivate all bullets so next update cycle returns them to pool
    for (const b of this.bullets) {
      b.active = false;
      b.mesh.visible = false;
    }
    this.fireCooldown = 0;
  }
}
