/** Generates a Swarm enemy sprite (green, small, insect-like) */
export function generateSwarmSprite(): HTMLCanvasElement {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // -- Outer glow --
  ctx.save();
  ctx.shadowColor = '#44ff44';
  ctx.shadowBlur = 8;

  // -- Main body (small triangular insect) --
  ctx.beginPath();
  ctx.moveTo(cx, 10);            // nose
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 18, cy - 2);   // right wing
  ctx.lineTo(cx + 10, cy + 6);
  ctx.lineTo(cx + 14, cy + 18);  // right tail
  ctx.lineTo(cx, cy + 12);       // tail center
  ctx.lineTo(cx - 14, cy + 18);  // left tail
  ctx.lineTo(cx - 10, cy + 6);
  ctx.lineTo(cx - 18, cy - 2);   // left wing
  ctx.lineTo(cx - 8, cy - 4);
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(cx, 10, cx, cy + 18);
  hullGrad.addColorStop(0, '#66ff88');
  hullGrad.addColorStop(0.5, '#22aa44');
  hullGrad.addColorStop(1, '#115522');
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.strokeStyle = '#88ffaa';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // -- Eyes (two small dots) --
  ctx.fillStyle = '#aaffcc';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 4, 2, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 4, 2, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}
