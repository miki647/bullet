/** Generates a detailed top-down player spaceship sprite (cyan/blue theme) */
export function generatePlayerSprite(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // -- Outer glow --
  ctx.save();
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 15;

  // -- Main hull (elongated diamond/arrow pointing up) --
  ctx.beginPath();
  ctx.moveTo(cx, 12);          // nose
  ctx.lineTo(cx + 18, cy + 10);  // right wing root
  ctx.lineTo(cx + 30, cy + 28);  // right wing tip
  ctx.lineTo(cx + 12, cy + 18);  // right inner
  ctx.lineTo(cx + 8, cy + 38);   // right tail
  ctx.lineTo(cx, cy + 30);       // tail center
  ctx.lineTo(cx - 8, cy + 38);   // left tail
  ctx.lineTo(cx - 12, cy + 18);  // left inner
  ctx.lineTo(cx - 30, cy + 28);  // left wing tip
  ctx.lineTo(cx - 18, cy + 10);  // left wing root
  ctx.closePath();

  // Hull gradient (dark blue center to cyan edges)
  const hullGrad = ctx.createLinearGradient(cx, 12, cx, cy + 38);
  hullGrad.addColorStop(0, '#44eeff');
  hullGrad.addColorStop(0.4, '#0088aa');
  hullGrad.addColorStop(1, '#004466');
  ctx.fillStyle = hullGrad;
  ctx.fill();

  // Hull edge highlight
  ctx.strokeStyle = '#66ffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // -- Cockpit window --
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 5, 10, 0, 0, Math.PI * 2);
  const cockpitGrad = ctx.createRadialGradient(cx, cy - 10, 1, cx, cy - 8, 10);
  cockpitGrad.addColorStop(0, '#ffffff');
  cockpitGrad.addColorStop(0.5, '#88ffff');
  cockpitGrad.addColorStop(1, '#006688');
  ctx.fillStyle = cockpitGrad;
  ctx.fill();

  // -- Center line detail --
  ctx.beginPath();
  ctx.moveTo(cx, 18);
  ctx.lineTo(cx, cy + 28);
  ctx.strokeStyle = 'rgba(100, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // -- Wing accents --
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  // Left wing accent
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 5);
  ctx.lineTo(cx - 26, cy + 24);
  ctx.stroke();
  // Right wing accent
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy + 5);
  ctx.lineTo(cx + 26, cy + 24);
  ctx.stroke();

  // -- Engine glow (bottom) --
  const engineGrad = ctx.createRadialGradient(cx, cy + 36, 0, cx, cy + 36, 12);
  engineGrad.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
  engineGrad.addColorStop(0.5, 'rgba(0, 180, 255, 0.4)');
  engineGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
  ctx.fillStyle = engineGrad;
  ctx.fillRect(cx - 12, cy + 28, 24, 16);

  return canvas;
}
