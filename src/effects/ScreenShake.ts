import * as THREE from 'three';

/**
 * ScreenShake — camera-offset based screen shake.
 *
 * Usage:
 *   screenShake.trigger(intensity, duration)
 *   screenShake.update(dt)   // every frame, before render
 *
 * The shake offsets the camera position by random amounts that decay over time.
 * Supports stacking: new triggers while shaking pick the larger intensity.
 */
export class ScreenShake {
  private camera: THREE.Camera;
  private basePosition = new THREE.Vector3();
  private intensity = 0;
  private maxIntensity = 0;
  private duration = 0;
  private elapsed = 0;
  private active = false;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.basePosition.copy(camera.position);
  }

  /** Trigger a shake. Stacks by taking the max of current vs new intensity. */
  trigger(intensity: number, duration = 0.3): void {
    if (intensity > this.intensity) {
      this.maxIntensity = intensity;
      this.intensity = intensity;
    }
    // Always refresh duration
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
  }

  /** Call every frame. Offsets camera from base position. */
  update(dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    const progress = Math.min(this.elapsed / this.duration, 1);

    if (progress >= 1) {
      // Shake finished — restore camera
      this.camera.position.x = this.basePosition.x;
      this.camera.position.y = this.basePosition.y;
      this.active = false;
      this.intensity = 0;
      return;
    }

    // Exponential decay
    const decay = 1 - progress;
    const currentIntensity = this.maxIntensity * decay * decay;

    // Random offset
    const offsetX = (Math.random() * 2 - 1) * currentIntensity;
    const offsetY = (Math.random() * 2 - 1) * currentIntensity;

    this.camera.position.x = this.basePosition.x + offsetX;
    this.camera.position.y = this.basePosition.y + offsetY;
  }

  /** Update the stored base position (call if camera moves for other reasons). */
  setBasePosition(x: number, y: number, z: number): void {
    this.basePosition.set(x, y, z);
  }
}
