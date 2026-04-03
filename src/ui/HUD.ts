import { ScoreSystem, type ChainEvent } from '../systems/ScoreSystem';

/**
 * HUD — HTML overlay for score, wave, chain multiplier, and combo text.
 * All elements are created programmatically and appended to #game-container.
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
  private chainTextTimer = 0;

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
      </div>
      <div id="hud-top-right">
        <div id="hud-chain">×1</div>
        <div id="hud-chain-bar-bg"><div id="hud-chain-bar"></div></div>
      </div>
      <div id="hud-chain-text"></div>
    `;
    this.container.appendChild(hud);

    this.hudEl = hud;
    this.scoreEl = document.getElementById('hud-score')!;
    this.waveEl = document.getElementById('hud-wave')!;
    this.chainEl = document.getElementById('hud-chain')!;
    this.chainBarEl = document.getElementById('hud-chain-bar')!;
    this.chainTextEl = document.getElementById('hud-chain-text')!;
    this.hpBarEl = document.getElementById('hud-hp-bar')!;
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

    // Wave
    this.waveEl.textContent = `WAVE ${scoreSystem.wave}`;

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

    this.chainTextEl.textContent = text;
    this.chainTextEl.style.color = color;
    this.chainTextEl.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
    this.chainTextEl.style.opacity = '1';
    this.chainTextEl.style.transform = 'translate(-50%, -50%) scale(1)';
    this.chainTextTimer = 1.2; // show for 1.2 seconds
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
`;
