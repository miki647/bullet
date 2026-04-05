import * as THREE from 'three';
import type { InputState } from '../systems/InputSystem';
import { Bounds } from '../utils/Bounds';
import { createNeonShape, PLAYER_VERTICES, applyMicroVibration, createThrusterFlame } from '../rendering/NeonShapes';

/** Lerp between two angles handling the -PI/+PI wrap */
function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  // Normalize diff to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export class Player {
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector2(0, 0);
  readonly velocity = new THREE.Vector2(0, 0);

  private static readonly SPEED = 400;
  static readonly MAX_HP = 5;
  private _hp = Player.MAX_HP;
  private _invincibleTimer = 0; // seconds of invincibility after hit
  private thrusterFlame: THREE.Group;
  private elapsed = 0;

  get hp(): number { return this._hp; }
  get maxHp(): number { return Player.MAX_HP; }
  get invincible(): boolean { return this._invincibleTimer > 0; }

  takeDamage(amount = 1): boolean {
    if (this._invincibleTimer > 0) return false;
    this._hp = Math.max(0, this._hp - amount);
    this._invincibleTimer = 1.0; // 1 second invincibility
    return true;
  }

  reset(): void {
    this._hp = Player.MAX_HP;
    this._invincibleTimer = 0;
    this.position.set(0, 0);
    this.mesh.position.set(0, 0, 1);
    this.mesh.rotation.z = 0;
    this.mesh.visible = true;
  }

  constructor() {
    this.mesh = createNeonShape(PLAYER_VERTICES, new THREE.Color(0x00ffff));
    this.mesh.position.z = 1;

    this.thrusterFlame = createThrusterFlame();
    this.mesh.add(this.thrusterFlame);
  }

  update(dt: number, input: InputState): void {
    this.elapsed += dt;

    // Invincibility countdown + blink
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= dt;
      // Blink: toggle visibility at ~10Hz
      this.mesh.visible = Math.floor(this._invincibleTimer * 10) % 2 === 0;
      if (this._invincibleTimer <= 0) {
        this._invincibleTimer = 0;
        this.mesh.visible = true;
      }
    }

    // Movement
    this.velocity.set(input.moveDir.x * Player.SPEED, input.moveDir.y * Player.SPEED);
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Clamp to play area bounds
    const halfW = Bounds.halfW;
    const halfH = Bounds.halfH;
    this.position.x = Math.max(-halfW, Math.min(halfW, this.position.x));
    this.position.y = Math.max(-halfH, Math.min(halfH, this.position.y));

    // Apply position
    this.mesh.position.x = this.position.x;
    this.mesh.position.y = this.position.y;

    // Smooth rotation toward aim
    const dx = input.aimPos.x - this.position.x;
    const dy = input.aimPos.y - this.position.y;
    const targetAngle = -Math.atan2(dx, dy);
    const smoothFactor = 1 - Math.pow(0.001, dt);
    this.mesh.rotation.z = lerpAngle(this.mesh.rotation.z, targetAngle, smoothFactor);

    // Thruster flame: scale with movement speed + flicker
    const speed = input.moveDir.length();
    const flicker = Math.sin(this.elapsed * 20) * 0.2;
    const flameScale = 0.3 + speed * 0.8 + flicker;
    this.thrusterFlame.scale.set(
      0.5 + speed * 0.5,
      Math.max(0.1, flameScale),
      1,
    );

    // Micro vibration on inner frame vertices
    applyMicroVibration(this.mesh, PLAYER_VERTICES, 0.3, this.elapsed);
  }
}
