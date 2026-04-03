/** Generates a Tank enemy sprite (purple, large hexagonal heavy) */
export function generateTankSprite(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // -- Outer glow --
  ctx.save();
  ctx.shadowColor = '#aa44ff';
  ctx.shadowBlur = 15;

  // -- Main body (hexagonal heavy armor) --
  const hexR = 36;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + hexR * Math.cos(angle);
    const y = cy + hexR * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const hullGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hexR);
  hullGrad.addColorStop(0, '#8844cc');
  hullGrad.addColorStop(0.6, '#6622aa');
  hullGrad.addColorStop(1, '#331166');
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.strokeStyle = '#bb66ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // -- Inner hexagon (armor plating detail) --
  ctx.beginPath();
  const innerR = 22;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + innerR * Math.cos(angle);
    const y = cy + innerR * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(170, 100, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // -- Central core (glowing orb) --
  const coreGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.3, '#dd88ff');
  coreGrad.addColorStop(1, '#6622aa');
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // -- Armor panel lines --
  ctx.strokeStyle = 'rgba(170, 100, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + 12 * Math.cos(angle), cy + 12 * Math.sin(angle));
    ctx.lineTo(cx + hexR * Math.cos(angle), cy + hexR * Math.sin(angle));
    ctx.stroke();
  }

  // -- Turret nubs at each corner --
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + (hexR - 4) * Math.cos(angle);
    const y = cy + (hexR - 4) * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#9955dd';
    ctx.fill();
    ctx.strokeStyle = '#bb77ff';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  return canvas;
}
