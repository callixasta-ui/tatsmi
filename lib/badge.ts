// Draws a downloadable PNG badge onto a <canvas>, rewarded when a user
// passes a quiz level. Kept dependency-free (plain canvas 2D API) so it
// works the same in the browser as everything else in this app.

export interface BadgeOptions {
  name: string;
  levelOrder: number;
  levelTitle: string;
  dateEarned: string; // already formatted, e.g. "20 Sep 2026"
}

const W = 1000;
const H = 640;

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawBadge(canvas: HTMLCanvasElement, opts: BadgeOptions) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = "#1a1d21";
  const panel = "#21252b";
  const border = "#33383f";
  const accent = "#e8b567";
  const fg = "#e4ddc9";
  const fgDim = "#9aa0a6";
  const success = "#8fbf8f";

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // outer panel
  const pad = 28;
  ctx.fillStyle = panel;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 14);
  ctx.fill();
  ctx.stroke();

  // inner hairline border
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 14, pad + 14, W - (pad + 14) * 2, H - (pad + 14) * 2, 10);
  ctx.stroke();

  // corner ticks, four corners, for a printed-certificate feel
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const tick = 26;
  const corners: [number, number, number, number][] = [
    [pad + 14, pad + 14, 1, 1],
    [W - pad - 14, pad + 14, -1, 1],
    [pad + 14, H - pad - 14, 1, -1],
    [W - pad - 14, H - pad - 14, -1, -1],
  ];
  corners.forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + tick * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + tick * dx, y);
    ctx.stroke();
  });

  // header
  ctx.fillStyle = fgDim;
  ctx.font = "600 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.letterSpacing = "3px";
  ctx.fillText("GDS COMMAND TRAINER", W / 2, 96);
  ctx.letterSpacing = "0px";

  // star badge icon
  const starCx = W / 2;
  const starCy = 190;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = "rgba(232,181,103,0.35)";
  ctx.shadowBlur = 18;
  drawStar(ctx, starCx, starCy, 58, 26, 5);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = bg;
  ctx.font = "700 40px 'Courier New', monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(String(opts.levelOrder), starCx, starCy + 2);
  ctx.textBaseline = "alphabetic";

  // "LEVEL N BADGE"
  ctx.fillStyle = accent;
  ctx.font = "700 26px 'Courier New', monospace";
  ctx.fillText(`LEVEL ${opts.levelOrder} BADGE`, W / 2, 288);

  // level title
  ctx.fillStyle = fg;
  ctx.font = "500 20px 'Courier New', monospace";
  ctx.fillText(opts.levelTitle.toUpperCase(), W / 2, 322);

  // divider
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 160, 356);
  ctx.lineTo(W / 2 + 160, 356);
  ctx.stroke();

  // "awarded to"
  ctx.fillStyle = fgDim;
  ctx.font = "12px 'Courier New', monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText("AWARDED TO", W / 2, 394);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = success;
  ctx.font = "700 34px 'Courier New', monospace";
  const name = opts.name.trim() || "TRAINEE";
  ctx.fillText(name.toUpperCase(), W / 2, 440);

  // date
  ctx.fillStyle = fgDim;
  ctx.font = "13px 'Courier New', monospace";
  ctx.fillText(`Passed the quiz on ${opts.dateEarned}`, W / 2, 480);

  // footer note
  ctx.fillStyle = fgDim;
  ctx.font = "11px 'Courier New', monospace";
  ctx.fillText("SIMULATED TRAINING ENVIRONMENT \u2014 NOT CONNECTED TO ANY LIVE GDS", W / 2, H - 52);

  ctx.textAlign = "left";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}
