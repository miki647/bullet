import * as THREE from 'three';

interface FlashEntry {
  object: THREE.Object3D;
  originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]>;
  timer: number;
}

const whiteMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
});

const whiteLineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 1.0,
});

const whitePointMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 6,
  sizeAttenuation: false,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const activeFlashes: FlashEntry[] = [];

export class HitFlash {
  static apply(object: THREE.Object3D, duration = 0.05): void {
    // Don't double-flash
    if (activeFlashes.some((f) => f.object === object)) return;

    const originalMaterials = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>();

    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineLoop ||
          child instanceof THREE.Line || child instanceof THREE.Points) {
        const c = child as THREE.Mesh | THREE.Line | THREE.Points;
        originalMaterials.set(child, c.material);
        if (child instanceof THREE.Points) {
          c.material = whitePointMaterial;
        } else if (child instanceof THREE.Line || child instanceof THREE.LineLoop) {
          c.material = whiteLineMaterial;
        } else {
          c.material = whiteMaterial;
        }
      }
    });

    activeFlashes.push({ object, originalMaterials, timer: duration });
  }

  static update(dt: number): void {
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
      const entry = activeFlashes[i];
      entry.timer -= dt;
      if (entry.timer <= 0) {
        // Restore all original materials
        for (const [child, mat] of entry.originalMaterials) {
          (child as THREE.Mesh | THREE.Line | THREE.Points).material = mat as THREE.Material;
        }
        activeFlashes.splice(i, 1);
      }
    }
  }
}
