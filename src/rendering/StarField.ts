import * as THREE from 'three';

interface StarData {
  phase: number;
  twinkleSpeed: number;
  baseAlpha: number;
  vx: number;
  vy: number;
}

/**
 * Twinkling star points in 3 size categories.
 * Cool white-blue color palette with sine-wave alpha oscillation.
 */
export class StarField {
  readonly group = new THREE.Group();

  private layers: {
    points: THREE.Points;
    stars: StarData[];
    colors: Float32Array;
  }[] = [];

  private readonly worldW: number;
  private readonly worldH: number;

  private static readonly COLORS = [
    [0.78, 0.84, 1.0],   // cool white-blue
    [0.70, 0.80, 0.95],   // pale blue
    [0.85, 0.90, 1.0],    // bright white-blue
    [0.65, 0.75, 0.92],   // deeper blue
    [1.0, 1.0, 1.0],      // pure white
  ];

  private static readonly LAYERS = [
    { count: 50, size: 1.5, baseAlpha: 0.3 },
    { count: 25, size: 3.0, baseAlpha: 0.5 },
    { count: 8, size: 5.0, baseAlpha: 0.7 },
  ];

  constructor(worldWidth: number, worldHeight: number) {
    this.worldW = worldWidth * 1.5;
    this.worldH = worldHeight * 1.5;
    this.group.position.z = -9;

    for (const layer of StarField.LAYERS) {
      this.createLayer(layer.count, layer.size, layer.baseAlpha);
    }
  }

  private createLayer(count: number, size: number, baseAlpha: number): void {
    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const stars: StarData[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.worldW;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.worldH;
      positions[i * 3 + 2] = 0;

      const c = StarField.COLORS[Math.floor(Math.random() * StarField.COLORS.length)];
      colors[i * 4] = c[0];
      colors[i * 4 + 1] = c[1];
      colors[i * 4 + 2] = c[2];
      colors[i * 4 + 3] = baseAlpha;

      stars.push({
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 1.5,
        baseAlpha,
        vx: -3 + Math.random() * 1.5,  // slow leftward drift
        vy: -5 + Math.random() * 2,     // slow downward drift
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

    const mat = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.layers.push({ points, stars, colors });
  }

  update(dt: number, elapsed: number): void {
    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;

    for (const layer of this.layers) {
      const posAttr = layer.points.geometry.getAttribute('position');
      const posArr = posAttr.array as Float32Array;
      const colAttr = layer.points.geometry.getAttribute('color');

      for (let i = 0; i < layer.stars.length; i++) {
        const star = layer.stars[i];

        // Drift
        posArr[i * 3] += star.vx * dt;
        posArr[i * 3 + 1] += star.vy * dt;

        // Wrap
        if (posArr[i * 3] < -halfW) posArr[i * 3] += this.worldW;
        if (posArr[i * 3] > halfW) posArr[i * 3] -= this.worldW;
        if (posArr[i * 3 + 1] < -halfH) posArr[i * 3 + 1] += this.worldH;
        if (posArr[i * 3 + 1] > halfH) posArr[i * 3 + 1] -= this.worldH;

        // Twinkle
        const alpha = star.baseAlpha + Math.sin(elapsed * star.twinkleSpeed + star.phase) * 0.15;
        layer.colors[i * 4 + 3] = Math.max(0.05, Math.min(1, alpha));
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
  }
}
