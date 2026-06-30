// ============================================================================
// Synthetic OHLCV generator — used as an offline fallback when the live data
// feed is unreachable, so the tool always has something to render and analyze.
// Produces trending + ranging regimes so SMC signals actually appear.
// ============================================================================
import type { Candle } from "../types";

// Deterministic PRNG (mulberry32) so demo data is reproducible per seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemo(count: number, intervalMs: number, seed = 7): Candle[] {
  const rnd = mulberry32(seed);
  const candles: Candle[] = [];
  let price = 30000;
  let drift = 0;
  let regimeLeft = 0;
  const now = Date.now();
  const start = now - count * intervalMs;

  for (let i = 0; i < count; i++) {
    // Switch market regime periodically (trend up / down / range)
    if (regimeLeft <= 0) {
      regimeLeft = 30 + Math.floor(rnd() * 70);
      const roll = rnd();
      drift = roll < 0.4 ? 0.0016 : roll < 0.8 ? -0.0016 : 0;
    }
    regimeLeft--;

    const vol = 0.004 + rnd() * 0.006;
    const ret = drift + (rnd() - 0.5) * vol * 2;
    const open = price;
    let close = open * (1 + ret);
    const wick = open * vol;
    const high = Math.max(open, close) + rnd() * wick;
    const low = Math.min(open, close) - rnd() * wick;
    const volume = 100 + rnd() * 900 * (1 + Math.abs(ret) * 40);

    candles.push({
      time: start + i * intervalMs,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};

export function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 3_600_000;
}
