// Draws a downloadable PNG badge onto a <canvas> when a user passes a quiz
// level. A flat 2D circular seal, styled like a corporate certification badge:
// scalloped metallic rim, lettering around the ring, and the level number,
// title and recipient in the centre. The background is transparent, so the PNG
// works as a sticker on any page or profile. Plain canvas 2D API, no
// dependencies.

export interface BadgeOptions {
  name: string;
  levelOrder: number;
  levelTitle: string;
  dateEarned: string; // already formatted, e.g. "20 Sep 2026"
}

const SIZE = 1000;
const C = SIZE / 2;

interface Tier {
  name: string;
  light: string;
  mid: string;
  dark: string;
}

// One metal per quiz level, so higher levels look visibly more prestigious.
const TIERS: Tier[] = [
  { name: "BRONZE", light: "#f6d2ae", mid: "#cd8a4b", dark: "#7d4a22" },
  { name: "SILVER", light: "#ffffff", mid: "#c3c9d3", dark: "#737d8c" },
  { name: "GOLD", light: "#fff2bd", mid: "#e8b567", dark: "#9c6a1a" },
  { name: "PLATINUM", light: "#f2fbff", mid: "#a6c8de", dark: "#587a94" },
  { name: "DIAMOND", light: "#e6f7ff", mid: "#7fb2ff", dark: "#4a3fb0" },
  { name: "OBSIDIAN", light: "#e3d8ff", mid: "#8a63d9", dark: "#241a3d" },
];

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Small "verified by Amy" accent chip, drawn once in the empty gap below the
// tagline. Decorative only -- the level number/tier stays the badge's focal
// point, this is just a wink in the corner. Cached across calls so repeat
// badges (different levels/names in the same session) don't re-fetch it.
const MASCOT_SRC = "/mascot-seal.png";
let mascotImg: HTMLImageElement | null = null;
let mascotLoad: Promise<HTMLImageElement> | null = null;

function loadMascot(): Promise<HTMLImageElement> {
  if (mascotImg && mascotImg.complete && mascotImg.naturalWidth > 0) return Promise.resolve(mascotImg);
  if (mascotLoad) return mascotLoad;
  mascotLoad = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      mascotImg = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = MASCOT_SRC;
  });
  return mascotLoad;
}

function paintMascotChip(ctx: CanvasRenderingContext2D, tier: Tier, img: HTMLImageElement) {
  const cx = C;
  const cy = 758;
  const r = 46;
  ctx.save();
  // soft backing disc so the chip reads clearly against the centre disc
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  // thin metal ring so it reads as a stamped accent, not a sticker
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = tier.mid;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function metal(ctx: CanvasRenderingContext2D, t: Tier, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, t.light);
  g.addColorStop(0.28, t.mid);
  g.addColorStop(0.5, t.dark);
  g.addColorStop(0.72, t.mid);
  g.addColorStop(1, t.light);
  return g;
}

function circle(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.arc(C, C, r, 0, Math.PI * 2);
}

// A circle with a gently scalloped edge, like an embossed seal.
function scallopedPath(ctx: CanvasRenderingContext2D, radius: number, bumps: number, depth: number) {
  ctx.beginPath();
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = radius + depth * Math.cos(a * bumps);
    const x = C + Math.cos(a) * r;
    const y = C + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Text laid along a circle. Top text reads clockwise with letter tops facing
// outward; bottom text reads left-to-right with letter tops facing the centre.
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  radius: number,
  position: "top" | "bottom",
  spacing: number
) {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  const span = total / radius;
  const dir = position === "top" ? 1 : -1;
  let angle = position === "top" ? -Math.PI / 2 - span / 2 : Math.PI / 2 + span / 2;

  chars.forEach((ch, i) => {
    const half = widths[i] / 2 / radius;
    angle += dir * half;
    ctx.save();
    ctx.translate(C + Math.cos(angle) * radius, C + Math.sin(angle) * radius);
    ctx.rotate(angle + (position === "top" ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += dir * half;
  });
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, maxPx: number, minPx: number, maxWidth: number) {
  let px = maxPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 1;
  }
  ctx.font = `${weight} ${px}px ${FONT}`;
}

export function drawBadge(canvas: HTMLCanvasElement, opts: BadgeOptions) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, SIZE, SIZE);

  const tier = TIERS[Math.min(Math.max(opts.levelOrder, 1), TIERS.length) - 1];

  // 1. Scalloped metal seal with a soft drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  scallopedPath(ctx, 440, 48, 7);
  ctx.fillStyle = metal(ctx, tier, 120, 90, 880, 910);
  ctx.fill();
  ctx.restore();

  // fine edge lines on the seal
  scallopedPath(ctx, 440, 48, 7);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, 420);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Lettering band
  circle(ctx, 412);
  const band = ctx.createRadialGradient(C, C - 120, 60, C, C, 412);
  band.addColorStop(0, "#1d2c4a");
  band.addColorStop(1, "#0b1424");
  ctx.fillStyle = band;
  ctx.fill();

  // 3. Metal divider ring between the band and the centre disc
  circle(ctx, 318);
  ctx.strokeStyle = metal(ctx, tier, 200, 180, 800, 820);
  ctx.lineWidth = 14;
  ctx.stroke();
  circle(ctx, 326);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  circle(ctx, 310);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 4. Centre disc
  circle(ctx, 304);
  const disc = ctx.createRadialGradient(C, C - 140, 30, C, C, 304);
  disc.addColorStop(0, "#26395f");
  disc.addColorStop(1, "#0f1a30");
  ctx.fillStyle = disc;
  ctx.fill();

  // soft top gloss
  ctx.save();
  circle(ctx, 304);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, C - 304, 0, C);
  gloss.addColorStop(0, "rgba(255,255,255,0.14)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(C - 304, C - 304, 608, 304);
  ctx.restore();

  circle(ctx, 286);
  ctx.strokeStyle = tier.mid;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 5. Lettering around the ring
  ctx.fillStyle = tier.light;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 33px ${FONT}`;
  arcText(ctx, "GDS COMMAND TRAINER", 361, "top", 7);
  ctx.font = `600 27px ${FONT}`;
  arcText(ctx, `${tier.name} TIER  \u2022  ${opts.dateEarned.toUpperCase()}`, 361, "bottom", 5);

  // stars separating the two arcs
  ctx.fillStyle = tier.mid;
  star(ctx, C - 361, C, 15, 6.5);
  ctx.fill();
  star(ctx, C + 361, C, 15, 6.5);
  ctx.fill();

  // 6. Centre content
  ctx.fillStyle = tier.light;
  ctx.font = `600 24px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const spaced = "L E V E L";
  ctx.fillText(spaced, C, 292);

  // big level number in metal
  ctx.save();
  ctx.font = `800 180px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  const numFill = ctx.createLinearGradient(0, 330, 0, 470);
  numFill.addColorStop(0, tier.light);
  numFill.addColorStop(1, tier.mid);
  ctx.fillStyle = numFill;
  ctx.fillText(String(opts.levelOrder), C, 396);
  ctx.restore();

  // divider with a centre diamond
  ctx.strokeStyle = tier.mid;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(C - 170, 500);
  ctx.lineTo(C - 18, 500);
  ctx.moveTo(C + 18, 500);
  ctx.lineTo(C + 170, 500);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tier.mid;
  ctx.beginPath();
  ctx.moveTo(C, 490);
  ctx.lineTo(C + 10, 500);
  ctx.lineTo(C, 510);
  ctx.lineTo(C - 10, 500);
  ctx.closePath();
  ctx.fill();

  // level title
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, opts.levelTitle.toUpperCase(), "700", 32, 18, 470);
  ctx.fillText(opts.levelTitle.toUpperCase(), C, 552);

  // recipient
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText("A W A R D E D   T O", C, 606);

  ctx.fillStyle = tier.light;
  const name = (opts.name.trim() || "TRAINEE").toUpperCase();
  fitFont(ctx, name, "700", 46, 20, 440);
  ctx.fillText(name, C, 656);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText("Certified in GDS cryptic entries", C, 702);

  ctx.textAlign = "left";

  // 7. Small mascot accent in the gap below the tagline -- a wink, not the
  // point of the badge. Paint immediately if cached; otherwise paint it in
  // once it loads (the canvas element stays put while the badge is shown).
  if (mascotImg && mascotImg.complete && mascotImg.naturalWidth > 0) {
    paintMascotChip(ctx, tier, mascotImg);
  } else {
    loadMascot()
      .then((img) => paintMascotChip(ctx, tier, img))
      .catch(() => {
        /* decorative only -- badge still works without it */
      });
  }
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
