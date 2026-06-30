// ============================================================================
// Zero-dependency canvas candlestick chart with SMC overlays:
// EMA lines, equilibrium, order blocks, FVG zones, swing points, BUY/SELL
// markers and SL/TP lines for the latest signal.
// ============================================================================
import type { EngineResult } from "../types";

const COLORS = {
  bg: "#0a0e14",
  grid: "rgba(255,255,255,0.05)",
  axis: "#8b97a7",
  up: "#00e676",
  down: "#ff5252",
  wickUp: "rgba(0,230,118,0.8)",
  wickDown: "rgba(255,82,82,0.8)",
  emaFast: "#42a5f5",
  emaSlow: "#ffb300",
  eq: "rgba(144,164,174,0.55)",
  obBull: "rgba(0,230,118,0.13)",
  obBear: "rgba(255,82,82,0.13)",
  fvgBull: "rgba(0,230,118,0.10)",
  fvgBear: "rgba(255,82,82,0.10)",
  sl: "#ff5252",
  tp: "#00e676",
};

const PAD = { top: 14, right: 64, bottom: 22, left: 8 };

export function renderChart(canvas: HTMLCanvasElement, result: EngineResult): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 800;
  const cssH = canvas.clientHeight || 440;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, cssW, cssH);

  const candles = result.candles;
  const n = candles.length;
  if (n === 0) return;

  const plotW = cssW - PAD.left - PAD.right;
  const plotH = cssH - PAD.top - PAD.bottom;

  // Price bounds (include EMAs, equilibrium, latest SL/TP)
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    min = Math.min(min, candles[i].low);
    max = Math.max(max, candles[i].high);
    const es = result.emaSlow[i];
    const ef = result.emaFast[i];
    if (!Number.isNaN(es)) {
      min = Math.min(min, es);
      max = Math.max(max, es);
    }
    if (!Number.isNaN(ef)) {
      min = Math.min(min, ef);
      max = Math.max(max, ef);
    }
  }
  const lastSig = result.signals.length ? result.signals[result.signals.length - 1] : null;
  if (lastSig && lastSig.index >= n - 60) {
    min = Math.min(min, lastSig.sl, lastSig.tp);
    max = Math.max(max, lastSig.sl, lastSig.tp);
  }
  if (!isFinite(min) || !isFinite(max) || min === max) {
    min = candles[0].low * 0.99;
    max = candles[0].high * 1.01;
  }
  const range = max - min;
  min -= range * 0.04;
  max += range * 0.04;

  const xOf = (i: number): number => PAD.left + (plotW * (i + 0.5)) / n;
  const yOf = (p: number): number => PAD.top + plotH * (1 - (p - min) / (max - min));
  const candleW = Math.max(1, (plotW / n) * 0.7);

  // ---- Grid + price axis ----------------------------------------------------
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  const ticks = 6;
  for (let t = 0; t <= ticks; t++) {
    const p = min + ((max - min) * t) / ticks;
    const y = yOf(p);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.axis;
    ctx.textAlign = "left";
    ctx.fillText(fmtPrice(p), PAD.left + plotW + 6, y);
  }

  // ---- Time axis labels -----------------------------------------------------
  ctx.textAlign = "center";
  const labelEvery = Math.ceil(n / 8);
  for (let i = 0; i < n; i += labelEvery) {
    const x = xOf(i);
    ctx.fillStyle = COLORS.axis;
    ctx.fillText(fmtTime(candles[i].time), x, cssH - PAD.bottom + 11);
  }

  // ---- Order block boxes (recent, drawn behind) -----------------------------
  const obs = result.orderBlocks.slice(-12);
  for (const ob of obs) {
    if (ob.index >= n) continue;
    const x0 = xOf(ob.index);
    const x1 = PAD.left + plotW;
    const yTop = yOf(ob.top);
    const yBot = yOf(ob.bottom);
    ctx.fillStyle = ob.bull ? COLORS.obBull : COLORS.obBear;
    ctx.fillRect(x0, yTop, Math.max(2, x1 - x0), Math.max(1, yBot - yTop));
  }

  // ---- FVG zones ------------------------------------------------------------
  const fvgs = result.fvgs.slice(-16);
  for (const f of fvgs) {
    if (f.index >= n) continue;
    const x0 = xOf(f.index);
    const x1 = Math.min(PAD.left + plotW, xOf(Math.min(n - 1, f.index + 8)));
    const yTop = yOf(f.top);
    const yBot = yOf(f.bottom);
    ctx.fillStyle = f.bull ? COLORS.fvgBull : COLORS.fvgBear;
    ctx.fillRect(x0, yTop, Math.max(2, x1 - x0), Math.max(1, yBot - yTop));
  }

  // ---- Equilibrium (premium/discount midline) -------------------------------
  drawLine(ctx, result.equilibrium, xOf, yOf, n, COLORS.eq, 1, true);

  // ---- Candles --------------------------------------------------------------
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = xOf(i);
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? COLORS.wickUp : COLORS.wickDown;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yOf(c.high));
    ctx.lineTo(x, yOf(c.low));
    ctx.stroke();

    const yO = yOf(c.open);
    const yC = yOf(c.close);
    ctx.fillStyle = up ? COLORS.up : COLORS.down;
    const top = Math.min(yO, yC);
    const h = Math.max(1, Math.abs(yC - yO));
    ctx.fillRect(x - candleW / 2, top, candleW, h);
  }

  // ---- EMA lines ------------------------------------------------------------
  drawLine(ctx, result.emaFast, xOf, yOf, n, COLORS.emaFast, 1.4, false);
  drawLine(ctx, result.emaSlow, xOf, yOf, n, COLORS.emaSlow, 1.8, false);

  // ---- Swing points ---------------------------------------------------------
  for (const sw of result.swings) {
    if (sw.index >= n) continue;
    const x = xOf(sw.index);
    const y = yOf(sw.price);
    ctx.fillStyle = sw.type === "H" ? "rgba(255,179,0,0.9)" : "rgba(66,165,245,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Signal markers -------------------------------------------------------
  for (const sig of result.signals) {
    if (sig.index >= n) continue;
    const x = xOf(sig.index);
    if (sig.dir === "BUY") {
      const y = yOf(candles[sig.index].low) + 12;
      drawTriangle(ctx, x, y, 6, true, COLORS.up);
    } else {
      const y = yOf(candles[sig.index].high) - 12;
      drawTriangle(ctx, x, y, 6, false, COLORS.down);
    }
  }

  // ---- Latest signal SL / TP lines ------------------------------------------
  if (lastSig && lastSig.index >= n - 80) {
    dashLine(ctx, PAD.left, xOf(lastSig.index), yOf(lastSig.sl), COLORS.sl, "SL");
    dashLine(ctx, PAD.left, xOf(lastSig.index), yOf(lastSig.tp), COLORS.tp, "TP");
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  data: number[],
  xOf: (i: number) => number,
  yOf: (p: number) => number,
  n: number,
  color: string,
  width: number,
  dashed: boolean,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [4, 4] : []);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (Number.isNaN(v)) {
      started = false;
      continue;
    }
    const x = xOf(i);
    const y = yOf(v);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  up: boolean,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x + size, y + size);
  } else {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
  }
  ctx.closePath();
  ctx.fill();
}

function dashLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y: number,
  color: string,
  label: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, x0 + 2, y - 5);
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toFixed(0);
  if (p >= 1) return p.toFixed(2);
  return p.toPrecision(4);
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
