import * as THREE from 'three';
import { MobileControls } from '../ui/MobileControls';
import { isMobile } from '../utils/DeviceDetect';

export interface InputState {
  /** Normalized movement direction (-1 to 1 per axis) */
  moveDir: THREE.Vector2;
  /** World-space aim position */
  aimPos: THREE.Vector2;
  /** Whether fire button is held */
  firing: boolean;
  /** True for one frame when bomb key (Space) is pressed */
  bombActivated: boolean;
}

export class InputSystem {
  private keys = new Map<string, boolean>();
  private mouseScreen = new THREE.Vector2();
  private mouseDown = false;
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private mobile: boolean;
  private mobileControls: MobileControls | null = null;

  /** Last aim direction for mobile (persists when aim stick is released) */
  private lastAimDir = new THREE.Vector2(0, 1);
  private spaceWasDown = false;

  readonly state: InputState = {
    moveDir: new THREE.Vector2(),
    aimPos: new THREE.Vector2(),
    firing: false,
    bombActivated: false,
  };

  constructor(canvas: HTMLCanvasElement, camera: THREE.OrthographicCamera) {
    this.canvas = canvas;
    this.camera = camera;
    this.mobile = isMobile();

    if (this.mobile) {
      const container = canvas.parentElement!;
      this.mobileControls = new MobileControls(container);
    } else {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.canvas.addEventListener('mousemove', this.onMouseMove);
      this.canvas.addEventListener('mousedown', this.onMouseDown);
      this.canvas.addEventListener('mouseup', this.onMouseUp);
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.set(e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseScreen.set(e.clientX, e.clientY);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };

  update(playerX = 0, playerY = 0): void {
    if (this.mobile) {
      this.updateMobile(playerX, playerY);
    } else {
      this.updatePC();
    }
  }

  private updatePC(): void {
    // Movement direction from WASD / Arrow keys
    let mx = 0;
    let my = 0;
    if (this.keys.get('KeyW') || this.keys.get('ArrowUp')) my += 1;
    if (this.keys.get('KeyS') || this.keys.get('ArrowDown')) my -= 1;
    if (this.keys.get('KeyA') || this.keys.get('ArrowLeft')) mx -= 1;
    if (this.keys.get('KeyD') || this.keys.get('ArrowRight')) mx += 1;

    this.state.moveDir.set(mx, my);
    if (mx !== 0 && my !== 0) {
      this.state.moveDir.normalize();
    }

    // Convert screen mouse position to world coordinates
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((this.mouseScreen.x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((this.mouseScreen.y - rect.top) / rect.height) * 2 + 1;

    const worldX = ndcX * (this.camera.right - this.camera.left) / 2 + (this.camera.right + this.camera.left) / 2;
    const worldY = ndcY * (this.camera.top - this.camera.bottom) / 2 + (this.camera.top + this.camera.bottom) / 2;

    this.state.aimPos.set(worldX, worldY);
    this.state.firing = this.mouseDown;

    // Bomb: edge-triggered on Space key
    const spaceDown = this.keys.get('Space') ?? false;
    this.state.bombActivated = spaceDown && !this.spaceWasDown;
    this.spaceWasDown = spaceDown;
  }

  private updateMobile(playerX: number, playerY: number): void {
    const mc = this.mobileControls!;

    // Movement from left joystick
    this.state.moveDir.set(mc.moveStick.x, mc.moveStick.y);

    // Aim from right joystick → convert joystick direction to world aim position
    if (mc.aimStick.active && (mc.aimStick.x !== 0 || mc.aimStick.y !== 0)) {
      this.lastAimDir.set(mc.aimStick.x, mc.aimStick.y);
    }

    // Project aim direction 400 units ahead of player for world-space aim position
    this.state.aimPos.set(
      playerX + this.lastAimDir.x * 400,
      playerY + this.lastAimDir.y * 400,
    );

    // Auto-fire while aim stick is active
    this.state.firing = mc.aimStick.active;

    // Mobile bomb activation is handled by HUD button, not joystick
    this.state.bombActivated = false;
  }

  dispose(): void {
    if (this.mobileControls) {
      this.mobileControls.dispose();
    } else {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('mouseup', this.onMouseUp);
    }
  }
}
