/**
 * MobileControls — dual virtual joystick overlay for touch devices.
 *
 * Left half: movement joystick (drag direction = move direction)
 * Right half: aim joystick (drag direction = aim direction, auto-fires while touching)
 *
 * Visual: translucent circle base + filled knob that follows the finger.
 * The joystick appears at the touch-start position and disappears on release.
 */

export interface JoystickState {
  /** Normalized direction -1..1 per axis */
  x: number;
  y: number;
  /** Whether the joystick is currently active */
  active: boolean;
}

const BASE_RADIUS = 60;   // outer circle radius (CSS px)
const KNOB_RADIUS = 24;   // inner knob radius (CSS px)
const MAX_DRAG = 50;       // max drag distance before clamping (CSS px)
const BASE_COLOR = 'rgba(255,255,255,0.12)';
const KNOB_COLOR_MOVE = 'rgba(0,255,255,0.5)';
const KNOB_COLOR_AIM = 'rgba(255,100,100,0.5)';

interface JoystickDOM {
  container: HTMLDivElement;
  base: HTMLDivElement;
  knob: HTMLDivElement;
}

export class MobileControls {
  readonly moveStick: JoystickState = { x: 0, y: 0, active: false };
  readonly aimStick: JoystickState = { x: 0, y: 0, active: false };

  private moveTouch: number | null = null;  // touch identifier
  private aimTouch: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private aimOrigin = { x: 0, y: 0 };

  private moveDom: JoystickDOM;
  private aimDom: JoystickDOM;
  private overlay: HTMLDivElement;

  constructor(container: HTMLElement) {
    // Create overlay that sits on top of the canvas
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute; inset: 0; z-index: 10;
      pointer-events: auto; touch-action: none;
    `;
    container.appendChild(this.overlay);

    this.moveDom = this.createJoystickDOM(KNOB_COLOR_MOVE);
    this.aimDom = this.createJoystickDOM(KNOB_COLOR_AIM);

    this.overlay.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.overlay.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.overlay.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.overlay.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  private createJoystickDOM(knobColor: string): JoystickDOM {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute; display: none;
      pointer-events: none;
    `;

    const base = document.createElement('div');
    base.style.cssText = `
      position: absolute;
      width: ${BASE_RADIUS * 2}px; height: ${BASE_RADIUS * 2}px;
      border-radius: 50%;
      background: ${BASE_COLOR};
      border: 1.5px solid rgba(255,255,255,0.2);
      transform: translate(-50%, -50%);
    `;

    const knob = document.createElement('div');
    knob.style.cssText = `
      position: absolute; left: 50%; top: 50%;
      width: ${KNOB_RADIUS * 2}px; height: ${KNOB_RADIUS * 2}px;
      border-radius: 50%;
      background: ${knobColor};
      border: 1px solid rgba(255,255,255,0.4);
      transform: translate(-50%, -50%);
    `;

    base.appendChild(knob);
    container.appendChild(base);
    this.overlay.appendChild(container);

    return { container, base, knob };
  }

  private showJoystick(dom: JoystickDOM, cx: number, cy: number): void {
    dom.container.style.display = 'block';
    dom.container.style.left = `${cx}px`;
    dom.container.style.top = `${cy}px`;
    // Reset knob to center
    dom.knob.style.left = '50%';
    dom.knob.style.top = '50%';
  }

  private hideJoystick(dom: JoystickDOM): void {
    dom.container.style.display = 'none';
  }

  private updateKnob(dom: JoystickDOM, dx: number, dy: number): void {
    // dx, dy in CSS px, clamped to MAX_DRAG
    const dist = Math.sqrt(dx * dx + dy * dy);
    let clampedX = dx;
    let clampedY = dy;
    if (dist > MAX_DRAG) {
      clampedX = (dx / dist) * MAX_DRAG;
      clampedY = (dy / dist) * MAX_DRAG;
    }
    dom.knob.style.left = `calc(50% + ${clampedX}px)`;
    dom.knob.style.top = `calc(50% + ${clampedY}px)`;
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const halfW = window.innerWidth / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < halfW && this.moveTouch === null) {
        // Left half → move joystick
        this.moveTouch = t.identifier;
        this.moveOrigin.x = t.clientX;
        this.moveOrigin.y = t.clientY;
        this.moveStick.active = true;
        this.showJoystick(this.moveDom, t.clientX, t.clientY);
      } else if (t.clientX >= halfW && this.aimTouch === null) {
        // Right half → aim joystick
        this.aimTouch = t.identifier;
        this.aimOrigin.x = t.clientX;
        this.aimOrigin.y = t.clientY;
        this.aimStick.active = true;
        this.showJoystick(this.aimDom, t.clientX, t.clientY);
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.moveTouch) {
        const dx = t.clientX - this.moveOrigin.x;
        const dy = t.clientY - this.moveOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const norm = Math.min(dist / MAX_DRAG, 1);
        if (dist > 0) {
          this.moveStick.x = (dx / dist) * norm;
          this.moveStick.y = -(dy / dist) * norm; // flip Y (screen→world)
        }
        this.updateKnob(this.moveDom, dx, dy);
      }

      if (t.identifier === this.aimTouch) {
        const dx = t.clientX - this.aimOrigin.x;
        const dy = t.clientY - this.aimOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const norm = Math.min(dist / MAX_DRAG, 1);
        if (dist > 0) {
          this.aimStick.x = (dx / dist) * norm;
          this.aimStick.y = -(dy / dist) * norm; // flip Y
        }
        this.updateKnob(this.aimDom, dx, dy);
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.moveTouch) {
        this.moveTouch = null;
        this.moveStick.x = 0;
        this.moveStick.y = 0;
        this.moveStick.active = false;
        this.hideJoystick(this.moveDom);
      }

      if (t.identifier === this.aimTouch) {
        this.aimTouch = null;
        this.aimStick.x = 0;
        this.aimStick.y = 0;
        this.aimStick.active = false;
        this.hideJoystick(this.aimDom);
      }
    }
  };

  dispose(): void {
    this.overlay.removeEventListener('touchstart', this.onTouchStart);
    this.overlay.removeEventListener('touchmove', this.onTouchMove);
    this.overlay.removeEventListener('touchend', this.onTouchEnd);
    this.overlay.removeEventListener('touchcancel', this.onTouchEnd);
    this.overlay.remove();
  }
}
