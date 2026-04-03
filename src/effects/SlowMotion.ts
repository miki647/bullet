/**
 * SlowMotion — time-scale effect for dramatic moments.
 *
 * Usage:
 *   slowMotion.trigger(timeScale, duration)  // e.g. trigger(0.3, 0.6)
 *   const scaledDt = slowMotion.apply(dt)    // returns dt * currentScale
 *
 * When triggered, time scale drops to `timeScale` then smoothly ramps
 * back to 1.0 over `duration` seconds (real-time, not game-time).
 */
export class SlowMotion {
  private targetScale = 1;
  private currentScale = 1;
  private duration = 0;
  private elapsed = 0;
  private active = false;

  /** Trigger slow motion. timeScale=0.3 means 30% speed. */
  trigger(timeScale = 0.3, duration = 0.6): void {
    // If already active, only override if this is slower
    if (this.active && timeScale >= this.targetScale) return;

    this.targetScale = timeScale;
    this.currentScale = timeScale;
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
  }

  /**
   * Apply slow motion to dt. Call once per frame.
   * Returns the scaled dt to use for game logic.
   */
  apply(dt: number): number {
    if (!this.active) return dt;

    // Use real dt for ramping back to 1.0
    this.elapsed += dt;
    const progress = Math.min(this.elapsed / this.duration, 1);

    if (progress >= 1) {
      this.active = false;
      this.currentScale = 1;
      return dt;
    }

    // Smooth ramp: start at targetScale, ease back to 1.0
    // Use smoothstep for natural feel
    const t = progress * progress * (3 - 2 * progress); // smoothstep
    this.currentScale = this.targetScale + (1 - this.targetScale) * t;

    return dt * this.currentScale;
  }

  get scale(): number {
    return this.currentScale;
  }

  get isActive(): boolean {
    return this.active;
  }
}
