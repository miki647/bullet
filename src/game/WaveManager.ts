import { Bounds } from '../utils/Bounds';
import { EnemyManager } from '../entities/Enemy';

/**
 * Wave definitions — now includes all 3 enemy types.
 * Swarm appears from Wave 3, Tank from Wave 5.
 */
interface WaveDefinition {
  chaserCount: number;
  swarmCount: number;
  tankCount: number;
}

const WAVE_DEFS: WaveDefinition[] = [
  { chaserCount: 5,  swarmCount: 0,  tankCount: 0 },  // Wave 1
  { chaserCount: 8,  swarmCount: 0,  tankCount: 0 },  // Wave 2
  { chaserCount: 6,  swarmCount: 8,  tankCount: 0 },  // Wave 3 — Swarm intro
  { chaserCount: 8,  swarmCount: 12, tankCount: 0 },  // Wave 4
  { chaserCount: 5,  swarmCount: 10, tankCount: 1 },  // Wave 5 — Tank intro
];

const WAVE_REST_TIME = 3; // seconds between waves
const SPAWN_MARGIN = 60;  // units outside visible edge

const SUCTION_DURATION = 0.5;
const TEXT_DURATION = 1.5;

type SpawnEntry = { type: 'chaser' | 'swarm' | 'tank' };
export type TransitionPhase = 'none' | 'suction' | 'burst' | 'text' | 'rest';

export class WaveManager {
  private waveNumber = 0;
  private restTimer = 0;
  private inRest = true;

  // Spawn queue: shuffled list of enemies to spawn this wave
  private spawnQueue: SpawnEntry[] = [];
  private spawnTimer = 0;
  private spawnInterval = 0;

  // --- Wave transition state machine ---
  private _transitionPhase: TransitionPhase = 'none';
  private transitionTimer = 0;
  /** True on the exact frame a phase just started (consumed by Game.ts). */
  private _phaseJustStarted = false;

  private enemyManager: EnemyManager;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.restTimer = 1.5; // short initial delay
  }

  private playerX = 0;
  private playerY = 0;

  update(dt: number, enemyCount: number, playerX = 0, playerY = 0): void {
    this.playerX = playerX;
    this.playerY = playerY;
    // --- Transition state machine ---
    if (this._transitionPhase !== 'none') {
      this._phaseJustStarted = false;
      this.transitionTimer -= dt;

      if (this.transitionTimer <= 0) {
        switch (this._transitionPhase) {
          case 'suction':
            this.setPhase('burst');
            break;
          case 'burst':
            // burst is instant — transition immediately to text
            this.setPhase('text', TEXT_DURATION);
            break;
          case 'text':
            this.setPhase('rest', WAVE_REST_TIME - SUCTION_DURATION - TEXT_DURATION);
            break;
          case 'rest':
            this._transitionPhase = 'none';
            this.startNextWave();
            break;
        }
      }
      return;
    }

    if (this.inRest) {
      this.restTimer -= dt;
      if (this.restTimer <= 0) {
        this.startNextWave();
      }
      return;
    }

    // Spawn enemies at intervals
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnNext();
        this.spawnTimer = this.spawnInterval;
      }
    }

    // Wave complete: all spawned and all dead → begin transition
    if (this.spawnQueue.length === 0 && enemyCount === 0) {
      this.beginWaveTransition();
    }
  }

  private beginWaveTransition(): void {
    this.inRest = false;
    this.setPhase('suction', SUCTION_DURATION);
  }

  private setPhase(phase: TransitionPhase, duration = 0): void {
    this._transitionPhase = phase;
    this.transitionTimer = duration;
    this._phaseJustStarted = true;
  }

  private startNextWave(): void {
    this.waveNumber++;
    this.inRest = false;

    const def = this.getWaveDefinition(this.waveNumber);

    // Build spawn queue
    this.spawnQueue = [];
    for (let i = 0; i < def.chaserCount; i++) this.spawnQueue.push({ type: 'chaser' });
    for (let i = 0; i < def.swarmCount; i++) this.spawnQueue.push({ type: 'swarm' });
    for (let i = 0; i < def.tankCount; i++) this.spawnQueue.push({ type: 'tank' });

    // Shuffle (Fisher-Yates)
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }

    // Stagger spawns over ~2 seconds
    const totalEnemies = this.spawnQueue.length;
    this.spawnInterval = Math.max(0.1, 2.0 / Math.max(1, totalEnemies));
    this.spawnTimer = 0; // first spawns immediately
  }

  private getWaveDefinition(wave: number): WaveDefinition {
    if (wave <= WAVE_DEFS.length) {
      return WAVE_DEFS[wave - 1];
    }
    // Smoothly scaling formula for wave 6+
    return {
      chaserCount: 5 + wave,
      swarmCount: Math.max(0, (wave - 2) * 2),
      tankCount: Math.max(0, Math.floor((wave - 3) / 2)),
    };
  }

  private spawnNext(): void {
    const entry = this.spawnQueue.pop();
    if (!entry) return;

    const pos = this.randomEdgePosition();
    switch (entry.type) {
      case 'chaser':
        this.enemyManager.spawnChaser(pos.x, pos.y);
        break;
      case 'swarm':
        this.enemyManager.spawnSwarm(pos.x, pos.y, this.playerX, this.playerY);
        break;
      case 'tank':
        this.enemyManager.spawnTank(pos.x, pos.y);
        break;
    }
  }

  private randomEdgePosition(): { x: number; y: number } {
    const halfW = Bounds.halfW + SPAWN_MARGIN;
    const halfH = Bounds.halfH + SPAWN_MARGIN;

    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        return { x: (Math.random() - 0.5) * Bounds.halfW * 2, y: halfH };
      case 1:
        return { x: (Math.random() - 0.5) * Bounds.halfW * 2, y: -halfH };
      case 2:
        return { x: -halfW, y: (Math.random() - 0.5) * Bounds.halfH * 2 };
      default:
        return { x: halfW, y: (Math.random() - 0.5) * Bounds.halfH * 2 };
    }
  }

  get currentWave(): number {
    return this.waveNumber;
  }

  get isResting(): boolean {
    return this.inRest;
  }

  get restCountdown(): number {
    return Math.max(0, this.restTimer);
  }

  get transitionPhase(): TransitionPhase {
    return this._transitionPhase;
  }

  get phaseJustStarted(): boolean {
    const v = this._phaseJustStarted;
    this._phaseJustStarted = false;
    return v;
  }

  reset(): void {
    this.waveNumber = 0;
    this.restTimer = 1.5;
    this.inRest = true;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0;
    this._transitionPhase = 'none';
    this.transitionTimer = 0;
    this._phaseJustStarted = false;
  }
}
