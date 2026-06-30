// ============================================================================
// Binance public REST data source (CORS-enabled, no API key required).
// Runs entirely in the browser — no Node.js backend involved.
// ============================================================================
import type { Candle } from "../types";

const BASE = "https://api.binance.com/api/v3/klines";

type RawKline = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  ...unknown[],
];

export async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
    interval,
  )}&limit=${Math.min(1000, Math.max(50, limit))}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Binance responded ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as RawKline[];
  if (!Array.isArray(raw)) throw new Error("Unexpected response shape from Binance");

  return raw.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}
