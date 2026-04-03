export type RenderTier = 'webgpu' | 'webgl2';

export async function detectRenderTier(): Promise<RenderTier> {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        device.destroy();
        return 'webgpu';
      }
    } catch {
      console.warn('WebGPU adapter request failed, falling back to WebGL2');
    }
  }
  return 'webgl2';
}

export function isMobile(): boolean {
  return 'ontouchstart' in window;
}

export function getMaxParticles(tier: RenderTier, mobile: boolean): number {
  if (tier === 'webgpu') {
    return mobile ? 30000 : 50000;
  }
  return mobile ? 3000 : 5000;
}
