/**
 * ScoreSystem — score tracking, chain kill multiplier, combo text thresholds.
 *
 * Chain Kill:
 *   - Kill resets chainTimer to CHAIN_WINDOW (2s)
 *   - Before timer expires, next kill increments chainMultiplier
 *   - Timer expiry resets multiplier to 1
 *   - Particle emit count scales by min(chainMultiplier, 8)
 *
 * Score per kill = baseScore × chainMultiplier
 *
 * Thresholds trigger combo text:
 *   ×3  "NICE!"
 *   ×5  "AWESOME!"
 *   ×8  "INCREDIBLE!"
 *   ×10 "UNSTOPPABLE!"
 */

// Base score per enemy type
const BASE_SCORE: Record<string, number> = {
  chaser: 100,
  swarm: 150,
  tank: 500,
};

const CHAIN_WINDOW = 2.0; // seconds to maintain chain

export type ChainThreshold = 'nice' | 'awesome' | 'incredible' | 'unstoppable';

export interface ChainEvent {
  threshold: ChainThreshold;
  multiplier: number;
}

export class ScoreSystem {
  private _score = 0;
  private _chainMultiplier = 1;
  private _maxChain = 1;
  private chainTimer = 0;
  private _wave = 0;

  // Fires once when a threshold is crossed
  private pendingChainEvent: ChainEvent | null = null;

  /** Register an enemy kill. Returns the score earned for this kill. */
  registerKill(enemyType: string): number {
    // Increment chain
    if (this.chainTimer > 0) {
      this._chainMultiplier++;
    } else {
      this._chainMultiplier = 1;
    }

    // Reset chain timer
    this.chainTimer = CHAIN_WINDOW;

    // Track max chain
    if (this._chainMultiplier > this._maxChain) {
      this._maxChain = this._chainMultiplier;
    }

    // Check threshold crossing
    this.checkThreshold();

    // Calculate score
    const base = BASE_SCORE[enemyType] ?? 100;
    const earned = base * this._chainMultiplier;
    this._score += earned;

    return earned;
  }

  /** Call every frame to tick down chain timer. */
  update(dt: number): void {
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chainTimer = 0;
        this._chainMultiplier = 1;
      }
    }
  }

  private checkThreshold(): void {
    const m = this._chainMultiplier;
    if (m >= 10) {
      this.pendingChainEvent = { threshold: 'unstoppable', multiplier: m };
    } else if (m === 8) {
      this.pendingChainEvent = { threshold: 'incredible', multiplier: m };
    } else if (m === 5) {
      this.pendingChainEvent = { threshold: 'awesome', multiplier: m };
    } else if (m === 3) {
      this.pendingChainEvent = { threshold: 'nice', multiplier: m };
    }
  }

  /** Consume the pending chain event (if any). Returns null if none. */
  consumeChainEvent(): ChainEvent | null {
    const e = this.pendingChainEvent;
    this.pendingChainEvent = null;
    return e;
  }

  /** Set from WaveManager so HUD can read it. */
  set wave(n: number) { this._wave = n; }
  get wave(): number { return this._wave; }

  get score(): number { return this._score; }
  get chainMultiplier(): number { return this._chainMultiplier; }
  get maxChain(): number { return this._maxChain; }

  /** Normalized chain timer (0–1) for UI display (e.g. combo bar). */
  get chainProgress(): number {
    return this.chainTimer / CHAIN_WINDOW;
  }

  reset(): void {
    this._score = 0;
    this._chainMultiplier = 1;
    this._maxChain = 1;
    this.chainTimer = 0;
    this._wave = 0;
    this.pendingChainEvent = null;
  }
}
