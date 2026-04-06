import { ScoreSystem, type ChainEvent } from '../systems/ScoreSystem';
import type { RenderTier } from '../utils/DeviceDetect';
import { SoundManager } from '../systems/SoundManager';
import { type PowerUpState, DOUBLE_SHOT_DURATION, OMNI_SHOT_DURATION, BARRIER_DURATION, BOMB_MAX } from '../systems/PowerUpSystem';

/**
 * HUD — HTML overlay for score, wave, chain multiplier, combo text,
 * WebGPU badge, particle counter, and mute toggle.
 */

const CHAIN_TEXT_MAP: Record<string, string> = {
  nice: 'NICE!',
  awesome: 'AWESOME!',
  incredible: 'INCREDIBLE!',
  unstoppable: 'UNSTOPPABLE!',
};

const CHAIN_COLOR_MAP: Record<string, string> = {
  nice: '#ffff00',
  awesome: '#00ffff',
  incredible: '#ff44ff',
  unstoppable: '#ffffff',
};

export class HUD {
  private container: HTMLElement;
  private hudEl: HTMLElement;
  private scoreEl: HTMLElement;
  private waveEl: HTMLElement;
  private chainEl: HTMLElement;
  private chainBarEl: HTMLElement;
  private chainTextEl: HTMLElement;
  private hpBarEl: HTMLElement;
  private waveAnnounceEl: HTMLElement;
  private badgeEl: HTMLElement;
  private particleCountEl: HTMLElement;
  private muteBtn: HTMLElement;
  private bombsEl: HTMLElement;
  private bombBtnEl: HTMLElement;
  private powerupDoubleShotEl: HTMLElement;
  private powerupOmniShotEl: HTMLElement;
  private powerupBarrierEl: HTMLElement;
  private chainTextTimer = 0;
  private chainSoundsPlayed = new Set<string>();
  private lastWave = 0;
  private _bombTapped = false;

  constructor() {
    this.container = document.getElementById('game-container')!;

    // Inject HUD CSS
    const style = document.createElement('style');
    style.textContent = HUD_CSS;
    document.head.appendChild(style);

    // Create HUD wrapper
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="hud-top-left">
        <div id="hud-score">SCORE: 0</div>
        <div id="hud-wave">WAVE 1</div>
        <div id="hud-hp-bar-bg"><div id="hud-hp-bar"></div></div>
        <div id="hud-powerups">
          <div id="hud-powerup-doubleshot" class="hud-powerup-bar">
            <span class="hud-powerup-label">2x SHOT</span>
            <div class="hud-powerup-fill-bg"><div class="hud-powerup-fill" style="background: #ffff00"></div></div>
          </div>
          <div id="hud-powerup-omnishot" class="hud-powerup-bar">
            <span class="hud-powerup-label">OMNI</span>
            <div class="hud-powerup-fill-bg"><div class="hud-powerup-fill" style="background: #00ffff"></div></div>
          </div>
          <div id="hud-powerup-barrier" class="hud-powerup-bar">
            <span class="hud-powerup-label">BARRIER</span>
            <div class="hud-powerup-fill-bg"><div class="hud-powerup-fill" style="background: #4488ff"></div></div>
          </div>
        </div>
      </div>
      <div id="hud-top-right">
        <div id="hud-chain">×1</div>
        <div id="hud-chain-bar-bg"><div id="hud-chain-bar"></div></div>
      </div>
      <div id="hud-chain-text"></div>
      <div id="hud-wave-announce"></div>
      <div id="hud-bottom-left">
        <div id="hud-badge"></div>
        <div id="hud-particle-count"></div>
      </div>
      <div id="hud-bombs"></div>
      <div id="hud-bomb-btn">💣 BOMB [SPACE]</div>
      <div id="hud-mute-btn">♪</div>
    `;
    this.container.appendChild(hud);

    this.hudEl = hud;
    this.scoreEl = document.getElementById('hud-score')!;
    this.waveEl = document.getElementById('hud-wave')!;
    this.chainEl = document.getElementById('hud-chain')!;
    this.chainBarEl = document.getElementById('hud-chain-bar')!;
    this.chainTextEl = document.getElementById('hud-chain-text')!;
    this.hpBarEl = document.getElementById('hud-hp-bar')!;
    this.waveAnnounceEl = document.getElementById('hud-wave-announce')!;
    this.badgeEl = document.getElementById('hud-badge')!;
    this.particleCountEl = document.getElementById('hud-particle-count')!;
    this.muteBtn = document.getElementById('hud-mute-btn')!;
    this.bombsEl = document.getElementById('hud-bombs')!;
    this.bombBtnEl = document.getElementById('hud-bomb-btn')!;
    this.powerupDoubleShotEl = document.getElementById('hud-powerup-doubleshot')!;
    this.powerupOmniShotEl = document.getElementById('hud-powerup-omnishot')!;
    this.powerupBarrierEl = document.getElementById('hud-powerup-barrier')!;

    // Mute button click handler
    this.muteBtn.addEventListener('click', () => {
      const muted = SoundManager.toggleMute();
      this.muteBtn.textContent = muted ? '♪̶' : '♪';
      this.muteBtn.style.opacity = muted ? '0.4' : '0.7';
    });

    // Bomb button click/touch handler
    this.bombBtnEl.addEventListener('click', () => { this._bombTapped = true; });
    this.bombBtnEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._bombTapped = true;
    });
  }

  /** Set the renderer badge (call once after init) */
  setBadge(tier: RenderTier, maxParticles: number): void {
    const isGPU = tier === 'webgpu';
    const label = isGPU ? 'WebGPU' : 'WebGL2';
    const check = isGPU ? '✓' : '⚠';
    const pLabel = maxParticles >= 1000
      ? `${(maxParticles / 1000).toFixed(0)}K`
      : `${maxParticles}`;
    this.badgeEl.textContent = `${label} ${check} | ${pLabel} particles`;
    this.badgeEl.style.color = isGPU ? '#00ffcc' : '#ffaa44';
    this.badgeEl.style.textShadow = isGPU
      ? '0 0 8px rgba(0,255,204,0.5)'
      : '0 0 8px rgba(255,170,68,0.3)';
  }

  /** Update live particle count */
  updateParticleCount(active: number): void {
    this.particleCountEl.textContent = `Particles: ${active}`;
  }

  show(): void { this.hudEl.style.display = 'block'; }
  hide(): void { this.hudEl.style.display = 'none'; }

  updateHP(hp: number, maxHp: number): void {
    const pct = Math.max(0, hp / maxHp) * 100;
    this.hpBarEl.style.width = `${pct}%`;
    // Color shifts: green → yellow → red
    if (pct > 60) {
      this.hpBarEl.style.background = 'linear-gradient(90deg, #00ff88, #00ffcc)';
    } else if (pct > 30) {
      this.hpBarEl.style.background = 'linear-gradient(90deg, #ffcc00, #ff8800)';
    } else {
      this.hpBarEl.style.background = 'linear-gradient(90deg, #ff4444, #ff0000)';
    }
  }

  update(dt: number, scoreSystem: ScoreSystem): void {
    // Score
    this.scoreEl.textContent = `SCORE: ${scoreSystem.score.toLocaleString()}`;

    // Wave — reset chain sounds on new wave
    const wave = scoreSystem.wave;
    if (wave !== this.lastWave) {
      this.lastWave = wave;
      this.chainSoundsPlayed.clear();
    }
    this.waveEl.textContent = `WAVE ${wave}`;

    // Chain multiplier
    const chain = scoreSystem.chainMultiplier;
    this.chainEl.textContent = `×${chain}`;
    if (chain >= 10) {
      this.chainEl.style.color = '#ffffff';
      this.chainEl.style.textShadow = '0 0 20px #ffffff, 0 0 40px #ff44ff';
    } else if (chain >= 8) {
      this.chainEl.style.color = '#ff44ff';
      this.chainEl.style.textShadow = '0 0 15px #ff44ff';
    } else if (chain >= 5) {
      this.chainEl.style.color = '#00ffff';
      this.chainEl.style.textShadow = '0 0 10px #00ffff';
    } else if (chain >= 3) {
      this.chainEl.style.color = '#ffff00';
      this.chainEl.style.textShadow = '0 0 8px #ffff00';
    } else {
      this.chainEl.style.color = '#aaaaaa';
      this.chainEl.style.textShadow = 'none';
    }

    // Chain bar
    const progress = scoreSystem.chainProgress;
    this.chainBarEl.style.width = `${progress * 100}%`;
    this.chainBarEl.style.opacity = chain > 1 ? '1' : '0.3';

    // Chain text popup
    const event = scoreSystem.consumeChainEvent();
    if (event) {
      this.showChainText(event);
    }
    if (this.chainTextTimer > 0) {
      this.chainTextTimer -= dt;
      if (this.chainTextTimer <= 0) {
        this.chainTextEl.style.opacity = '0';
        this.chainTextEl.style.transform = 'translate(-50%, -50%) scale(1.5)';
      }
    }
  }

  private showChainText(event: ChainEvent): void {
    const text = CHAIN_TEXT_MAP[event.threshold] ?? '';
    const color = CHAIN_COLOR_MAP[event.threshold] ?? '#ffffff';
    if (!this.chainSoundsPlayed.has(event.threshold)) {
      this.chainSoundsPlayed.add(event.threshold);
      SoundManager.chainMilestone(event.threshold as 'nice' | 'awesome' | 'incredible' | 'unstoppable');
    }

    this.chainTextEl.textContent = text;
    this.chainTextEl.style.color = color;
    this.chainTextEl.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
    this.chainTextEl.style.opacity = '1';
    this.chainTextEl.style.transform = 'translate(-50%, -50%) scale(1)';
    this.chainTextTimer = 1.2; // show for 1.2 seconds
  }

  /** Update bomb count display */
  updateBombs(count: number): void {
    let html = '';
    for (let i = 0; i < BOMB_MAX; i++) {
      const filled = i < count;
      html += `<div class="hud-bomb-icon ${filled ? 'filled' : 'empty'}"></div>`;
    }
    this.bombsEl.innerHTML = html;
  }

  /** Update active powerup timer bars */
  updatePowerUps(state: Readonly<PowerUpState>): void {
    this.updatePowerUpBar(this.powerupDoubleShotEl, state.doubleShotTimer, DOUBLE_SHOT_DURATION);
    this.updatePowerUpBar(this.powerupOmniShotEl, state.omniShotTimer, OMNI_SHOT_DURATION);
    this.updatePowerUpBar(this.powerupBarrierEl, state.barrierTimer, BARRIER_DURATION);
  }

  private updatePowerUpBar(el: HTMLElement, timer: number, maxDuration: number): void {
    if (timer <= 0) {
      el.style.display = 'none';
    } else {
      el.style.display = 'flex';
      const fill = el.querySelector('.hud-powerup-fill') as HTMLElement;
      if (fill) fill.style.width = `${(timer / maxDuration) * 100}%`;
    }
  }

  /** Consume bomb button tap (one-shot) */
  consumeBombTap(): boolean {
    if (this._bombTapped) {
      this._bombTapped = false;
      return true;
    }
    return false;
  }

  showWaveAnnounce(wave: number): void {
    this.waveAnnounceEl.textContent = `WAVE ${wave}`;
    this.waveAnnounceEl.classList.add('visible');
  }

  hideWaveAnnounce(): void {
    this.waveAnnounceEl.classList.remove('visible');
  }
}

const HUD_CSS = `
#hud {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  font-family: 'Segoe UI', 'Consolas', monospace;
  z-index: 10;
}

#hud-top-left {
  position: absolute;
  top: 20px;
  left: 24px;
}

#hud-score {
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  letter-spacing: 2px;
}

#hud-wave {
  font-size: 18px;
  color: #88aacc;
  margin-top: 4px;
  letter-spacing: 1px;
}

#hud-hp-bar-bg {
  width: 160px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

#hud-hp-bar {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #00ff88, #00ffcc);
  border-radius: 3px;
  transition: width 0.3s ease, background 0.3s ease;
}

#hud-top-right {
  position: absolute;
  top: 20px;
  right: 24px;
  text-align: right;
}

#hud-chain {
  font-size: 36px;
  font-weight: bold;
  color: #aaaaaa;
  letter-spacing: 2px;
  transition: color 0.15s, text-shadow 0.15s;
}

#hud-chain-bar-bg {
  width: 120px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 6px;
  margin-left: auto;
}

#hud-chain-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #00ffff, #ffff00);
  border-radius: 2px;
  transition: width 0.1s linear;
  opacity: 0.3;
}

#hud-chain-text {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  font-size: 64px;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 6px;
  opacity: 0;
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
  text-transform: uppercase;
}

#hud-wave-announce {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1.5);
  font-size: 72px;
  font-weight: 900;
  color: #00ffff;
  letter-spacing: 8px;
  opacity: 0;
  text-shadow: 0 0 30px #00ffff, 0 0 60px #00ffff, 0 0 120px #0088ff;
  text-transform: uppercase;
  pointer-events: none;
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}

#hud-wave-announce.visible {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

#hud-bottom-left {
  position: absolute;
  bottom: 16px;
  left: 24px;
}

#hud-badge {
  font-size: 13px;
  font-weight: bold;
  color: #00ffcc;
  letter-spacing: 1px;
  opacity: 0.85;
}

#hud-particle-count {
  font-size: 11px;
  color: #6688aa;
  margin-top: 2px;
  letter-spacing: 0.5px;
}

#hud-mute-btn {
  position: absolute;
  bottom: 16px;
  right: 24px;
  font-size: 22px;
  color: #ffffff;
  opacity: 0.7;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  transition: opacity 0.2s;
}

#hud-mute-btn:hover {
  opacity: 1;
}

#hud-powerups {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hud-powerup-bar {
  display: none;
  align-items: center;
  gap: 6px;
  height: 14px;
}

.hud-powerup-label {
  font-size: 10px;
  color: #aaccdd;
  width: 56px;
  text-align: right;
  letter-spacing: 0.5px;
}

.hud-powerup-fill-bg {
  flex: 1;
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.hud-powerup-fill {
  height: 100%;
  width: 100%;
  border-radius: 2px;
  transition: width 0.1s linear;
}

#hud-bombs {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.hud-bomb-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #ff6644;
  transition: background 0.2s;
}

.hud-bomb-icon.filled {
  background: radial-gradient(circle, #ff8844 30%, #ff6644 100%);
  box-shadow: 0 0 8px rgba(255, 102, 68, 0.5);
}

.hud-bomb-icon.empty {
  background: transparent;
  opacity: 0.3;
}

#hud-bomb-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: #ff8844;
  opacity: 0.6;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  letter-spacing: 1px;
  text-shadow: 0 0 6px rgba(255, 136, 68, 0.3);
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}

#hud-bomb-btn:hover {
  opacity: 1;
}
`;
