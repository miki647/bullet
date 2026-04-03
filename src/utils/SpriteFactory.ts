import * as THREE from 'three';
import { AssetLoader, type SpriteKey } from './AssetLoader';

export interface MeshOptions {
  blending?: THREE.Blending;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  depthWrite?: boolean;
}

export class SpriteFactory {
  static createMesh(
    textureKey: SpriteKey,
    width: number,
    height: number,
    options: MeshOptions = {},
  ): THREE.Mesh {
    const texture = AssetLoader.getInstance().get(textureKey);
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      blending: options.blending ?? THREE.NormalBlending,
      color: options.color ?? 0xffffff,
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite ?? false,
    });
    return new THREE.Mesh(geometry, material);
  }

  static createGlowOverlay(
    width: number,
    height: number,
    color: THREE.ColorRepresentation,
    opacity = 0.35,
  ): THREE.Mesh {
    const texture = AssetLoader.getInstance().get('glow');
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      color,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.1;
    return mesh;
  }
}
