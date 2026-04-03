/** Generates a player bullet sprite (bright cyan/white laser bolt) */
export function generateBulletSprite(): HTMLCanvasElement {
  const w = 16;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w / 2;

  // -- Outer glow --
  const glowGrad = ctx.createRadialGradient(cx, h / 2, 0, cx, h / 2, w / 2);
  glowGrad.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
  glowGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, h);

  // -- Core bolt --
  const boltGrad = ctx.createLinearGradient(cx, 2, cx, h - 2);
  boltGrad.addColorStop(0, '#ffffff');
  boltGrad.addColorStop(0.3, '#aaffff');
  boltGrad.addColorStop(0.7, '#00ddff');
  boltGrad.addColorStop(1, '#0088aa');

  ctx.beginPath();
  ctx.moveTo(cx, 2);           // tip
  ctx.lineTo(cx + 3, 8);
  ctx.lineTo(cx + 2, h - 4);
  ctx.lineTo(cx, h - 2);      // tail
  ctx.lineTo(cx - 2, h - 4);
  ctx.lineTo(cx - 3, 8);
  ctx.closePath();
  ctx.fillStyle = boltGrad;
  ctx.fill();

  // -- Center bright line --
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, h - 4);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
}
