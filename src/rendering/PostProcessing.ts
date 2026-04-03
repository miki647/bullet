import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Custom shader: kill flash (brief brightness) + vignette (edge darkening).
 */
const FlashVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFlash: { value: 0.0 },
    uVignetteIntensity: { value: 0.3 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFlash;
    uniform float uVignetteIntensity;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv) * (1.0 + uFlash);
      float dist = distance(vUv, vec2(0.5));
      float vignette = smoothstep(0.5, 0.9, dist);
      color.rgb *= 1.0 - vignette * uVignetteIntensity;
      gl_FragColor = color;
    }
  `,
};

/**
 * Post-processing pipeline: RenderPass → UnrealBloomPass → FlashVignette → OutputPass
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private flashPass: ShaderPass;
  private flashValue = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);

    // 1. Render the scene to a texture
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. Bloom: makes bright pixels glow outward
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(
      size,
      1.5,   // strength — strong neon glow
      0.6,   // radius — how far glow spreads
      0.3,   // threshold — neon lines bloom, dim grid doesn't
    );
    this.composer.addPass(this.bloomPass);

    // 3. Kill flash + vignette pass
    this.flashPass = new ShaderPass(FlashVignetteShader);
    this.composer.addPass(this.flashPass);

    // 4. Output pass — required for correct color space in Three.js 0.150+
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /** Trigger a brief screen-wide brightness flash on kill */
  triggerKillFlash(): void {
    this.flashValue = 0.05;
  }

  /** Call each frame to decay the flash */
  update(dt: number): void {
    if (this.flashValue > 0) {
      this.flashValue = Math.max(0, this.flashValue - dt * 2.5); // ~0.02s decay
      this.flashPass.uniforms['uFlash'].value = this.flashValue;
    }
  }

  render(): void {
    this.composer.render();
  }

  /** Adjust bloom parameters at runtime */
  setBloomParams(strength?: number, radius?: number, threshold?: number): void {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }
}
