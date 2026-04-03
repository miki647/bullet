import * as THREE from 'three';
import { generatePlayerSprite } from './sprites/PlayerSprite';
import { generateChaserSprite } from './sprites/ChaserSprite';
import { generateSwarmSprite } from './sprites/SwarmSprite';
import { generateTankSprite } from './sprites/TankSprite';
import { generateBulletSprite } from './sprites/BulletSprite';
import { generateGlowTexture } from './sprites/GlowSprite';

export type SpriteKey =
  | 'player'
  | 'enemy-chaser'
  | 'enemy-swarm'
  | 'enemy-tank'
  | 'bullet-player'
  | 'glow';

const GENERATORS: Record<SpriteKey, () => HTMLCanvasElement> = {
  'player': generatePlayerSprite,
  'enemy-chaser': generateChaserSprite,
  'enemy-swarm': generateSwarmSprite,
  'enemy-tank': generateTankSprite,
  'bullet-player': generateBulletSprite,
  'glow': generateGlowTexture,
};

export class AssetLoader {
  private static instance: AssetLoader;
  private cache = new Map<SpriteKey, THREE.Texture>();

  static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  async preloadAll(): Promise<void> {
    for (const [key, generator] of Object.entries(GENERATORS)) {
      const canvas = generator();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      this.cache.set(key as SpriteKey, texture);
    }
    console.log(`[AssetLoader] Generated ${this.cache.size} procedural sprites`);
  }

  get(key: SpriteKey): THREE.Texture {
    const tex = this.cache.get(key);
    if (!tex) throw new Error(`Texture "${key}" not loaded`);
    return tex;
  }

  has(key: SpriteKey): boolean {
    return this.cache.has(key);
  }
}
