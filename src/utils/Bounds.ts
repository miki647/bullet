/**
 * Bounds — Dynamic play area boundaries based on camera view.
 * Singleton accessed by all game systems to keep entities within view.
 */

const MIN_WIDTH = 360;
const MIN_HEIGHT = 480;

class BoundsImpl {
  /** Half-width of the play area in world units */
  halfW = 540;
  /** Half-height of the play area in world units */
  halfH = 540;

  /** Update from camera dimensions (call on resize) */
  update(cameraHalfW: number, cameraHalfH: number): void {
    this.halfW = Math.max(MIN_WIDTH / 2, cameraHalfW);
    this.halfH = Math.max(MIN_HEIGHT / 2, cameraHalfH);
  }
}

export const Bounds = new BoundsImpl();
