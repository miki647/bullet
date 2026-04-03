import * as THREE from 'three';

export class EngineTrail {
  private trailGroup: THREE.Group;
  private trailPoints: THREE.Points;
  private trailLine: THREE.Line;
  private positions: Float32Array;
  private colors: Float32Array;
  private linePositions: Float32Array;
  private head = 0;
  private readonly trailLength: number;

  constructor(trailLength = 15, color = new THREE.Color(0x00ffff)) {
    this.trailLength = trailLength;
    this.positions = new Float32Array(trailLength * 3);
    this.colors = new Float32Array(trailLength * 4);
    this.linePositions = new Float32Array(trailLength * 3);
    this.trailGroup = new THREE.Group();

    // Initialize all trail points off-screen
    for (let i = 0; i < trailLength; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -99999;
      this.positions[i * 3 + 2] = -1;
      this.linePositions[i * 3] = 0;
      this.linePositions[i * 3 + 1] = -99999;
      this.linePositions[i * 3 + 2] = -1;

      this.colors[i * 4] = color.r;
      this.colors[i * 4 + 1] = color.g;
      this.colors[i * 4 + 2] = color.b;
      this.colors[i * 4 + 3] = 0;
    }

    // Points layer
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    const pointsMat = new THREE.PointsMaterial({
      size: 6,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });
    this.trailPoints = new THREE.Points(pointsGeo, pointsMat);
    this.trailGroup.add(this.trailPoints);

    // Line connecting trail points
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailLine = new THREE.Line(lineGeo, lineMat);
    this.trailGroup.add(this.trailLine);
  }

  get mesh(): THREE.Group {
    return this.trailGroup;
  }

  update(x: number, y: number): void {
    // Write current position at the head
    this.positions[this.head * 3] = x;
    this.positions[this.head * 3 + 1] = y;
    this.positions[this.head * 3 + 2] = -1;

    this.head = (this.head + 1) % this.trailLength;

    // Update alpha and reorder line positions (head → oldest)
    for (let i = 0; i < this.trailLength; i++) {
      const age = (this.trailLength + this.head - i) % this.trailLength;
      const alpha = Math.max(0, 1 - age / this.trailLength);
      this.colors[i * 4 + 3] = alpha * alpha; // quadratic falloff

      // Reorder for line: index 0 = newest, index N-1 = oldest
      const srcIdx = (this.trailLength + this.head - 1 - i) % this.trailLength;
      this.linePositions[i * 3] = this.positions[srcIdx * 3];
      this.linePositions[i * 3 + 1] = this.positions[srcIdx * 3 + 1];
      this.linePositions[i * 3 + 2] = this.positions[srcIdx * 3 + 2];
    }

    const posAttr = this.trailPoints.geometry.getAttribute('position');
    posAttr.needsUpdate = true;
    const colAttr = this.trailPoints.geometry.getAttribute('color');
    colAttr.needsUpdate = true;

    const linePosAttr = this.trailLine.geometry.getAttribute('position');
    linePosAttr.needsUpdate = true;
  }
}
