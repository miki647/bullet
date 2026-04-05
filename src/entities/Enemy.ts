import * as THREE from 'three';
import {
  createNeonShape,
  CHASER_VERTICES,
  SWARM_VERTICES,
  TANK_VERTICES,
  applyMicroVibration,
} from '../rendering/NeonShapes';
import { ObjectPool } from '../utils/ObjectPool';
import { Bounds } from '../utils/Bounds';

// ─── Constants ──────────────────────────────────────────────
const CHASER_SPEED = 160;
const CHASER_HP = 1;
const CHASER_RADIUS = 18;

const SWARM_SPEED = 400;
const SWARM_HP = 1;
const SWARM_RADIUS = 12;

const TANK_SPEED = 120;
const TANK_HP = 5;
const TANK_RADIUS = 28;

const SPAWN_POP_DURATION = 0.3;

// Pre-allocated colors for tank visuals (avoids GC in hot loop)
const COLOR_TANK_HURT_50 = new THREE.Color(0xff4444);
const COLOR_TANK_HURT_20 = new THREE.Color(0xff2222);
const _tmpColor = new THREE.Color();

// ─── Colors ─────────────────────────────────────────────────
const COLOR_CHASER = new THREE.Color(0xff4444);
const COLOR_SWARM = new THREE.Color(0x33ff88);
const COLOR_TANK = new THREE.Color(0xbb55ff);

export type EnemyType = 'chaser' | 'swarm' | 'tank';

export interface EnemyData {
  mesh: THREE.Group;
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  active: boolean;
  age: number;
  radius: number;
  rotationSpeed: number;
  visualOffsetX: number;
  visualOffsetY: number;
  hitPulseTimer: number;
  flashGlowTimer: number;
  shootTimer: number;
  // Cached child refs for tank (null for others)
  tankInner: THREE.LineLoop | null;
  tankRing0: THREE.LineLoop | null;
  tankRing1: THREE.LineLoop | null;
}

const TANK_FIRE_INTERVAL = 1.0; // seconds between tank shots

// ─── EnemyManager ───────────────────────────────────────────

export interface TankFireRequest {
  x: number;
  y: number;
  angle: number; // direction in radians
}

export class EnemyManager {
  readonly group = new THREE.Group();
  private enemies: EnemyData[] = [];
  private _tankFireRequests: TankFireRequest[] = [];

  // Separate pools per type so meshes are pre-built with correct shape/color
  private chaserPool: ObjectPool<EnemyData>;
  private swarmPool: ObjectPool<EnemyData>;
  private tankPool: ObjectPool<EnemyData>;

  constructor() {
    this.chaserPool = new ObjectPool<EnemyData>(
      () => this.createEnemyData('chaser'), (e) => this.resetEnemy(e), 40,
    );
    this.swarmPool = new ObjectPool<EnemyData>(
      () => this.createEnemyData('swarm'), (e) => this.resetEnemy(e), 40,
    );
    this.tankPool = new ObjectPool<EnemyData>(
      () => this.createEnemyData('tank'), (e) => this.resetEnemy(e), 10,
    );

    this.group.position.z = 0.8;
  }

  // ─── Factory ─────────────────────────────────────────────

  private createEnemyData(type: EnemyType): EnemyData {
    let vertices: number[][];
    let color: THREE.Color;
    let radius: number;
    let hp: number;

    switch (type) {
      case 'swarm':
        vertices = SWARM_VERTICES;
        color = COLOR_SWARM;
        radius = SWARM_RADIUS;
        hp = SWARM_HP;
        break;
      case 'tank':
        vertices = TANK_VERTICES;
        color = COLOR_TANK;
        radius = TANK_RADIUS;
        hp = TANK_HP;
        break;
      default: // chaser
        vertices = CHASER_VERTICES;
        color = COLOR_CHASER;
        radius = CHASER_RADIUS;
        hp = CHASER_HP;
    }

    const mesh = createNeonShape(vertices, color);
    mesh.visible = false;
    this.group.add(mesh);

    // Tank extra: inner hexagon (55% scale) + 2 pulsing rings
    let tankInner: THREE.LineLoop | null = null;
    let tankRing0: THREE.LineLoop | null = null;
    let tankRing1: THREE.LineLoop | null = null;
    if (type === 'tank') {
      this.addTankDecor(mesh, color);
      // Cache child refs by userData.layer
      mesh.traverse((child) => {
        if (child.userData.layer === 'tank-inner') tankInner = child as THREE.LineLoop;
        if (child.userData.layer === 'tank-ring-0') tankRing0 = child as THREE.LineLoop;
        if (child.userData.layer === 'tank-ring-1') tankRing1 = child as THREE.LineLoop;
      });
    }

    return {
      mesh,
      posX: 0, posY: 0,
      velX: 0, velY: 0,
      hp, maxHp: hp,
      type,
      active: false,
      age: 0,
      radius,
      rotationSpeed: type === 'chaser' ? 2 + Math.random() : 0.5 + Math.random() * 0.5,
      visualOffsetX: 0,
      visualOffsetY: 0,
      hitPulseTimer: 0,
      flashGlowTimer: 0,
      shootTimer: 0,
      tankInner,
      tankRing0,
      tankRing1,
    };
  }

  /** Add inner hexagon + 2 pulsing ring decorations to Tank mesh */
  private addTankDecor(mesh: THREE.Group, color: THREE.Color): void {
    // Inner hexagon at 55%
    const innerR = 28 * 0.55;
    const innerVerts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      innerVerts.push(innerR * Math.cos(a), innerR * Math.sin(a), 0.01);
    }
    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerVerts, 3));
    const innerMat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.5,
    });
    const innerHex = new THREE.LineLoop(innerGeo, innerMat);
    innerHex.userData.layer = 'tank-inner';
    mesh.add(innerHex);

    // 2 pulsing rings (circles at r=32)
    for (let ring = 0; ring < 2; ring++) {
      const segs = 32;
      const ringVerts: number[] = [];
      for (let i = 0; i < segs; i++) {
        const a = (Math.PI * 2 * i) / segs;
        ringVerts.push(32 * Math.cos(a), 32 * Math.sin(a), -0.01);
      }
      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringVerts, 3));
      const rMat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const rLoop = new THREE.LineLoop(rGeo, rMat);
      rLoop.userData.layer = `tank-ring-${ring}`;
      mesh.add(rLoop);
    }
  }

  private resetEnemy(e: EnemyData): void {
    e.active = false;
    e.mesh.visible = false;
    e.age = 0;
    e.shootTimer = 0;
  }

  // ─── Spawn ───────────────────────────────────────────────

  private spawnEnemy(type: EnemyType, x: number, y: number, playerX = 0, playerY = 0): void {
    const pool = type === 'swarm' ? this.swarmPool
      : type === 'tank' ? this.tankPool
      : this.chaserPool;

    const hp = type === 'tank' ? TANK_HP : type === 'swarm' ? SWARM_HP : CHASER_HP;
    const radius = type === 'tank' ? TANK_RADIUS : type === 'swarm' ? SWARM_RADIUS : CHASER_RADIUS;

    const e = pool.acquire();
    e.active = true;
    e.posX = x;
    e.posY = y;
    e.velX = 0;
    e.velY = 0;
    e.hp = hp;
    e.maxHp = hp;
    e.type = type;
    e.age = 0;
    e.radius = radius;

    e.mesh.visible = true;
    e.mesh.position.set(x, y, 0);
    e.mesh.scale.set(0.01, 0.01, 1);

    // Reset tank visual state (color)
    if (type === 'tank') {
      this.updateTankVisuals(e, 1.0);
    }

    // Swarm: set initial velocity aimed at player
    if (type === 'swarm') {
      const dx = playerX - x;
      const dy = playerY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        e.velX = (dx / dist) * SWARM_SPEED;
        e.velY = (dy / dist) * SWARM_SPEED;
      } else {
        e.velX = SWARM_SPEED;
        e.velY = 0;
      }
    }

    this.enemies.push(e);
  }

  spawnChaser(x: number, y: number): void { this.spawnEnemy('chaser', x, y); }
  spawnSwarm(x: number, y: number, playerX = 0, playerY = 0): void { this.spawnEnemy('swarm', x, y, playerX, playerY); }
  spawnTank(x: number, y: number): void { this.spawnEnemy('tank', x, y); }

  // ─── Update ──────────────────────────────────────────────

  update(dt: number, playerX: number, playerY: number): void {
    this._tankFireRequests.length = 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) {
        // Swap-and-pop instead of splice for O(1) removal
        this.enemies[i] = this.enemies[this.enemies.length - 1];
        this.enemies.pop();
        const pool = e.type === 'swarm' ? this.swarmPool
          : e.type === 'tank' ? this.tankPool
          : this.chaserPool;
        pool.release(e);
        continue;
      }

      e.age += dt;

      // Spawn pop animation
      if (e.age < SPAWN_POP_DURATION) {
        const t = e.age / SPAWN_POP_DURATION;
        const s = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - (t - 0.7) / 0.3 * 0.15;
        e.mesh.scale.set(s, s, 1);
      } else if (e.mesh.scale.x !== 1) {
        e.mesh.scale.set(1, 1, 1);
      }

      // Type-specific AI
      switch (e.type) {
        case 'chaser':
          this.updateChaser(e, dt, playerX, playerY);
          break;
        case 'swarm':
          this.updateSwarm(e, dt, playerX, playerY);
          break;
        case 'tank':
          this.updateTank(e, dt, playerX, playerY);
          break;
      }

      // Decay visual offset (fast spring-back)
      const decay = Math.pow(0.9, dt * 60);
      e.visualOffsetX *= decay;
      e.visualOffsetY *= decay;

      // FlashGlow decay: increase glow layer opacity temporarily
      if (e.flashGlowTimer > 0) {
        e.flashGlowTimer = Math.max(0, e.flashGlowTimer - dt);
        const glowChild = e.mesh.children[3] as THREE.LineLoop | undefined;
        if (glowChild?.material) {
          const mat = glowChild.material as THREE.LineBasicMaterial;
          const t = e.flashGlowTimer / 0.1; // 0.1s total duration
          mat.opacity = 0.15 + 0.35 * t; // 0.5 → 0.15
        }
      }

      // Mesh position sync (includes visual offset)
      e.mesh.position.x = e.posX + e.visualOffsetX;
      e.mesh.position.y = e.posY + e.visualOffsetY;
    }
  }

  // ─── Chaser AI ───────────────────────────────────────────

  private updateChaser(e: EnemyData, dt: number, playerX: number, playerY: number): void {
    const dx = playerX - e.posX;
    const dy = playerY - e.posY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      e.posX += (dx / dist) * CHASER_SPEED * dt;
      e.posY += (dy / dist) * CHASER_SPEED * dt;
    }

    // Self-rotation — accelerate when close
    const spinMul = dist < 200 ? 1.5 : 1.0;
    e.mesh.rotation.z += e.rotationSpeed * spinMul * dt;

    // Micro vibration
    applyMicroVibration(e.mesh, CHASER_VERTICES, 0.3, e.age);

    // Stretch front vertex when close
    if (dist < 150) {
      const stretchT = Math.min(1, (150 - dist) / 150);
      const innerFrame = e.mesh.children[1];
      if (innerFrame && (innerFrame as THREE.LineLoop).geometry) {
        const posAttr = (innerFrame as THREE.LineLoop).geometry.getAttribute('position');
        if (posAttr) {
          posAttr.setY(0, CHASER_VERTICES[0][1] * (1 + stretchT * 0.1));
          posAttr.needsUpdate = true;
        }
      }
    }
  }

  // ─── Swarm AI (linear bounce) ───────────────────────────

  private updateSwarm(e: EnemyData, dt: number, playerX: number, playerY: number): void {
    // Move in current velocity direction
    e.posX += e.velX * dt;
    e.posY += e.velY * dt;

    // Check screen edge — bounce toward player
    const bx = Bounds.halfW;
    const by = Bounds.halfH;
    let bounced = false;

    if (e.posX < -bx || e.posX > bx || e.posY < -by || e.posY > by) {
      // Clamp position to bounds
      e.posX = Math.max(-bx, Math.min(bx, e.posX));
      e.posY = Math.max(-by, Math.min(by, e.posY));

      // Re-aim toward player
      const dx = playerX - e.posX;
      const dy = playerY - e.posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        e.velX = (dx / dist) * SWARM_SPEED;
        e.velY = (dy / dist) * SWARM_SPEED;
      }
      bounced = true;
    }

    // Rotate to face movement direction
    if (Math.abs(e.velX) > 0.1 || Math.abs(e.velY) > 0.1) {
      const targetAngle = Math.atan2(e.velY, e.velX) - Math.PI / 2;
      e.mesh.rotation.z = lerpAngle(e.mesh.rotation.z, targetAngle, bounced ? 1 : 8 * dt);
    }

    applyMicroVibration(e.mesh, SWARM_VERTICES, 0.2, e.age + e.posX * 0.01);
  }

  // ─── Tank AI ─────────────────────────────────────────────

  private updateTank(e: EnemyData, dt: number, playerX: number, playerY: number): void {
    const dx = playerX - e.posX;
    const dy = playerY - e.posY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      e.posX += (dx / dist) * TANK_SPEED * dt;
      e.posY += (dy / dist) * TANK_SPEED * dt;
    }

    // Slow rotation
    e.mesh.rotation.z += e.rotationSpeed * dt;

    // Fire bullet every TANK_FIRE_INTERVAL (skip during spawn pop)
    if (e.age > SPAWN_POP_DURATION) {
      e.shootTimer += dt;
      if (e.shootTimer >= TANK_FIRE_INTERVAL) {
        e.shootTimer -= TANK_FIRE_INTERVAL;
        // Fire in the direction the tank is currently facing
        // mesh.rotation.z corresponds to the visual facing angle
        this._tankFireRequests.push({
          x: e.posX,
          y: e.posY,
          angle: e.mesh.rotation.z,
        });
      }
    }

    // HP-based visual state
    const hpRatio = e.hp / e.maxHp;
    this.updateTankVisuals(e, hpRatio);

    // Hit pulse timer decay
    if (e.hitPulseTimer > 0) e.hitPulseTimer = Math.max(0, e.hitPulseTimer - dt);

    // Pulsing rings (2 rings with phase offset π) + hit pulse expansion
    const hitExtra = e.hitPulseTimer > 0 ? 0.5 * (e.hitPulseTimer / 0.2) : 0;
    if (e.tankRing0) {
      const pulse = 1.0 + 0.12 * Math.sin(e.age * 4) + hitExtra;
      e.tankRing0.scale.set(pulse, pulse, 1);
    }
    if (e.tankRing1) {
      const pulse = 1.0 + 0.12 * Math.sin(e.age * 4 + Math.PI) + hitExtra;
      e.tankRing1.scale.set(pulse, pulse, 1);
    }

    // Tremble at low HP
    if (hpRatio <= 0.2) {
      e.mesh.position.x += (Math.random() - 0.5) * 2;
      e.mesh.position.y += (Math.random() - 0.5) * 2;
    }

    applyMicroVibration(e.mesh, TANK_VERTICES, 0.15, e.age);
  }

  /** Tint tank mesh based on remaining HP ratio */
  private updateTankVisuals(e: EnemyData, hpRatio: number): void {
    if (!e.tankInner) return;
    _tmpColor.copy(COLOR_TANK);
    if (hpRatio <= 0.2) {
      _tmpColor.lerp(COLOR_TANK_HURT_20, 0.7);
    } else if (hpRatio <= 0.5) {
      _tmpColor.lerp(COLOR_TANK_HURT_50, 0.4);
    }
    (e.tankInner.material as THREE.LineBasicMaterial).color.copy(_tmpColor);
  }

  // ─── Kill / Query ────────────────────────────────────────

  /** Trigger hit pulse on a tank enemy (rings expand 1.5x then spring back) */
  triggerHitPulse(x: number, y: number): void {
    for (const e of this.enemies) {
      if (!e.active || e.type !== 'tank') continue;
      const dx = e.posX - x;
      const dy = e.posY - y;
      if (dx * dx + dy * dy < 10) { // very close to the hit position
        e.hitPulseTimer = 0.2;
        break;
      }
    }
  }

  /** Flash the glow layer of a specific enemy (near-miss feedback). */
  flashGlow(enemy: EnemyData): void {
    if (!enemy.active) return;
    enemy.flashGlowTimer = 0.1;
  }

  kill(enemy: EnemyData): void {
    enemy.active = false;
  }

  /** Apply visual-only knockback push from an origin point (e.g. kill position) */
  applyVisualKnockback(originX: number, originY: number, radius = 120, strength = 8): void {
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.posX - originX;
      const dy = e.posY - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 0.01) {
        const factor = (1 - dist / radius) * strength;
        e.visualOffsetX += (dx / dist) * factor;
        e.visualOffsetY += (dy / dist) * factor;
      }
    }
  }

  get activeEnemies(): ReadonlyArray<EnemyData> {
    return this.enemies;
  }

  get tankFireRequests(): ReadonlyArray<TankFireRequest> {
    return this._tankFireRequests;
  }

  get activeCount(): number {
    return this.enemies.length;
  }

  reset(): void {
    for (const e of this.enemies) {
      e.active = false;
      e.mesh.visible = false;
      const pool = e.type === 'swarm' ? this.swarmPool
        : e.type === 'tank' ? this.tankPool
        : this.chaserPool;
      pool.release(e);
    }
    this.enemies.length = 0;
  }
}

// ─── Utility ────────────────────────────────────────────────

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(t, 1);
}
