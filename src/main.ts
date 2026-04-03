import { Game } from './game/Game';

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  const game = new Game(canvas);
  await game.init();
  game.start();

  // Expose for debugging
  (window as any).__game = game;

  console.log(`[Particle Swarm Shooter] Tier: ${game.renderTier} | Max Particles: ${game.particleCount}`);
}

main().catch(console.error);
