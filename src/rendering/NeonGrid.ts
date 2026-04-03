import * as THREE from 'three';

/**
 * Dynamic scrolling grid background with player-proximity warping.
 * Two layers: minor (thin, dim) and major (brighter, every 4th line).
 */
export class NeonGrid {
  readonly group = new THREE.Group();

  private minorGeo: THREE.BufferGeometry;
  private majorGeo: THREE.BufferGeometry;
  private minorBasePositions: Float32Array;
  private majorBasePositions: Float32Array;

  private scrollOffset = 0;
  private readonly scrollSpeed = 20; // units/s
  private readonly warpRadius = 200;
  private readonly warpStrength = 30;
  private readonly minorSpacing = 50;
  private readonly majorSpacing = 200;

  private worldW: number;
  private worldH: number;

  // Explosion shockwaves
  private shockwaves: Array<{
    x: number; y: number;
    elapsed: number; duration: number;
    maxRadius: number; strength: number;
  }> = [];

  constructor(worldWidth: number, worldHeight: number) {
    this.worldW = worldWidth * 1.5;
    this.worldH = worldHeight * 1.5;
    this.group.position.z = -10;

    // Minor grid
    const minorResult = this.buildGridSegments(this.minorSpacing);
    this.minorBasePositions = minorResult.positions;
    this.minorGeo = new THREE.BufferGeometry();
    this.minorGeo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(this.minorBasePositions), 3,
    ));
    const minorMat = new THREE.LineBasicMaterial({
      color: 0x0f2030,
      transparent: true,
      opacity: 0.12,
    });
    this.group.add(new THREE.LineSegments(this.minorGeo, minorMat));

    // Major grid
    const majorResult = this.buildGridSegments(this.majorSpacing);
    this.majorBasePositions = majorResult.positions;
    this.majorGeo = new THREE.BufferGeometry();
    this.majorGeo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(this.majorBasePositions), 3,
    ));
    const majorMat = new THREE.LineBasicMaterial({
      color: 0x1a3a5a,
      transparent: true,
      opacity: 0.25,
    });
    this.group.add(new THREE.LineSegments(this.majorGeo, majorMat));
  }

  private buildGridSegments(spacing: number): { positions: Float32Array } {
    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;
    const segments: number[] = [];

    // Horizontal lines
    for (let y = -halfH; y <= halfH; y += spacing) {
      segments.push(-halfW, y, 0, halfW, y, 0);
    }
    // Vertical lines
    for (let x = -halfW; x <= halfW; x += spacing) {
      segments.push(x, -halfH, 0, x, halfH, 0);
    }

    return { positions: new Float32Array(segments) };
  }

  addShockwave(x: number, y: number): void {
    this.shockwaves.push({
      x, y, elapsed: 0, duration: 0.6, maxRadius: 250, strength: 20,
    });
  }

  update(dt: number, playerX: number, playerY: number): void {
    this.scrollOffset = (this.scrollOffset + this.scrollSpeed * dt) % this.minorSpacing;

    // Advance shockwave timers
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].elapsed += dt;
      if (this.shockwaves[i].elapsed >= this.shockwaves[i].duration) {
        this.shockwaves.splice(i, 1);
      }
    }

    this.applyWarp(this.minorGeo, this.minorBasePositions, playerX, playerY);
    this.applyWarp(this.majorGeo, this.majorBasePositions, playerX, playerY);
  }

  private applyWarp(
    geo: THREE.BufferGeometry,
    basePositions: Float32Array,
    playerX: number,
    playerY: number,
  ): void {
    const posAttr = geo.getAttribute('position');
    const arr = posAttr.array as Float32Array;
    const r2 = this.warpRadius * this.warpRadius;

    for (let i = 0; i < basePositions.length; i += 3) {
      const bx = basePositions[i];
      const by = basePositions[i + 1] + this.scrollOffset;

      // Warp based on player proximity
      const dx = bx - playerX;
      const dy = by - playerY;
      const dist2 = dx * dx + dy * dy;

      let wx = 0;
      let wy = 0;

      // Player proximity warp
      if (dist2 < r2 && dist2 > 0.01) {
        const dist = Math.sqrt(dist2);
        const factor = (1 - dist / this.warpRadius) * this.warpStrength;
        wx = (dx / dist) * factor;
        wy = (dy / dist) * factor;
      }

      // Explosion shockwave displacement
      for (const sw of this.shockwaves) {
        const sdx = bx - sw.x;
        const sdy = by - sw.y;
        const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
        const t = sw.elapsed / sw.duration;
        const waveR = sw.maxRadius * t;
        const band = 30; // half-width of the wave front band
        const distFromFront = Math.abs(sDist - waveR);

        if (distFromFront < band && sDist > 0.01) {
          const bandFactor = 1 - distFromFront / band; // 1 at front, 0 at edge
          const decay = 1 - t; // fades over time
          const push = bandFactor * decay * sw.strength;
          wx += (sdx / sDist) * push;
          wy += (sdy / sDist) * push;
        }
      }

      arr[i] = bx + wx;
      arr[i + 1] = by + wy;
      arr[i + 2] = 0;
    }

    posAttr.needsUpdate = true;
  }
}
