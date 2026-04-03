import * as THREE from 'three';

export interface NeonShapeOptions {
  outerScale?: number;
  glowScale?: number;
  coreSize?: number;
}

/** Player chevron - arrow/chevron pointing +Y */
export const PLAYER_VERTICES: number[][] = [
  [0, 28],       // nose
  [-12, 8],      // left wing root
  [-8, -4],      // left wing inner
  [-18, -22],    // left wing tip
  [-4, -14],     // left tail inner
  [0, -18],      // tail center
  [4, -14],      // right tail inner
  [18, -22],     // right wing tip
  [8, -4],       // right wing inner
  [12, 8],       // right wing root
];

/** Chaser - diamond shape */
export const CHASER_VERTICES: number[][] = [
  [0, 18],
  [-14, 0],
  [0, -18],
  [14, 0],
];

/** Swarm - small sharp triangle */
export const SWARM_VERTICES: number[][] = [
  [0, 12],
  [-8, -8],
  [8, -8],
];

/** Tank - hexagon */
export const TANK_VERTICES: number[][] = (() => {
  const r = 28;
  const verts: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    verts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return verts;
})();

/**
 * Creates a multi-layer neon wireframe shape.
 * Layers: core dot → inner frame → outer silhouette → glow shell
 */
export function createNeonShape(
  vertices: number[][],
  color: THREE.Color,
  options: NeonShapeOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  const outerScale = options.outerScale ?? 1.15;
  const glowScale = options.glowScale ?? 1.3;
  const coreSize = options.coreSize ?? 4;

  // Compute centroid
  let cx = 0, cy = 0;
  for (const v of vertices) { cx += v[0]; cy += v[1]; }
  cx /= vertices.length;
  cy /= vertices.length;

  // 1. Core dot (brightest, white)
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute('position', new THREE.Float32BufferAttribute([cx, cy, 0], 3));
  const coreMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: coreSize,
    sizeAttenuation: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const core = new THREE.Points(coreGeo, coreMat);
  core.userData.layer = 'core';
  group.add(core);

  // 2. Inner frame (main entity color, full opacity)
  const innerPositions = verticesToFloat32(vertices);
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerPositions, 3));
  const innerMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 1.0,
  });
  const innerFrame = new THREE.LineLoop(innerGeo, innerMat);
  innerFrame.userData.layer = 'inner';
  group.add(innerFrame);

  // 3. Outer silhouette (scaled up, dimmer)
  const outerVerts = scaleVertices(vertices, outerScale, cx, cy);
  const outerPositions = verticesToFloat32(outerVerts);
  const outerGeo = new THREE.BufferGeometry();
  outerGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerPositions, 3));
  const outerMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
  });
  const outerFrame = new THREE.LineLoop(outerGeo, outerMat);
  outerFrame.position.z = -0.01;
  outerFrame.userData.layer = 'outer';
  group.add(outerFrame);

  // 4. Glow shell (scaled up more, very dim, additive)
  const glowVerts = scaleVertices(vertices, glowScale, cx, cy);
  const glowPositions = verticesToFloat32(glowVerts);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  const glowMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
  });
  const glowFrame = new THREE.LineLoop(glowGeo, glowMat);
  glowFrame.position.z = -0.02;
  glowFrame.userData.layer = 'glow';
  group.add(glowFrame);

  return group;
}

/** Apply micro-vibration to the inner frame's vertices */
export function applyMicroVibration(
  group: THREE.Group,
  originalVertices: number[][],
  amplitude: number,
  time: number,
): void {
  group.traverse((child) => {
    if (child.userData.layer === 'inner' && child instanceof THREE.LineLoop) {
      const posAttr = child.geometry.getAttribute('position');
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < originalVertices.length; i++) {
        arr[i * 3] = originalVertices[i][0] + Math.sin(time * 15 + i * 2.1) * amplitude;
        arr[i * 3 + 1] = originalVertices[i][1] + Math.cos(time * 13 + i * 3.7) * amplitude;
      }
      posAttr.needsUpdate = true;
    }
  });
}

/** Create thruster flame triangle behind the player's tail */
export function createThrusterFlame(): THREE.Group {
  const group = new THREE.Group();

  // Wireframe flame
  const flameVerts = [[0, 0], [-6, -14], [6, -14]];
  const flamePositions = verticesToFloat32(flameVerts);
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute('position', new THREE.Float32BufferAttribute(flamePositions, 3));
  const flameMat = new THREE.LineBasicMaterial({
    color: 0xff8800,
    transparent: true,
    opacity: 0.8,
  });
  group.add(new THREE.LineLoop(flameGeo, flameMat));

  // Filled flame (additive glow)
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-6, -14);
  shape.lineTo(6, -14);
  shape.closePath();
  const fillGeo = new THREE.ShapeGeometry(shape);
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(fillGeo, fillMat));

  // Position at the tail
  group.position.set(0, -18, -0.05);

  return group;
}

/**
 * Creates a neon bullet shape — elongated ellipse with core + filled glow.
 * Pointing +Y direction. Bright white-yellow with additive bloom.
 */
export function createBulletShape(): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(0xffffcc);
  const segments = 16;
  const rx = 4;  // half-width
  const ry = 12; // half-height

  // Generate ellipse points
  const ellipsePoints: THREE.Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    ellipsePoints.push(new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * ry));
  }

  // 1. Filled ellipse (additive glow body)
  const shape = new THREE.Shape(ellipsePoints);
  const fillGeo = new THREE.ShapeGeometry(shape);
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xffffcc,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(fillGeo, fillMat));

  // 2. Core dot (brightest white)
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.01], 3));
  const coreMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 5,
    sizeAttenuation: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(coreGeo, coreMat));

  // 3. Inner wireframe ellipse
  const innerVerts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    innerVerts.push(Math.cos(a) * rx, Math.sin(a) * ry, 0.02);
  }
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerVerts, 3));
  const innerMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 1.0,
  });
  group.add(new THREE.LineLoop(innerGeo, innerMat));

  // 4. Outer glow shell (larger, dim, additive)
  const gs = 2.0;
  const glowVerts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    glowVerts.push(Math.cos(a) * rx * gs, Math.sin(a) * ry * gs, -0.01);
  }
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

// ---- Utility functions ----

function verticesToFloat32(vertices: number[][]): Float32Array {
  const arr = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    arr[i * 3] = vertices[i][0];
    arr[i * 3 + 1] = vertices[i][1];
    arr[i * 3 + 2] = 0;
  }
  return arr;
}

function scaleVertices(vertices: number[][], scale: number, cx: number, cy: number): number[][] {
  return vertices.map(([x, y]) => [
    (x - cx) * scale + cx,
    (y - cy) * scale + cy,
  ]);
}
