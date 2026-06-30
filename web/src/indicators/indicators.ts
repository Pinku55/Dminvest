// ============================================================================
// Technical indicators built on the rolling math helpers. All return arrays
// aligned to the candle series, NaN during warm-up. Fully causal (no lookahead).
// ============================================================================
import type { Candle } from "../types";
import { ema, rma, sma, stdev, highest, lowest, rollingSum, change, fillNaN } from "./math";

export interface MacdResult {
  macd: number[];
  signal: number[];
  hist: number[];
}

/** True Range series. */
export function trueRange(c: Candle[]): number[] {
  const n = c.length;
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out[i] = c[i].high - c[i].low;
      continue;
    }
    const pc = c[i - 1].close;
    out[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - pc), Math.abs(c[i].low - pc));
  }
  return out;
}

/** Average True Range (Wilder). */
export function atr(c: Candle[], len: number): number[] {
  return rma(trueRange(c), len);
}

/** Relative Strength Index. */
export function rsi(closes: number[], len: number): number[] {
  const n = closes.length;
  const gains = fillNaN(n);
  const losses = fillNaN(n);
  gains[0] = 0;
  losses[0] = 0;
  for (let i = 1; i < n; i++) {
    const ch = closes[i] - closes[i - 1];
    gains[i] = ch > 0 ? ch : 0;
    losses[i] = ch < 0 ? -ch : 0;
  }
  const avgGain = rma(gains, len);
  const avgLoss = rma(losses, len);
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (Number.isNaN(g) || Number.isNaN(l)) continue;
    if (l === 0) {
      out[i] = 100;
    } else {
      const rs = g / l;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/** MACD line / signal / histogram. */
export function macd(closes: number[], fast: number, slow: number, sig: number): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const n = closes.length;
  const macdLine = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(emaFast[i]) && !Number.isNaN(emaSlow[i])) macdLine[i] = emaFast[i] - emaSlow[i];
  }
  const signal = ema(macdLine, sig);
  const hist = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(macdLine[i]) && !Number.isNaN(signal[i])) hist[i] = macdLine[i] - signal[i];
  }
  return { macd: macdLine, signal, hist };
}

/** Commodity Channel Index. */
export function cci(c: Candle[], len: number): number[] {
  const n = c.length;
  const tp = new Array<number>(n);
  for (let i = 0; i < n; i++) tp[i] = (c[i].high + c[i].low + c[i].close) / 3;
  const tpSma = sma(tp, len);
  const out = fillNaN(n);
  for (let i = len - 1; i < n; i++) {
    let dev = 0;
    for (let j = i - len + 1; j <= i; j++) dev += Math.abs(tp[j] - tpSma[i]);
    const meanDev = dev / len;
    out[i] = meanDev === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * meanDev);
  }
  return out;
}

/** Momentum: close - close[len]. */
export function momentum(closes: number[], len: number): number[] {
  return change(closes, len);
}

/** Average Directional Index (manual DMI). */
export function adx(c: Candle[], len: number): number[] {
  const n = c.length;
  const plusDM = fillNaN(n);
  const minusDM = fillNaN(n);
  plusDM[0] = 0;
  minusDM[0] = 0;
  for (let i = 1; i < n; i++) {
    const up = c[i].high - c[i - 1].high;
    const dn = c[i - 1].low - c[i].low;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }
  const trRma = rma(trueRange(c), len);
  const plusRma = rma(plusDM, len);
  const minusRma = rma(minusDM, len);
  const dx = fillNaN(n);
  for (let i = 0; i < n; i++) {
    const tr = trRma[i];
    if (Number.isNaN(tr) || tr === 0) continue;
    const pdi = (100 * plusRma[i]) / tr;
    const mdi = (100 * minusRma[i]) / tr;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
  }
  return rma(dx, len);
}

/** Choppiness Index (>~55 ranging, <~38 trending). */
export function choppiness(c: Candle[], len: number): number[] {
  const n = c.length;
  const highs = c.map((x) => x.high);
  const lows = c.map((x) => x.low);
  const trSum = rollingSum(trueRange(c), len);
  const hh = highest(highs, len);
  const ll = lowest(lows, len);
  const out = fillNaN(n);
  const logLen = Math.log10(len);
  for (let i = 0; i < n; i++) {
    const range = hh[i] - ll[i];
    if (Number.isNaN(trSum[i]) || Number.isNaN(range) || range <= 0) continue;
    out[i] = (100 * Math.log10(trSum[i] / range)) / logLen;
  }
  return out;
}

/** Bollinger Band width as a percentage of the basis. */
export function bollingerWidth(closes: number[], len: number, mult: number): number[] {
  const basis = sma(closes, len);
  const dev = stdev(closes, len);
  const n = closes.length;
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(basis[i]) || basis[i] === 0) continue;
    out[i] = ((2 * mult * dev[i]) / basis[i]) * 100;
  }
  return out;
}

/** Donchian channel width as a percentage of price. */
export function donchianWidth(c: Candle[], len: number): number[] {
  const n = c.length;
  const highs = c.map((x) => x.high);
  const lows = c.map((x) => x.low);
  const hh = highest(highs, len);
  const ll = lowest(lows, len);
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    const close = c[i].close;
    if (Number.isNaN(hh[i]) || close === 0) continue;
    out[i] = ((hh[i] - ll[i]) / close) * 100;
  }
  return out;
}

/** On-Balance Volume. */
export function obv(c: Candle[]): number[] {
  const n = c.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dir = Math.sign(c[i].close - c[i - 1].close);
    out[i] = out[i - 1] + dir * c[i].volume;
  }
  return out;
}
