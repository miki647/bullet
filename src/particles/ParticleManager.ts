import * as THREE from 'three';
import { CPUParticleSystem, type EmitOptions } from './CPUParticleSystem';

/**
 * ParticleManager — facade over the particle system with:
 * - Enemy-type-aware emit presets
 * - Chain-kill scaling
 * - Adaptive performance: monitors frame budget and auto-scales particle count
 */

// Color presets per enemy type
const ENEMY_COLORS: Record<string, THREE.Color> = {
  chaser: new THREE.Color(1.0, 0.4, 0.15),   // orange-red
  swarm:  new THREE.Color(0.2, 1.0, 0.55),    // green-cyan
  tank:   new THREE.Color(0.7, 0.3, 1.0),     // purple-magenta
};

// Base particle count per enemy kill
const BASE_PARTICLES: Record<string, number> = {
  chaser: 150,
  swarm:  120,
  tank:   400,
};

// Frame budget thresholds (ms)
const BUDGET_TARGET_MS = 16;    // target ~60fps
const BUDGET_CRITICAL_MS = 28;  // start scaling down aggressively (~35fps)

export class ParticleManager {
  private system: CPUParticleSystem;
  private readonly maxParticles: number;

  // Adaptive performance scaling (1.0 = full, 0.25 = minimum)
  private _emitScale = 1.0;
  private frameTimes: number[] = [];
  private readonly FRAME_SAMPLE_COUNT = 30;

  constructor(maxParticles: number) {
    this.maxParticles = maxParticles;
    this.system = new CPUParticleSystem(maxParticles);
  }

  /** The Three.js object to add to the scene. */
  get mesh(): THREE.Points {
    return this.system.points;
  }

  /**
   * Emit an explosion for an enemy kill.
   * @param x World X
   * @param y World Y
   * @param enemyType 'chaser' | 'swarm' | 'tank'
   * @param chainMultiplier Chain kill multiplier (1–8+), scales particle count
   */
  emitExplosion(
    x: number,
    y: number,
    enemyType: string,
    chainMultiplier: number = 1,
  ): void {
    const baseCount = BASE_PARTICLES[enemyType] ?? 150;
    const rawCount = baseCount * Math.min(chainMultiplier, 8);
    const count = Math.min(Math.round(rawCount * this._emitScale), 2000);
    const color = ENEMY_COLORS[enemyType] ?? ENEMY_COLORS.chaser;

    const opts: EmitOptions = {
      color,
      baseSpeed: enemyType === 'tank' ? 400 : 300,
      speedVariance: 0.6,
      minLife: 0.4,
      maxLife: enemyType === 'tank' ? 2.0 : 1.5,
      baseSize: enemyType === 'tank' ? 8 : 6,
    };

    this.system.emit(x, y, count, opts);
  }

  /**
   * Generic emit (for non-enemy effects like player hit, etc.)
   */
  emit(x: number, y: number, count: number, opts?: EmitOptions): void {
    const scaledCount = Math.max(10, Math.round(count * this._emitScale));
    this.system.emit(x, y, scaledCount, opts);
  }

  /**
   * Update particle physics + adaptive performance monitor.
   * @param dt Delta time in seconds
   * @param frameDurationMs Optional: actual frame duration for budget monitoring
   */
  update(dt: number, frameDurationMs?: number): void {
    // Adaptive performance monitoring
    if (frameDurationMs !== undefined) {
      this.frameTimes.push(frameDurationMs);
      if (this.frameTimes.length > this.FRAME_SAMPLE_COUNT) {
        this.frameTimes.shift();
      }
      this.updateEmitScale();
    }

    this.system.update(dt);
  }

  /**
   * Adjust emitScale based on recent frame times.
   * Smoothly scales down when frames take too long, scales back up when fast.
   */
  private updateEmitScale(): void {
    if (this.frameTimes.length < 10) return;

    // Use 90th percentile (worst-case-ish)
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];

    if (p90 > BUDGET_CRITICAL_MS) {
      // Over budget: scale down fast
      this._emitScale = Math.max(0.25, this._emitScale - 0.03);
    } else if (p90 > BUDGET_TARGET_MS) {
      // Near budget: scale down gently
      this._emitScale = Math.max(0.25, this._emitScale - 0.005);
    } else if (p90 < BUDGET_TARGET_MS * 0.8) {
      // Under budget: scale back up
      this._emitScale = Math.min(1.0, this._emitScale + 0.01);
    }
  }

  get activeCount(): number {
    return this.system.activeCount;
  }

  get emitScale(): number {
    return this._emitScale;
  }

  get maxCapacity(): number {
    return this.maxParticles;
  }
}
