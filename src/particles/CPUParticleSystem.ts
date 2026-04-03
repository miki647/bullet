import * as THREE from 'three';

/**
 * High-performance CPU-driven particle system.
 *
 * **Optimization: Swap-and-Pop Compaction**
 * Active particles are always packed at indices [0 .. _activeCount).
 * - emit() appends to the end in O(1)
 * - update() swaps dying particles with the last active one (O(active), not O(max))
 * - setDrawRange() limits GPU work to only active particles
 *
 * Uses SoA (Structure of Arrays) for cache-friendly iteration
 * and THREE.Points with custom ShaderMaterial for single-draw-call rendering.
 */

// --- Custom shaders for per-particle size + soft circle ---
const VERT_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  varying vec4 vColor;
  varying float vLife;

  void main() {
    vColor = color; // vertexColors
    vLife = aLife;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    // Size in pixels — aSize is in world units, convert roughly
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 0.0, 64.0);
  }
`;

const FRAG_SHADER = /* glsl */ `
  varying vec4 vColor;
  varying float vLife;

  void main() {
    if (vLife <= 0.0) discard;
    // Soft circle: distance from center
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d) * vColor.a;
    gl_FragColor = vec4(vColor.rgb, alpha);
  }
`;

export interface EmitOptions {
  /** Base color of the explosion (RGB). */
  color?: THREE.Color;
  /** Base speed of outgoing particles (units/s). Default 300. */
  baseSpeed?: number;
  /** Speed randomness variance (0–1). Default 0.6. */
  speedVariance?: number;
  /** Min particle lifetime in seconds. Default 0.4. */
  minLife?: number;
  /** Max particle lifetime in seconds. Default 1.5. */
  maxLife?: number;
  /** Base particle size in world units. Default 6. */
  baseSize?: number;
}

export class CPUParticleSystem {
  readonly points: THREE.Points;
  private readonly max: number;

  // SoA layout for cache-friendly iteration
  // Active particles are packed at indices [0 .. _activeCount)
  private posX: Float32Array;
  private posY: Float32Array;
  private velX: Float32Array;
  private velY: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseR: Float32Array;
  private baseG: Float32Array;
  private baseB: Float32Array;
  private bSize: Float32Array;

  // Three.js buffer refs
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private lifeAttr: THREE.BufferAttribute;
  private geo: THREE.BufferGeometry;

  // Compaction state
  private _activeCount = 0;

  // Physics params
  private readonly DAMPING = 0.97;
  private readonly GRAVITY = 30; // subtle downward pull

  constructor(maxParticles: number) {
    this.max = maxParticles;

    // Allocate SoA
    this.posX = new Float32Array(maxParticles);
    this.posY = new Float32Array(maxParticles);
    this.velX = new Float32Array(maxParticles);
    this.velY = new Float32Array(maxParticles);
    this.life = new Float32Array(maxParticles); // all 0 → dead
    this.maxLife = new Float32Array(maxParticles);
    this.baseR = new Float32Array(maxParticles);
    this.baseG = new Float32Array(maxParticles);
    this.baseB = new Float32Array(maxParticles);
    this.bSize = new Float32Array(maxParticles);

    // Build geometry
    this.geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 4);
    const sizes = new Float32Array(maxParticles);
    const lives = new Float32Array(maxParticles);

    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colAttr = new THREE.BufferAttribute(colors, 4);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);
    this.lifeAttr = new THREE.BufferAttribute(lives, 1);

    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.lifeAttr.setUsage(THREE.DynamicDrawUsage);

    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    this.geo.setAttribute('aSize', this.sizeAttr);
    this.geo.setAttribute('aLife', this.lifeAttr);

    // Start with nothing drawn
    this.geo.setDrawRange(0, 0);

    // Material
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.position.z = 2; // above enemies, below UI
  }

  /**
   * Emit particles at a position.
   * Appends to the active region — O(count) with no scanning.
   */
  emit(x: number, y: number, count: number, opts: EmitOptions = {}): void {
    const baseSpeed = opts.baseSpeed ?? 300;
    const speedVar = opts.speedVariance ?? 0.6;
    const minLife = opts.minLife ?? 0.4;
    const maxLife = opts.maxLife ?? 1.5;
    const pSize = opts.baseSize ?? 6;
    const color = opts.color;
    const cr = color ? color.r : 1.0;
    const cg = color ? color.g : 0.9;
    const cb = color ? color.b : 0.3;

    const available = this.max - this._activeCount;
    const toSpawn = Math.min(count, available);

    for (let s = 0; s < toSpawn; s++) {
      const idx = this._activeCount;

      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (1 - speedVar + Math.random() * speedVar * 2);

      this.posX[idx] = x;
      this.posY[idx] = y;
      this.velX[idx] = Math.cos(angle) * speed;
      this.velY[idx] = Math.sin(angle) * speed;

      const lifeVal = minLife + Math.random() * (maxLife - minLife);
      this.life[idx] = lifeVal;
      this.maxLife[idx] = lifeVal;

      this.baseR[idx] = cr;
      this.baseG[idx] = cg;
      this.baseB[idx] = cb;
      this.bSize[idx] = pSize * (0.5 + Math.random() * 1.0);

      this._activeCount++;
    }
  }

  /**
   * Update active particles (physics + visual buffers).
   * Only processes [0 .. _activeCount). Dead particles are swapped to the end.
   */
  update(dt: number): void {
    const active = this._activeCount;

    // Early exit: nothing to do
    if (active === 0) {
      this.geo.setDrawRange(0, 0);
      return;
    }

    const damping = Math.pow(this.DAMPING, dt * 60); // frame-rate independent damping
    const gravDt = this.GRAVITY * dt;

    // Apply attractor force before main physics loop
    this.applyAttractor(dt);

    const posArr = this.posAttr.array as Float32Array;
    const colArr = this.colAttr.array as Float32Array;
    const sizeArr = this.sizeAttr.array as Float32Array;
    const lifeArr = this.lifeAttr.array as Float32Array;

    let i = 0;
    let count = active;

    while (i < count) {
      // Life decay
      const newLife = this.life[i] - dt;

      if (newLife <= 0) {
        // Swap with last active particle, shrink active region
        count--;
        this.swapParticles(i, count);
        // Don't increment i — re-process this index (now holds swapped particle)
        continue;
      }

      this.life[i] = newLife;

      // Physics update
      this.velX[i] *= damping;
      this.velY[i] *= damping;
      this.velY[i] -= gravDt;
      this.posX[i] += this.velX[i] * dt;
      this.posY[i] += this.velY[i] * dt;

      // Normalized time (1 = just born, 0 = dead)
      const t = Math.max(0, newLife / this.maxLife[i]);

      // Color interpolation: base color → dark red → transparent
      const r = this.baseR[i] * t + 0.3 * (1 - t);
      const g = this.baseG[i] * t * t; // green fades faster
      const b = this.baseB[i] * t * t * t; // blue fades fastest
      const a = t * t; // quadratic alpha fadeout

      // Write to GPU buffers
      const i3 = i * 3;
      posArr[i3] = this.posX[i];
      posArr[i3 + 1] = this.posY[i];
      posArr[i3 + 2] = 0;

      const i4 = i * 4;
      colArr[i4] = r;
      colArr[i4 + 1] = g;
      colArr[i4 + 2] = b;
      colArr[i4 + 3] = a;

      sizeArr[i] = this.bSize[i] * t;
      lifeArr[i] = newLife;

      i++;
    }

    this._activeCount = count;

    // Limit draw to only active particles
    this.geo.setDrawRange(0, count);

    // Flag buffers for GPU upload — only upload the active region
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.lifeAttr.needsUpdate = true;

    // Limit GPU upload range to active particles only
    // (Three.js r125+ supports updateRange on BufferAttribute)
    const posRange = { offset: 0, count: count * 3 };
    const colRange = { offset: 0, count: count * 4 };
    const scalarRange = { offset: 0, count: count };
    (this.posAttr as any).updateRange = posRange;
    (this.colAttr as any).updateRange = colRange;
    (this.sizeAttr as any).updateRange = scalarRange;
    (this.lifeAttr as any).updateRange = scalarRange;
  }

  /**
   * Swap all SoA fields between index a and index b.
   */
  private swapParticles(a: number, b: number): void {
    if (a === b) return;

    // Swap all SoA arrays
    let tmp: number;
    tmp = this.posX[a]; this.posX[a] = this.posX[b]; this.posX[b] = tmp;
    tmp = this.posY[a]; this.posY[a] = this.posY[b]; this.posY[b] = tmp;
    tmp = this.velX[a]; this.velX[a] = this.velX[b]; this.velX[b] = tmp;
    tmp = this.velY[a]; this.velY[a] = this.velY[b]; this.velY[b] = tmp;
    tmp = this.life[a]; this.life[a] = this.life[b]; this.life[b] = tmp;
    tmp = this.maxLife[a]; this.maxLife[a] = this.maxLife[b]; this.maxLife[b] = tmp;
    tmp = this.baseR[a]; this.baseR[a] = this.baseR[b]; this.baseR[b] = tmp;
    tmp = this.baseG[a]; this.baseG[a] = this.baseG[b]; this.baseG[b] = tmp;
    tmp = this.baseB[a]; this.baseB[a] = this.baseB[b]; this.baseB[b] = tmp;
    tmp = this.bSize[a]; this.bSize[a] = this.bSize[b]; this.bSize[b] = tmp;
  }

  // --- Attractor system ---
  private attractX = 0;
  private attractY = 0;
  private attractStrength = 0;

  setAttractor(x: number, y: number, strength: number): void {
    this.attractX = x;
    this.attractY = y;
    this.attractStrength = strength;
  }

  clearAttractor(): void {
    this.attractStrength = 0;
  }

  /** Applies attractor force to all active particles during update. */
  applyAttractor(dt: number): void {
    if (this.attractStrength <= 0) return;
    const str = this.attractStrength;
    const ax = this.attractX;
    const ay = this.attractY;

    for (let i = 0; i < this._activeCount; i++) {
      const dx = ax - this.posX[i];
      const dy = ay - this.posY[i];
      const distSq = dx * dx + dy * dy + 1; // +1 to avoid division by zero
      const dist = Math.sqrt(distSq);
      const force = str / dist; // inversely proportional
      this.velX[i] += (dx / dist) * force * dt;
      this.velY[i] += (dy / dist) * force * dt;
    }
  }

  get activeCount(): number {
    return this._activeCount;
  }
}
