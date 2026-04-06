import type { ItemType } from '../entities/Item';

// ─── Tunable Constants ─────────────────────────────────
export const BOMB_MAX = 3;
export const BOMB_INITIAL = 1;
export const DOUBLE_SHOT_DURATION = 15.0;
export const OMNI_SHOT_DURATION = 15.0;
export const BARRIER_DURATION = 10.0;

export interface PowerUpState {
  bombCount: number;
  doubleShotTimer: number;
  omniShotTimer: number;
  barrierTimer: number;
}

export class PowerUpSystem {
  private _state: PowerUpState = {
    bombCount: BOMB_INITIAL,
    doubleShotTimer: 0,
    omniShotTimer: 0,
    barrierTimer: 0,
  };

  get state(): Readonly<PowerUpState> { return this._state; }
  get hasDoubleShot(): boolean { return this._state.doubleShotTimer > 0; }
  get hasOmniShot(): boolean { return this._state.omniShotTimer > 0; }
  get hasBarrier(): boolean { return this._state.barrierTimer > 0; }
  get bombCount(): number { return this._state.bombCount; }

  collectItem(type: ItemType): void {
    switch (type) {
      case 'bomb':
        this._state.bombCount = Math.min(BOMB_MAX, this._state.bombCount + 1);
        break;
      case 'double_shot':
        this._state.doubleShotTimer = DOUBLE_SHOT_DURATION;
        break;
      case 'omni_shot':
        this._state.omniShotTimer = OMNI_SHOT_DURATION;
        break;
      case 'barrier':
        this._state.barrierTimer = BARRIER_DURATION;
        break;
    }
  }

  activateBomb(): boolean {
    if (this._state.bombCount <= 0) return false;
    this._state.bombCount--;
    return true;
  }

  update(dt: number): void {
    if (this._state.doubleShotTimer > 0) {
      this._state.doubleShotTimer = Math.max(0, this._state.doubleShotTimer - dt);
    }
    if (this._state.omniShotTimer > 0) {
      this._state.omniShotTimer = Math.max(0, this._state.omniShotTimer - dt);
    }
    if (this._state.barrierTimer > 0) {
      this._state.barrierTimer = Math.max(0, this._state.barrierTimer - dt);
    }
  }

  reset(): void {
    this._state.bombCount = BOMB_INITIAL;
    this._state.doubleShotTimer = 0;
    this._state.omniShotTimer = 0;
    this._state.barrierTimer = 0;
  }
}
