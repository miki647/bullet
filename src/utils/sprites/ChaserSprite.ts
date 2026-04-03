/** Generates a Chaser enemy sprite (red/orange aggressive diamond shape) */
export function generateChaserSprite(): HTMLCanvasElement {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // -- Outer glow --
  ctx.save();
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 12;

  // -- Main body (angular diamond with spiky protrusions) --
  ctx.beginPath();
  ctx.moveTo(cx, 10);            // nose
  ctx.lineTo(cx + 12, cy - 8);   // right upper
  ctx.lineTo(cx + 28, cy - 4);   // right spike
  ctx.lineTo(cx + 14, cy + 4);   // right mid
  ctx.lineTo(cx + 20, cy + 20);  // right lower spike
  ctx.lineTo(cx + 6, cy + 14);   // right tail
  ctx.lineTo(cx, cy + 24);       // tail
  ctx.lineTo(cx - 6, cy + 14);   // left tail
  ctx.lineTo(cx - 20, cy + 20);  // left lower spike
  ctx.lineTo(cx - 14, cy + 4);   // left mid
  ctx.lineTo(cx - 28, cy - 4);   // left spike
  ctx.lineTo(cx - 12, cy - 8);   // left upper
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(cx, 10, cx, cy + 24);
  hullGrad.addColorStop(0, '#ff6644');
  hullGrad.addColorStop(0.5, '#cc2222');
  hullGrad.addColorStop(1, '#661111');
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.strokeStyle = '#ff8866';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // -- Eye/core (menacing single eye) --
  const eyeGrad = ctx.createRadialGradient(cx, cy - 4, 1, cx, cy - 4, 7);
  eyeGrad.addColorStop(0, '#ffffff');
  eyeGrad.addColorStop(0.4, '#ffaa44');
  eyeGrad.addColorStop(1, '#cc4400');
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 6, 0, Math.PI * 2);
  ctx.fillStyle = eyeGrad;
  ctx.fill();

  // -- Center line --
  ctx.beginPath();
  ctx.moveTo(cx, 14);
  ctx.lineTo(cx, cy + 20);
  ctx.strokeStyle = 'rgba(255, 100, 50, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
}
