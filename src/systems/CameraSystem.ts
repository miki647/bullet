import * as THREE from 'three';
import { Game } from '../game/Game';

/**
 * CameraSystem — look-ahead offset + dynamic zoom based on enemy count.
 *
 * Look-ahead: camera offset 15% of player velocity direction (max 30u)
 * Dynamic zoom: zooms out 5-10% when many enemies on screen
 */
export class CameraSystem {
  private camera: THREE.OrthographicCamera;
  private offsetX = 0;
  private offsetY = 0;
  private currentZoom = 1;
  private baseHalfH: number;

  private static readonly LOOK_AHEAD_FACTOR = 0.15;
  private static readonly MAX_OFFSET = 30;
  private static readonly LERP_SPEED = 3; // per second

  constructor(camera: THREE.OrthographicCamera) {
    this.camera = camera;
    this.baseHalfH = Game.WORLD_HEIGHT / 2;
  }

  /**
   * Call each frame before ScreenShake.update().
   * Returns the base camera position for ScreenShake to use.
   */
  update(
    dt: number,
    playerVelX: number,
    playerVelY: number,
    enemyCount: number,
  ): { x: number; y: number; z: number } {
    // Look-ahead: target offset = 15% of velocity, clamped
    const targetX = Math.max(-CameraSystem.MAX_OFFSET,
      Math.min(CameraSystem.MAX_OFFSET, playerVelX * CameraSystem.LOOK_AHEAD_FACTOR));
    const targetY = Math.max(-CameraSystem.MAX_OFFSET,
      Math.min(CameraSystem.MAX_OFFSET, playerVelY * CameraSystem.LOOK_AHEAD_FACTOR));

    const lerpT = 1 - Math.exp(-CameraSystem.LERP_SPEED * dt);
    this.offsetX += (targetX - this.offsetX) * lerpT;
    this.offsetY += (targetY - this.offsetY) * lerpT;

    // Dynamic zoom: more enemies → slightly zoom out
    let targetZoom = 1.0;
    if (enemyCount >= 20) {
      targetZoom = 0.92;
    } else if (enemyCount >= 15) {
      targetZoom = 0.95;
    }
    this.currentZoom += (targetZoom - this.currentZoom) * lerpT * 0.3;

    // Apply zoom by scaling frustum
    const aspect = window.innerWidth / window.innerHeight;
    const halfH = this.baseHalfH / this.currentZoom;
    const halfW = halfH * aspect;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    // Set camera position (look-ahead offset)
    this.camera.position.x = this.offsetX;
    this.camera.position.y = this.offsetY;

    return { x: this.offsetX, y: this.offsetY, z: 100 };
  }
}
