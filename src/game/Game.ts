import * as THREE from 'three';
import { detectRenderTier, isMobile, getMaxParticles, type RenderTier } from '../utils/DeviceDetect';
import { InputSystem } from '../systems/InputSystem';
import { Player } from '../entities/Player';
import { BulletManager } from '../entities/Bullet';
import { EnemyManager } from '../entities/Enemy';
import { TankBulletManager } from '../entities/TankBullet';
import { WaveManager, type TransitionPhase } from './WaveManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { EngineTrail } from '../effects/EngineTrail';
import { HitFlash } from '../effects/HitFlash';
import { ScreenShake } from '../effects/ScreenShake';
import { SlowMotion } from '../effects/SlowMotion';
import { ShockwaveRing } from '../effects/ShockwaveRing';
import { TankDebris } from '../effects/TankDebris';
import { CameraSystem } from '../systems/CameraSystem';
import { NeonGrid } from '../rendering/NeonGrid';
import { StarField } from '../rendering/StarField';
import { AmbientDust } from '../rendering/AmbientDust';
import { PostProcessingPipeline } from '../rendering/PostProcessing';
import { ParticleManager } from '../particles/ParticleManager';
import { ScoreSystem } from '../systems/ScoreSystem';
import { GameState } from './GameState';
import { HUD } from '../ui/HUD';
import { StartScreen } from '../ui/StartScreen';
import { GameOverScreen } from '../ui/GameOverScreen';
import { SoundManager } from '../systems/SoundManager';
import { Bounds } from '../utils/Bounds';

// Pre-allocated colors to avoid GC pressure in hot loops
const RING_COLOR_TANK = new THREE.Color(0xbb55ff);
const RING_COLOR_SWARM = new THREE.Color(0x33ff88);
const RING_COLOR_CHASER = new THREE.Color(0xff4444);
const PARTICLE_COLOR_HIT = new THREE.Color(0xff2222);
const PARTICLE_COLOR_DEATH = new THREE.Color(0x00ffff);
const RING_COLOR_WAVE = new THREE.Color(0x00ffff);

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private tier!: RenderTier;
  private maxParticles!: number;
  private inputSystem!: InputSystem;
  private player!: Player;
  private engineTrail!: EngineTrail;
  private bulletManager!: BulletManager;
  private enemyManager!: EnemyManager;
  private tankBulletManager!: TankBulletManager;
  private waveManager!: WaveManager;
  private collisionSystem!: CollisionSystem;
  private particleManager!: ParticleManager;
  private scoreSystem!: ScoreSystem;
  private hud!: HUD;
  private startScreen!: StartScreen;
  private gameOverScreen!: GameOverScreen;
  private gameState!: GameState;

  // Neon background layers
  private neonGrid!: NeonGrid;
  private starField!: StarField;
  private ambientDust!: AmbientDust;
  private postProcessing!: PostProcessingPipeline;
  private screenShake!: ScreenShake;
  private slowMotion!: SlowMotion;
  private shockwaveRing!: ShockwaveRing;
  private tankDebris!: TankDebris;
  private cameraSystem!: CameraSystem;

  private lastTime = 0;
  private elapsed = 0;
  private lastTransitionPhase: TransitionPhase = 'none';

  // Game area size (logical units)
  static readonly WORLD_WIDTH = 1920;
  static readonly WORLD_HEIGHT = 1080;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    this.tier = await detectRenderTier();
    const mobile = isMobile();
    this.maxParticles = getMaxParticles(this.tier, mobile);

    console.log(`Render tier: ${this.tier} | Max particles: ${this.maxParticles}`);

    this.initRenderer();
    this.initCamera();
    this.initScene();
    this.initBackground();
    this.initGameObjects();
    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera);
    this.screenShake = new ScreenShake(this.camera);
    this.slowMotion = new SlowMotion();
    this.shockwaveRing = new ShockwaveRing();
    this.scene.add(this.shockwaveRing.group);
    this.tankDebris = new TankDebris();
    this.scene.add(this.tankDebris.group);
    this.cameraSystem = new CameraSystem(this.camera);

    // Game state & UI screens
    this.gameState = new GameState();
    const container = document.getElementById('game-container')!;
    this.startScreen = new StartScreen(container);
    this.gameOverScreen = new GameOverScreen(container);

    // Show start screen
    this.hud.hide();
    this.hud.setBadge(this.tier, this.maxParticles);
    this.player.mesh.visible = false;
    this.startScreen.show(() => this.startPlaying());

    window.addEventListener('resize', this.onResize.bind(this));
    this.onResize();
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060a12);
    const w = window.innerWidth || this.canvas.clientWidth || 1280;
    const h = window.innerHeight || this.canvas.clientHeight || 720;
    this.renderer.setSize(w, h);
  }

  private initCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const halfH = Game.WORLD_HEIGHT / 2;
    const halfW = halfH * aspect;

    this.camera = new THREE.OrthographicCamera(
      -halfW, halfW, halfH, -halfH, 0.1, 1000,
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    Bounds.update(halfW, halfH);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
  }

  private initBackground(): void {
    this.neonGrid = new NeonGrid(Game.WORLD_WIDTH, Game.WORLD_HEIGHT);
    this.scene.add(this.neonGrid.group);

    this.starField = new StarField(Game.WORLD_WIDTH, Game.WORLD_HEIGHT);
    this.scene.add(this.starField.group);

    this.ambientDust = new AmbientDust(Game.WORLD_WIDTH, Game.WORLD_HEIGHT);
    this.scene.add(this.ambientDust.group);
  }

  private initGameObjects(): void {
    this.inputSystem = new InputSystem(this.canvas, this.camera);

    this.player = new Player();
    this.scene.add(this.player.mesh);

    this.engineTrail = new EngineTrail(30, new THREE.Color(0x00ffff));
    this.scene.add(this.engineTrail.mesh);

    this.bulletManager = new BulletManager();
    this.scene.add(this.bulletManager.group);

    this.enemyManager = new EnemyManager();
    this.scene.add(this.enemyManager.group);

    this.tankBulletManager = new TankBulletManager();
    this.scene.add(this.tankBulletManager.group);

    this.waveManager = new WaveManager(this.enemyManager);
    this.collisionSystem = new CollisionSystem();

    this.particleManager = new ParticleManager(this.maxParticles);
    this.scene.add(this.particleManager.mesh);

    this.scoreSystem = new ScoreSystem();
    this.hud = new HUD();
  }

  private onResize(): void {
    const w = window.innerWidth || this.canvas.clientWidth || 1280;
    const h = window.innerHeight || this.canvas.clientHeight || 720;
    if (w === 0 || h === 0) return;

    const aspect = w / h;
    const halfH = Game.WORLD_HEIGHT / 2;
    const halfW = halfH * aspect;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    // Update dynamic play bounds to match camera view
    Bounds.update(halfW, halfH);

    this.renderer.setSize(w, h);
    this.postProcessing?.setSize(w, h);
  }

  start(): void {
    this.lastTime = performance.now();
    this.loop();
  }

  // ─── State transitions ──────────────────────────────────

  private startPlaying(): void {
    SoundManager.resume();
    this.gameState.transition('PLAYING');
    this.startScreen.hide();
    this.gameOverScreen.hide();

    // Reset all game systems
    this.player.reset();
    this.player.mesh.visible = true;
    this.bulletManager.reset();
    this.enemyManager.reset();
    this.tankBulletManager.reset();
    this.waveManager.reset();
    this.scoreSystem.reset();

    this.hud.show();
    this.hud.updateHP(this.player.hp, this.player.maxHp);
  }

  private onGameOver(): void {
    this.gameState.transition('GAMEOVER');
    this.hud.hide();
    this.gameOverScreen.show(
      this.scoreSystem.score,
      this.scoreSystem.wave,
      this.scoreSystem.maxChain,
      () => this.startPlaying(),
    );
  }

  // ─── Game loop ──────────────────────────────────────────

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const dt = this.slowMotion.apply(rawDt);
    this.elapsed += dt;

    // Retry resize if canvas is still 0x0
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.onResize();
    }

    // Always update background (visible in all states)
    const px = this.player.position.x;
    const py = this.player.position.y;
    this.neonGrid.update(dt, px, py);
    this.starField.update(dt, this.elapsed);
    this.ambientDust.update(dt, px, py);

    // Particles & effects always update (for lingering visuals after death)
    this.particleManager.update(dt, dt * 1000);
    HitFlash.update(dt);
    this.shockwaveRing.update(dt);
    this.tankDebris.update(dt);

    // Camera: look-ahead + dynamic zoom → then screen shake on top
    const camBase = this.cameraSystem.update(
      rawDt,
      this.player.velocity.x, this.player.velocity.y,
      this.enemyManager.activeCount,
    );
    this.screenShake.setBasePosition(camBase.x, camBase.y, camBase.z);
    this.screenShake.update(rawDt);
    this.postProcessing.update(rawDt);

    if (this.gameState.isPlaying) {
      this.updatePlaying(dt);
    }

    this.postProcessing.render();
  };

  private updatePlaying(dt: number): void {
    // Input & player
    this.inputSystem.update(this.player.position.x, this.player.position.y);
    this.player.update(dt, this.inputSystem.state);
    this.engineTrail.update(this.player.position.x, this.player.position.y);

    // Bullet firing & update
    if (this.inputSystem.state.firing) {
      const { aimPos } = this.inputSystem.state;
      const fired = this.bulletManager.tryFire(
        this.player.position.x, this.player.position.y,
        aimPos.x, aimPos.y,
      );
      if (fired) SoundManager.fire();
    }
    this.bulletManager.update(dt);

    // Wave spawning & enemy AI
    this.waveManager.update(dt, this.enemyManager.activeCount, this.player.position.x, this.player.position.y);
    this.handleWaveTransition();
    this.enemyManager.update(dt, this.player.position.x, this.player.position.y);

    // Spawn tank bullets from fire requests (sound once per salvo, not per bullet)
    const tankReqs = this.enemyManager.tankFireRequests;
    if (tankReqs.length > 0) {
      SoundManager.tankFire();
      for (const req of tankReqs) {
        this.tankBulletManager.fire(req.x, req.y, req.angle);
      }
    }
    this.tankBulletManager.update(dt);

    // Collision detection
    const collisions = this.collisionSystem.check(
      this.bulletManager,
      this.enemyManager,
      this.player.position.x,
      this.player.position.y,
      this.tankBulletManager,
    );

    // React to collisions
    for (const event of collisions) {
      if (event.type === 'bullet_enemy') {
        this.scoreSystem.registerKill(event.enemyType);
        const chain = this.scoreSystem.chainMultiplier;
        const ex = event.enemyX;
        const ey = event.enemyY;

        // Sound: explosion (type-dependent)
        if (event.enemyType === 'tank') {
          SoundManager.tankExplosion();
        } else {
          SoundManager.explosion(0.8 + Math.min(chain * 0.15, 1.2));
        }

        this.particleManager.emitExplosion(ex, ey, event.enemyType, chain);

        // Shockwave ring (color per enemy type)
        const ringColor = event.enemyType === 'tank' ? RING_COLOR_TANK
          : event.enemyType === 'swarm' ? RING_COLOR_SWARM
          : RING_COLOR_CHASER;
        this.shockwaveRing.trigger(ex, ey, ringColor);

        // Grid shockwave distortion
        this.neonGrid.addShockwave(ex, ey);

        // Visual knockback on nearby entities
        this.enemyManager.applyVisualKnockback(ex, ey);
        this.bulletManager.applyVisualKnockback(ex, ey);

        // Tank debris on kill
        if (event.enemyType === 'tank') {
          this.tankDebris.trigger(ex, ey);
        }

        // Micro flash
        this.postProcessing.triggerKillFlash();

        // Screen shake scales with chain & enemy type
        const baseShake = event.enemyType === 'tank' ? 12 : 4;
        const shakeIntensity = baseShake + Math.min(chain, 10) * 1.5;
        this.screenShake.trigger(shakeIntensity, 0.2 + Math.min(chain * 0.02, 0.2));

        // Slow motion on chain thresholds (only at higher chains)
        if (chain >= 10) {
          this.slowMotion.trigger(0.15, 0.6);
        } else if (chain >= 8) {
          this.slowMotion.trigger(0.25, 0.4);
        } else if (chain >= 5) {
          this.slowMotion.trigger(0.4, 0.3);
        }
      }
      if (event.type === 'bullet_enemy_hit') {
        SoundManager.hit();
        // Non-lethal hit — trigger Tank hit pulse
        if (event.enemyType === 'tank') {
          this.enemyManager.triggerHitPulse(event.enemyX, event.enemyY);
        }
      }
      if (event.type === 'bullet_near_miss' && event.enemyRef) {
        this.enemyManager.flashGlow(event.enemyRef);
      }
      if (event.type === 'enemy_player' || event.type === 'tank_bullet_player') {
        const damaged = this.player.takeDamage();
        if (damaged) {
          SoundManager.playerHit();
          // Particle burst on hit
          this.particleManager.emit(event.enemyX, event.enemyY, 50, {
            color: PARTICLE_COLOR_HIT,
            baseSpeed: 200,
            maxLife: 0.8,
          });
          this.screenShake.trigger(20, 0.4);
          this.slowMotion.trigger(0.2, 0.5);
          this.hud.updateHP(this.player.hp, this.player.maxHp);

          // Check for death
          if (this.player.hp <= 0) {
            SoundManager.playerDeath();
            this.player.mesh.visible = false;
            // Death explosion
            this.particleManager.emit(
              this.player.position.x, this.player.position.y, 200,
              { color: PARTICLE_COLOR_DEATH, baseSpeed: 350, maxLife: 1.5 },
            );
            this.screenShake.trigger(30, 0.6);
            this.slowMotion.trigger(0.1, 1.0);
            // Delay game over screen slightly
            setTimeout(() => this.onGameOver(), 1200);
            return;
          }
        }
      }
    }

    // Score & chain timer
    this.scoreSystem.wave = this.waveManager.currentWave;
    this.scoreSystem.update(dt);

    // HUD overlay
    this.hud.update(dt, this.scoreSystem);
    this.hud.updateParticleCount(this.particleManager.activeCount);
  }

  get renderTier(): RenderTier {
    return this.tier;
  }

  get particleCount(): number {
    return this.maxParticles;
  }

  /** Debug info for dev tools */
  get debugInfo() {
    return {
      enemies: this.enemyManager.activeCount,
      wave: this.waveManager.currentWave,
      resting: this.waveManager.isResting,
      transition: this.waveManager.transitionPhase,
      bullets: this.bulletManager.activeCount,
      particles: this.particleManager.activeCount,
      emitScale: this.particleManager.emitScale,
      maxParticles: this.particleManager.maxCapacity,
      score: this.scoreSystem.score,
      chain: this.scoreSystem.chainMultiplier,
      maxChain: this.scoreSystem.maxChain,
    };
  }

  // ─── Wave transition orchestration ──────────────────────

  private handleWaveTransition(): void {
    const phase = this.waveManager.transitionPhase;
    if (phase === this.lastTransitionPhase) return;

    const prevPhase = this.lastTransitionPhase;
    this.lastTransitionPhase = phase;

    switch (phase) {
      case 'suction':
        // Pull all particles toward screen center
        this.particleManager.setAttractor(0, 0, 800);
        break;

      case 'burst': {
        // Central shockwave burst
        this.particleManager.clearAttractor();
        this.shockwaveRing.trigger(0, 0, RING_COLOR_WAVE);
        this.neonGrid.addShockwave(0, 0);
        this.screenShake.trigger(15, 0.3);
        this.postProcessing.triggerKillFlash();
        SoundManager.waveBurst();
        break;
      }

      case 'text':
        // Show wave announcement (next wave number)
        this.hud.showWaveAnnounce(this.waveManager.currentWave + 1);
        SoundManager.waveAnnounce();
        break;

      case 'rest':
        // Hide wave announcement
        this.hud.hideWaveAnnounce();
        break;

      case 'none':
        // Transition ended — cleanup
        if (prevPhase !== 'none') {
          this.hud.hideWaveAnnounce();
          this.particleManager.clearAttractor();
        }
        break;
    }
  }
}
