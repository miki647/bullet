/**
 * GameOverScreen — displays final score + stats with a restart prompt.
 */
export class GameOverScreen {
  private overlay: HTMLDivElement;
  private scoreEl: HTMLElement;
  private waveEl: HTMLElement;
  private chainEl: HTMLElement;
  private onRestart: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'gameover-screen';
    this.overlay.innerHTML = `
      <div class="go-title">GAME OVER</div>
      <div class="go-stats">
        <div class="go-score">0</div>
        <div class="go-details">
          <span class="go-wave">WAVE 1</span>
          <span class="go-chain">BEST CHAIN ×1</span>
        </div>
      </div>
      <div class="go-prompt">CLICK OR TAP TO RESTART</div>
    `;
    container.appendChild(this.overlay);

    const style = document.createElement('style');
    style.textContent = GAMEOVER_CSS;
    document.head.appendChild(style);

    this.scoreEl = this.overlay.querySelector('.go-score')!;
    this.waveEl = this.overlay.querySelector('.go-wave')!;
    this.chainEl = this.overlay.querySelector('.go-chain')!;

    this.overlay.addEventListener('click', this.handleRestart);
    this.overlay.addEventListener('touchend', this.handleRestart);
  }

  private handleRestart = (e: Event): void => {
    e.preventDefault();
    this.onRestart?.();
  };

  show(score: number, wave: number, maxChain: number, onRestart: () => void): void {
    this.onRestart = onRestart;
    this.scoreEl.textContent = score.toLocaleString();
    this.waveEl.textContent = `WAVE ${wave}`;
    this.chainEl.textContent = `BEST CHAIN ×${maxChain}`;
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
    });
  }

  hide(): void {
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 400);
  }
}

const GAMEOVER_CSS = `
#gameover-screen {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  background: radial-gradient(ellipse at center, rgba(20,5,5,0.88) 0%, rgba(6,10,18,0.97) 100%);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.5s ease;
  font-family: 'Segoe UI', 'Consolas', monospace;
  user-select: none;
  -webkit-user-select: none;
}

.go-title {
  font-size: 64px;
  font-weight: 900;
  color: #ff2244;
  text-shadow: 0 0 30px rgba(255,34,68,0.6), 0 0 60px rgba(255,34,68,0.3);
  letter-spacing: 8px;
}

.go-stats {
  margin-top: 40px;
  text-align: center;
}

.go-score {
  font-size: 56px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 0 20px rgba(0,255,255,0.5);
  letter-spacing: 4px;
}

.go-details {
  display: flex;
  gap: 32px;
  justify-content: center;
  margin-top: 12px;
  font-size: 18px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 2px;
}

.go-prompt {
  font-size: 20px;
  color: rgba(255,255,255,0.6);
  margin-top: 60px;
  letter-spacing: 4px;
  animation: pulse-prompt 1.8s ease-in-out infinite;
}

@media (max-width: 768px) {
  .go-title { font-size: 40px; letter-spacing: 4px; }
  .go-score { font-size: 36px; }
  .go-details { font-size: 14px; gap: 16px; }
  .go-prompt { font-size: 16px; margin-top: 40px; }
}
`;
