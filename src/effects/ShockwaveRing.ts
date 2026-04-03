import * as THREE from 'three';

/**
 * ShockwaveRing — pooled expanding circle rings on enemy kill.
 *
 * Each ring expands from radius 0 → maxRadius over `duration` seconds,
 * fading from full opacity to 0. Two concentric LineLoops simulate thickness.
 */

const POOL_SIZE = 10;
const SEGMENTS = 64;
const MAX_RADIUS = 100;
const DURATION = 0.3;

interface RingEntry {
  outer: THREE.LineLoop;
  inner: THREE.LineLoop;
  cx: number;
  cy: number;
  elapsed: number;
  active: boolean;
  color: THREE.Color;
}

export class ShockwaveRing {
  readonly group = new THREE.Group();
  private pool: RingEntry[] = [];

  constructor() {
    this.group.position.z = 1.5;

    for (let i = 0; i < POOL_SIZE; i++) {
      const outerGeo = this.createCircleGeometry();
      const innerGeo = this.createCircleGeometry();

      const outerMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const innerMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const outer = new THREE.LineLoop(outerGeo, outerMat);
      const inner = new THREE.LineLoop(innerGeo, innerMat);
      outer.visible = false;
      inner.visible = false;

      this.group.add(outer, inner);
      this.pool.push({
        outer, inner,
        cx: 0, cy: 0,
        elapsed: 0,
        active: false,
        color: new THREE.Color(0x00ffff),
      });
    }
  }

  private createCircleGeometry(): THREE.BufferGeometry {
    const positions = new Float32Array((SEGMENTS + 1) * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }

  private setCircle(geo: THREE.BufferGeometry, cx: number, cy: number, radius: number): void {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i <= SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      arr[i * 3] = cx + Math.cos(angle) * radius;
      arr[i * 3 + 1] = cy + Math.sin(angle) * radius;
      arr[i * 3 + 2] = 0;
    }
    pos.needsUpdate = true;
  }

  trigger(x: number, y: number, color?: THREE.Color): void {
    // Find inactive entry
    const entry = this.pool.find(e => !e.active);
    if (!entry) return;

    entry.cx = x;
    entry.cy = y;
    entry.elapsed = 0;
    entry.active = true;
    if (color) entry.color.copy(color);
    else entry.color.set(0x00ffff);

    entry.outer.visible = true;
    entry.inner.visible = true;
    (entry.outer.material as THREE.LineBasicMaterial).color.copy(entry.color);
    (entry.inner.material as THREE.LineBasicMaterial).color.copy(entry.color);
  }

  update(dt: number): void {
    for (const entry of this.pool) {
      if (!entry.active) continue;

      entry.elapsed += dt;
      const t = entry.elapsed / DURATION;

      if (t >= 1) {
        entry.active = false;
        entry.outer.visible = false;
        entry.inner.visible = false;
        continue;
      }

      const radius = MAX_RADIUS * t;
      const outerR = radius + 1.5 * (1 - t); // thicker at start, converges
      const innerR = Math.max(0, radius - 0.5 * (1 - t));

      this.setCircle(entry.outer.geometry, entry.cx, entry.cy, outerR);
      this.setCircle(entry.inner.geometry, entry.cx, entry.cy, innerR);

      const alpha = 1 - t;
      (entry.outer.material as THREE.LineBasicMaterial).opacity = alpha * 0.8;
      (entry.inner.material as THREE.LineBasicMaterial).opacity = alpha * 0.5;
    }
  }
}
