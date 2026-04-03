/**
 * StartScreen — title overlay with "PRESS TO START" prompt.
 * Fires a callback when user clicks/taps.
 */
export class StartScreen {
  private overlay: HTMLDivElement;
  private onStart: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'start-screen';
    this.overlay.innerHTML = `
      <div class="start-title">PARTICLE SWARM</div>
      <div class="start-subtitle">SHOOTER</div>
      <div class="start-prompt">CLICK OR TAP TO START</div>
      <div class="start-controls">
        <span>WASD — Move</span>
        <span>Mouse — Aim & Shoot</span>
      </div>
    `;
    container.appendChild(this.overlay);

    const style = document.createElement('style');
    style.textContent = START_CSS;
    document.head.appendChild(style);

    this.overlay.addEventListener('click', this.handleStart);
    this.overlay.addEventListener('touchend', this.handleStart);
  }

  private handleStart = (e: Event): void => {
    e.preventDefault();
    this.onStart?.();
  };

  show(onStart: () => void): void {
    this.onStart = onStart;
    this.overlay.style.display = 'flex';
    // Trigger fade-in
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

const START_CSS = `
#start-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  background: radial-gradient(ellipse at center, rgba(6,10,18,0.85) 0%, rgba(6,10,18,0.97) 100%);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.4s ease;
  font-family: 'Segoe UI', 'Consolas', monospace;
  user-select: none;
  -webkit-user-select: none;
}

.start-title {
  font-size: 72px;
  font-weight: 900;
  color: #00ffff;
  text-shadow: 0 0 30px rgba(0,255,255,0.6), 0 0 60px rgba(0,255,255,0.3);
  letter-spacing: 8px;
  line-height: 1;
}

.start-subtitle {
  font-size: 48px;
  font-weight: 300;
  color: #ff44ff;
  text-shadow: 0 0 20px rgba(255,68,255,0.5);
  letter-spacing: 16px;
  margin-top: 4px;
}

.start-prompt {
  font-size: 20px;
  color: rgba(255,255,255,0.7);
  margin-top: 60px;
  letter-spacing: 4px;
  animation: pulse-prompt 1.8s ease-in-out infinite;
}

.start-controls {
  display: flex;
  gap: 32px;
  margin-top: 24px;
  font-size: 14px;
  color: rgba(255,255,255,0.35);
  letter-spacing: 1px;
}

@keyframes pulse-prompt {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .start-title { font-size: 40px; letter-spacing: 4px; }
  .start-subtitle { font-size: 28px; letter-spacing: 8px; }
  .start-prompt { font-size: 16px; margin-top: 40px; }
  .start-controls { display: none; }
}
`;
