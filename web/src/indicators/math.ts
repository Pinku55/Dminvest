// ============================================================================
// Array-based rolling math helpers. Each returns an array aligned to the input
// length, with NaN during the warm-up period. Pure, allocation-light functions.
// ============================================================================

export function fillNaN(n: number): number[] {
  return new Array<number>(n).fill(Number.NaN);
}

/** Simple moving average. */
export function sma(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  if (len <= 0) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (i >= len) sum -= values[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
}

/** Exponential moving average (seeded with the first valid value). */
export function ema(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  if (len <= 0) return out;
  const k = 2 / (len + 1);
  let prev = Number.NaN;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (Number.isNaN(v)) {
      out[i] = prev;
      continue;
    }
    prev = Number.isNaN(prev) ? v : v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's smoothing (RMA / SMMA). */
export function rma(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  if (len <= 0) return out;
  const a = 1 / len;
  let prev = Number.NaN;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (Number.isNaN(v)) {
      out[i] = prev;
      continue;
    }
    prev = Number.isNaN(prev) ? v : a * v + (1 - a) * prev;
    out[i] = prev;
  }
  return out;
}

/** Population standard deviation over a rolling window. */
export function stdev(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  if (len <= 0) return out;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    sum += v;
    sumSq += v * v;
    if (i >= len) {
      const old = values[i - len];
      sum -= old;
      sumSq -= old * old;
    }
    if (i >= len - 1) {
      const mean = sum / len;
      const variance = Math.max(0, sumSq / len - mean * mean);
      out[i] = Math.sqrt(variance);
    }
  }
  return out;
}

/** Rolling highest value over `len` bars. */
export function highest(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (i < len - 1) continue;
    let hi = -Infinity;
    for (let j = i - len + 1; j <= i; j++) hi = Math.max(hi, values[j]);
    out[i] = hi;
  }
  return out;
}

/** Rolling lowest value over `len` bars. */
export function lowest(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  for (let i = 0; i < n; i++) {
    if (i < len - 1) continue;
    let lo = Infinity;
    for (let j = i - len + 1; j <= i; j++) lo = Math.min(lo, values[j]);
    out[i] = lo;
  }
  return out;
}

/** Rolling sum over `len` bars. */
export function rollingSum(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  if (len <= 0) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (i >= len) sum -= values[i - len];
    if (i >= len - 1) out[i] = sum;
  }
  return out;
}

/** values[i] - values[i - len]. */
export function change(values: number[], len: number): number[] {
  const n = values.length;
  const out = fillNaN(n);
  for (let i = len; i < n; i++) out[i] = values[i] - values[i - len];
  return out;
}

export function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
