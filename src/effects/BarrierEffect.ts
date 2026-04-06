import * as THREE from 'three';

const BARRIER_RADIUS = 40;
const CIRCLE_SEGMENTS = 32;

function createCircleGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(angle) * radius;
    pts[i * 3 + 1] = Math.sin(angle) * radius;
    pts[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

export class BarrierEffect {
  readonly group = new THREE.Group();
  private _active = false;
  private elapsed = 0;

  constructor() {
    // Inner ring (solid bright)
    const innerGeo = createCircleGeometry(BARRIER_RADIUS, CIRCLE_SEGMENTS);
    const innerMat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.group.add(new THREE.LineLoop(innerGeo, innerMat));

    // Outer glow ring
    const outerGeo = createCircleGeometry(BARRIER_RADIUS * 1.2, CIRCLE_SEGMENTS);
    const outerMat = new THREE.LineBasicMaterial({
      color: 0x2266cc,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.group.add(new THREE.LineLoop(outerGeo, outerMat));

    // Inner shimmer ring
    const shimmerGeo = createCircleGeometry(BARRIER_RADIUS * 0.85, CIRCLE_SEGMENTS);
    const shimmerMat = new THREE.LineBasicMaterial({
      color: 0x88bbff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.group.add(new THREE.LineLoop(shimmerGeo, shimmerMat));

    this.group.position.z = 1;
    this.group.visible = false;
  }

  get active(): boolean { return this._active; }

  activate(): void {
    this._active = true;
    this.group.visible = true;
    this.elapsed = 0;
  }

  deactivate(): void {
    this._active = false;
    this.group.visible = false;
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this._active) return;
    this.elapsed += dt;

    this.group.position.x = playerX;
    this.group.position.y = playerY;

    // Gentle pulsing scale
    const pulse = 1.0 + Math.sin(this.elapsed * 6) * 0.05;
    this.group.scale.set(pulse, pulse, 1);

    // Slow rotation
    this.group.rotation.z += dt * 1.5;

    // Shimmer: third ring opacity oscillation
    const shimmer = this.group.children[2] as THREE.LineLoop;
    if (shimmer) {
      (shimmer.material as THREE.LineBasicMaterial).opacity = 0.15 + Math.sin(this.elapsed * 8) * 0.15;
    }
  }
}
