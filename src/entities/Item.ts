import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool';

// ─── Item Types ────────────────────────────────────────
export type ItemType = 'bomb' | 'double_shot' | 'omni_shot' | 'barrier';

// ─── Drop Probabilities (easily tunable) ───────────────
export const DROP_CHANCE_BOMB = 0.02;        // 2%
export const DROP_CHANCE_DOUBLE_SHOT = 0.15; // 15%
export const DROP_CHANCE_OMNI_SHOT = 0.10;   // 10%
export const DROP_CHANCE_BARRIER = 0.05;     // 5%

// ─── Item Constants ────────────────────────────────────
export const ITEM_LIFETIME = 10.0;
export const ITEM_BLINK_START = 5.0;
export const ITEM_RADIUS = 20;

const POOL_SIZE = 20;
const CIRCLE_SEGMENTS = 24;
const OUTER_RING_RADIUS = 16;
const GLOW_RING_RADIUS = 22;

// ─── Item Colors ───────────────────────────────────────
export const ITEM_COLORS: Record<ItemType, THREE.Color> = {
  bomb: new THREE.Color(0xff6644),
  double_shot: new THREE.Color(0xffff00),
  omni_shot: new THREE.Color(0x00ffff),
  barrier: new THREE.Color(0x4488ff),
};

export interface ItemData {
  mesh: THREE.Group;
  posX: number;
  posY: number;
  type: ItemType;
  active: boolean;
  age: number;
  radius: number;
}

// ─── Drop probability table (cumulative) ───────────────
const DROP_TABLE: { type: ItemType; cumulative: number }[] = (() => {
  let acc = 0;
  const table: { type: ItemType; cumulative: number }[] = [];
  acc += DROP_CHANCE_BOMB;
  table.push({ type: 'bomb', cumulative: acc });
  acc += DROP_CHANCE_DOUBLE_SHOT;
  table.push({ type: 'double_shot', cumulative: acc });
  acc += DROP_CHANCE_OMNI_SHOT;
  table.push({ type: 'omni_shot', cumulative: acc });
  acc += DROP_CHANCE_BARRIER;
  table.push({ type: 'barrier', cumulative: acc });
  return table;
})();

// ─── Helpers: create circle geometry ───────────────────
function createCirclePoints(radius: number, segments: number): Float32Array {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(angle) * radius;
    pts[i * 3 + 1] = Math.sin(angle) * radius;
    pts[i * 3 + 2] = 0;
  }
  return pts;
}

// ─── Helpers: create item inner icon shapes ────────────
function createBombIcon(): THREE.Group {
  const g = new THREE.Group();
  // Small filled circle
  const geo = new THREE.CircleGeometry(6, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff6644,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  g.add(new THREE.Mesh(geo, mat));
  // Fuse line
  const fuseGeo = new THREE.BufferGeometry();
  fuseGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    3, 4, 0, 6, 10, 0,
  ], 3));
  const fuseMat = new THREE.LineBasicMaterial({
    color: 0xffaa44,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  g.add(new THREE.Line(fuseGeo, fuseMat));
  return g;
}

function createDoubleShotIcon(): THREE.Group {
  const g = new THREE.Group();
  // Two vertical bars
  for (const offsetX of [-4, 4]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      offsetX, -6, 0, offsetX, 6, 0,
    ], 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
    });
    g.add(new THREE.Line(geo, mat));
  }
  return g;
}

function createOmniShotIcon(): THREE.Group {
  const g = new THREE.Group();
  // Four directional arrows (simple lines from center outward)
  const dirs = [[0, 7], [0, -7], [-7, 0], [7, 0]];
  for (const [dx, dy] of dirs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, dx, dy, 0,
    ], 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    g.add(new THREE.Line(geo, mat));
  }
  // Small center dot
  const dotGeo = new THREE.CircleGeometry(2, 8);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  g.add(new THREE.Mesh(dotGeo, dotMat));
  return g;
}

function createBarrierIcon(): THREE.Group {
  const g = new THREE.Group();
  // Shield arc (half circle on top)
  const pts: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const angle = (i / 12) * Math.PI;
    pts.push(Math.cos(angle) * 7, Math.sin(angle) * 7, 0);
  }
  // Close bottom
  pts.push(-7, 0, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  g.add(new THREE.Line(geo, mat));
  return g;
}

const ICON_FACTORIES: Record<ItemType, () => THREE.Group> = {
  bomb: createBombIcon,
  double_shot: createDoubleShotIcon,
  omni_shot: createOmniShotIcon,
  barrier: createBarrierIcon,
};

export class ItemManager {
  readonly group = new THREE.Group();
  private items: ItemData[] = [];
  private pool: ObjectPool<ItemData>;

  constructor() {
    this.pool = new ObjectPool<ItemData>(
      () => this.createItemData(),
      (item) => this.resetItem(item),
      POOL_SIZE,
    );
    this.group.position.z = 0.7;
  }

  private createItemData(): ItemData {
    const mesh = new THREE.Group();

    // Outer ring (border)
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(
      createCirclePoints(OUTER_RING_RADIUS, CIRCLE_SEGMENTS), 3,
    ));
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    ring.name = 'ring';
    mesh.add(ring);

    // Glow shell (larger, dim)
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(
      createCirclePoints(GLOW_RING_RADIUS, CIRCLE_SEGMENTS), 3,
    ));
    const glowMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.LineLoop(glowGeo, glowMat);
    glow.name = 'glow';
    mesh.add(glow);

    // Icon container (will be swapped per type)
    const iconContainer = new THREE.Group();
    iconContainer.name = 'icon_container';
    mesh.add(iconContainer);

    mesh.visible = false;
    this.group.add(mesh);

    return {
      mesh,
      posX: 0,
      posY: 0,
      type: 'bomb',
      active: false,
      age: 0,
      radius: ITEM_RADIUS,
    };
  }

  private resetItem(item: ItemData): void {
    item.active = false;
    item.mesh.visible = false;
    item.age = 0;
  }

  /** Configure mesh appearance for a given item type */
  private configureMesh(item: ItemData, type: ItemType): void {
    const color = ITEM_COLORS[type];

    // Update ring color
    const ring = item.mesh.getObjectByName('ring') as THREE.LineLoop;
    if (ring) (ring.material as THREE.LineBasicMaterial).color.copy(color);

    // Update glow color
    const glow = item.mesh.getObjectByName('glow') as THREE.LineLoop;
    if (glow) (glow.material as THREE.LineBasicMaterial).color.copy(color);

    // Replace icon
    const container = item.mesh.getObjectByName('icon_container') as THREE.Group;
    if (container) {
      // Remove old icon children
      while (container.children.length > 0) {
        const child = container.children[0];
        container.remove(child);
        // Dispose geometry/material
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      }
      const icon = ICON_FACTORIES[type]();
      for (const child of [...icon.children]) {
        container.add(child);
      }
    }
  }

  /** Check if an item of given type already exists on the map */
  private hasActiveItemOfType(type: ItemType): boolean {
    for (const item of this.items) {
      if (item.active && item.type === type) return true;
    }
    return false;
  }

  /** Roll drop probability and spawn item at position */
  trySpawnDrop(x: number, y: number): void {
    const roll = Math.random();
    for (const entry of DROP_TABLE) {
      if (roll < entry.cumulative) {
        if (this.hasActiveItemOfType(entry.type)) return;
        this.spawn(x, y, entry.type);
        return;
      }
    }
    // No drop (65% chance)
  }

  private spawn(x: number, y: number, type: ItemType): void {
    const item = this.pool.acquire();
    item.active = true;
    item.age = 0;
    item.posX = x;
    item.posY = y;
    item.type = type;

    this.configureMesh(item, type);

    item.mesh.visible = true;
    item.mesh.position.set(x, y, 0);
    item.mesh.scale.set(0.1, 0.1, 1);

    this.items.push(item);
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.active) {
        // Swap-and-pop removal
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
        this.pool.release(item);
        continue;
      }

      item.age += dt;

      // Expiry
      if (item.age >= ITEM_LIFETIME) {
        item.active = false;
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
        this.pool.release(item);
        continue;
      }

      // Spawn pop-in animation (scale 0.1 → 1.0 over 0.2s)
      if (item.age < 0.2) {
        const t = item.age / 0.2;
        const s = t * (2 - t); // ease-out quad
        item.mesh.scale.set(s, s, 1);
      } else if (item.mesh.scale.x < 0.99) {
        item.mesh.scale.set(1, 1, 1);
      }

      // Blinking after ITEM_BLINK_START
      if (item.age >= ITEM_BLINK_START) {
        const elapsed = item.age - ITEM_BLINK_START;
        const remaining = ITEM_LIFETIME - ITEM_BLINK_START;
        const progress = elapsed / remaining; // 0→1
        const blinkRate = 6 + progress * 10;  // 6Hz → 16Hz
        item.mesh.visible = Math.floor(item.age * blinkRate) % 2 === 0;
      } else {
        item.mesh.visible = true;
      }

      // Gentle float bob
      item.mesh.position.y = item.posY + Math.sin(item.age * 3) * 3;

      // Slow rotation
      item.mesh.rotation.z += dt * 1.0;
    }
  }

  get activeItems(): ReadonlyArray<ItemData> {
    return this.items;
  }

  get activeCount(): number {
    return this.items.length;
  }

  collect(item: ItemData): void {
    item.active = false;
  }

  reset(): void {
    for (const item of this.items) {
      item.active = false;
      item.mesh.visible = false;
      this.pool.release(item);
    }
    this.items.length = 0;
  }
}
