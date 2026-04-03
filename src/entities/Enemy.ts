import * as THREE from 'three';
import {
  createNeonShape,
  CHASER_VERTICES,
  SWARM_VERTICES,
  TANK_VERTICES,
  applyMicroVibration,
} from '../rendering/NeonShapes';
import { ObjectPool } from '../utils/ObjectPool';

// ─── Constants ──────────────────────────────────────────────
const CHASER_SPEED = 160;
const CHASER_HP = 1;
const CHASER_RADIUS = 18;

const SWARM_SPEED = 200;
const SWARM_HP = 1;
const SWARM_RADIUS = 12;
const SWARM_NEIGHBOR_DIST = 60;   // boid neighbour range
const SWARM_SEP_WEIGHT = 1.2;
const SWARM_ALI_WEIGHT = 1.0;
const SWARM_COH_WEIGHT = 0.8;
const SWARM_CHASE_WEIGHT = 3.0;   // dominant force — always chase player

const TANK_SPEED = 120;
const TANK_HP = 5;
const TANK_RADIUS = 28;

const SPAWN_POP_DURATION = 0.3;

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
}

// ─── EnemyManager ───────────────────────────────────────────

export class EnemyManager {
  readonly group = new THREE.Group();
  private enemies: EnemyData[] = [];

  // Separate pools per type so meshes are pre-built with correct shape/color
  private chaserPool: ObjectPool<EnemyData>;
  private swarmPool: ObjectPool<EnemyData>;
  private tankPool: ObjectPool<EnemyData>;

  // Swarm connection lines (drawn between nearby swarm units)
  private swarmLineMat: THREE.LineBasicMaterial;
  private swarmLineGeo: THREE.BufferGeometry;
  private swarmLines: THREE.LineSegments;
  private readonly MAX_SWARM_CONNECTIONS = 200;

  // Swarm cluster glow (single large dim point at centroid)
  private swarmClusterGlow: THREE.Points;

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

    // Swarm connection lines setup
    this.swarmLineMat = new THREE.LineBasicMaterial({
      color: 0x33ff88,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.swarmLineGeo = new THREE.BufferGeometry();
    const lineBuf = new Float32Array(this.MAX_SWARM_CONNECTIONS * 6); // 2 verts × 3 floats
    this.swarmLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineBuf, 3));
    this.swarmLineGeo.setDrawRange(0, 0);
    this.swarmLines = new THREE.LineSegments(this.swarmLineGeo, this.swarmLineMat);
    this.swarmLines.frustumCulled = false;
    this.swarmLines.position.z = 0.7;
    this.group.add(this.swarmLines);

    // Swarm cluster glow
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const glowMat = new THREE.PointsMaterial({
      color: 0x33ff88,
      size: 80,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.swarmClusterGlow = new THREE.Points(glowGeo, glowMat);
    this.swarmClusterGlow.visible = false;
    this.swarmClusterGlow.position.z = 0.6;
    this.group.add(this.swarmClusterGlow);
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
    if (type === 'tank') {
      this.addTankDecor(mesh, color);
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
  }

  // ─── Spawn ───────────────────────────────────────────────

  private spawnEnemy(type: EnemyType, x: number, y: number): void {
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

    this.enemies.push(e);
  }

  spawnChaser(x: number, y: number): void { this.spawnEnemy('chaser', x, y); }
  spawnSwarm(x: number, y: number): void { this.spawnEnemy('swarm', x, y); }
  spawnTank(x: number, y: number): void { this.spawnEnemy('tank', x, y); }

  // ─── Update ──────────────────────────────────────────────

  update(dt: number, playerX: number, playerY: number): void {
    // Collect active swarm units for boid computation
    const swarms: EnemyData[] = [];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) {
        this.enemies.splice(i, 1);
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
          swarms.push(e);
          break;
        case 'tank':
          this.updateTank(e, dt, playerX, playerY);
          break;
      }

      // Decay visual offset (fast spring-back)
      const decay = Math.pow(0.9, dt * 60);
      e.visualOffsetX *= decay;
      e.visualOffsetY *= decay;

      // Mesh position sync (includes visual offset)
      e.mesh.position.x = e.posX + e.visualOffsetX;
      e.mesh.position.y = e.posY + e.visualOffsetY;
    }

    // Boid update for swarms (need the full list)
    if (swarms.length > 0) {
      this.updateSwarms(swarms, dt, playerX, playerY);
      this.updateSwarmConnections(swarms);
    } else {
      this.swarmLineGeo.setDrawRange(0, 0);
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

  // ─── Swarm AI (simplified Boid) ──────────────────────────

  private updateSwarms(swarms: EnemyData[], dt: number, playerX: number, playerY: number): void {
    // World boundary for soft clamping
    const boundX = 960 + 120; // WORLD_WIDTH/2 + margin
    const boundY = 540 + 120;

    for (const e of swarms) {
      let sepX = 0, sepY = 0;
      let aliX = 0, aliY = 0;
      let cohX = 0, cohY = 0;
      let neighbors = 0;

      for (const o of swarms) {
        if (o === e) continue;
        const dx = e.posX - o.posX;
        const dy = e.posY - o.posY;
        const distSq = dx * dx + dy * dy;
        if (distSq < SWARM_NEIGHBOR_DIST * SWARM_NEIGHBOR_DIST && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          // Separation: push away from nearby
          sepX += (dx / dist) * (1 - dist / SWARM_NEIGHBOR_DIST);
          sepY += (dy / dist) * (1 - dist / SWARM_NEIGHBOR_DIST);
          // Alignment: average velocity direction
          aliX += o.velX;
          aliY += o.velY;
          // Cohesion: average position
          cohX += o.posX;
          cohY += o.posY;
          neighbors++;
        }
      }

      if (neighbors > 0) {
        aliX /= neighbors;
        aliY /= neighbors;
        cohX = cohX / neighbors - e.posX;
        cohY = cohY / neighbors - e.posY;
      }

      // Chase vector toward player (always active, dominant force)
      const tpx = playerX - e.posX;
      const tpy = playerY - e.posY;
      const tpDist = Math.sqrt(tpx * tpx + tpy * tpy);
      const chaseX = tpDist > 1 ? tpx / tpDist : 0;
      const chaseY = tpDist > 1 ? tpy / tpDist : 0;

      // Combine forces
      let fx = sepX * SWARM_SEP_WEIGHT + aliX * SWARM_ALI_WEIGHT + cohX * SWARM_COH_WEIGHT + chaseX * SWARM_CHASE_WEIGHT;
      let fy = sepY * SWARM_SEP_WEIGHT + aliY * SWARM_ALI_WEIGHT + cohY * SWARM_COH_WEIGHT + chaseY * SWARM_CHASE_WEIGHT;

      // Boundary steering: strong push back toward play area
      if (e.posX < -boundX) fx += (-boundX - e.posX) * 0.05;
      if (e.posX > boundX)  fx += (boundX - e.posX) * 0.05;
      if (e.posY < -boundY) fy += (-boundY - e.posY) * 0.05;
      if (e.posY > boundY)  fy += (boundY - e.posY) * 0.05;

      // Normalize and apply speed
      const fLen = Math.sqrt(fx * fx + fy * fy);
      if (fLen > 0.01) {
        fx = (fx / fLen) * SWARM_SPEED;
        fy = (fy / fLen) * SWARM_SPEED;
      }

      // Fast velocity convergence (especially important at spawn)
      const lerpRate = Math.min(8.0 * dt, 1.0);
      e.velX += (fx - e.velX) * lerpRate;
      e.velY += (fy - e.velY) * lerpRate;
      e.posX += e.velX * dt;
      e.posY += e.velY * dt;

      // Rotate to face movement direction
      if (Math.abs(e.velX) > 0.1 || Math.abs(e.velY) > 0.1) {
        const targetAngle = Math.atan2(e.velY, e.velX) - Math.PI / 2;
        e.mesh.rotation.z = lerpAngle(e.mesh.rotation.z, targetAngle, 5 * dt);
      }

      // Micro-vibration per individual (offset by posX for variety)
      applyMicroVibration(e.mesh, SWARM_VERTICES, 0.2, e.age + e.posX * 0.01);

      // Individual wobble (unique phase per entity)
      const wobble = Math.sin(e.age * 4 + e.posX * 0.1) * 2;

      e.mesh.position.x = e.posX + e.visualOffsetX;
      e.mesh.position.y = e.posY + e.visualOffsetY + wobble;

      // Density-based glow: brighten glow layer based on neighbor count
      const glowChild = e.mesh.children[3]; // glow shell is 4th child (index 3)
      if (glowChild && (glowChild as THREE.LineLoop).material) {
        const mat = (glowChild as THREE.LineLoop).material as THREE.LineBasicMaterial;
        mat.opacity = 0.15 + Math.min(neighbors * 0.03, 0.25);
      }
    }

    // Update cluster glow centroid
    if (swarms.length >= 3) {
      let cx = 0, cy = 0;
      for (const s of swarms) { cx += s.posX; cy += s.posY; }
      cx /= swarms.length;
      cy /= swarms.length;
      const posAttr = this.swarmClusterGlow.geometry.getAttribute('position');
      posAttr.setXYZ(0, cx, cy, 0);
      posAttr.needsUpdate = true;
      this.swarmClusterGlow.visible = true;
    } else {
      this.swarmClusterGlow.visible = false;
    }
  }

  /** Draw connection lines between nearby swarm units */
  private updateSwarmConnections(swarms: EnemyData[]): void {
    const posArr = this.swarmLineGeo.getAttribute('position').array as Float32Array;
    let idx = 0;
    const maxPairs = this.MAX_SWARM_CONNECTIONS;

    for (let i = 0; i < swarms.length && idx < maxPairs; i++) {
      for (let j = i + 1; j < swarms.length && idx < maxPairs; j++) {
        const dx = swarms[i].posX - swarms[j].posX;
        const dy = swarms[i].posY - swarms[j].posY;
        if (dx * dx + dy * dy < SWARM_NEIGHBOR_DIST * SWARM_NEIGHBOR_DIST) {
          const off = idx * 6;
          posArr[off] = swarms[i].posX;
          posArr[off + 1] = swarms[i].posY;
          posArr[off + 2] = 0;
          posArr[off + 3] = swarms[j].posX;
          posArr[off + 4] = swarms[j].posY;
          posArr[off + 5] = 0;
          idx++;
        }
      }
    }
    this.swarmLineGeo.setDrawRange(0, idx * 2);
    (this.swarmLineGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
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

    // HP-based visual state
    const hpRatio = e.hp / e.maxHp;
    this.updateTankVisuals(e, hpRatio);

    // Hit pulse timer decay
    if (e.hitPulseTimer > 0) e.hitPulseTimer = Math.max(0, e.hitPulseTimer - dt);

    // Pulsing rings (2 rings with phase offset π) + hit pulse expansion
    const hitExtra = e.hitPulseTimer > 0 ? 0.5 * (e.hitPulseTimer / 0.2) : 0;
    e.mesh.traverse((child) => {
      if (child.userData.layer === 'tank-ring-0') {
        const pulse = 1.0 + 0.12 * Math.sin(e.age * 4) + hitExtra;
        child.scale.set(pulse, pulse, 1);
      }
      if (child.userData.layer === 'tank-ring-1') {
        const pulse = 1.0 + 0.12 * Math.sin(e.age * 4 + Math.PI) + hitExtra;
        child.scale.set(pulse, pulse, 1);
      }
    });

    // Tremble at low HP
    if (hpRatio <= 0.2) {
      e.mesh.position.x += (Math.random() - 0.5) * 2;
      e.mesh.position.y += (Math.random() - 0.5) * 2;
    }

    applyMicroVibration(e.mesh, TANK_VERTICES, 0.15, e.age);
  }

  /** Tint tank mesh based on remaining HP ratio */
  private updateTankVisuals(e: EnemyData, hpRatio: number): void {
    // 100% → bright purple, 50% → reddish shift, 20% → red + tremble
    const baseColor = COLOR_TANK.clone();
    if (hpRatio <= 0.2) {
      baseColor.lerp(new THREE.Color(0xff2222), 0.7);
    } else if (hpRatio <= 0.5) {
      baseColor.lerp(new THREE.Color(0xff4444), 0.4);
    }

    e.mesh.traverse((child) => {
      if (child.userData.layer === 'inner' && child instanceof THREE.LineLoop) {
        (child.material as THREE.LineBasicMaterial).color.copy(baseColor);
      }
    });
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

  get activeCount(): number {
    return this.enemies.length;
  }

  reset(): void {
    // Deactivate all enemies so next update cycle returns them to pool
    for (const e of this.enemies) {
      e.active = false;
      e.mesh.visible = false;
    }
  }
}

// ─── Utility ────────────────────────────────────────────────

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(t, 1);
}
