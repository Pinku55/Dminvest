import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  // Trend
  emaFast: 50,
  emaSlow: 200,
  useTrend: true,
  useStruct: true,

  // Structure
  pivotLen: 5,
  structLookback: 8,
  useBOS: true,
  useOB: true,
  obLookback: 15,

  // Signal engine
  signalMode: "Confluence",
  minConf: 4,

  // FVG
  useFVG: true,
  fvgMinAtr: 0.25,

  // Liquidity
  useLiq: true,
  eqTolAtr: 0.1,

  // Premium / Discount
  usePD: true,
  pdLen: 50,

  // HTF
  useHTF: true,
  htfFactor: 4,

  // Momentum
  useMom: true,
  rsiLen: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSig: 9,
  cciLen: 20,
  momLen: 10,
  momMin: 2,

  // Volume
  useVol: true,
  volLen: 20,
  volMult: 1.3,

  // Volatility
  atrLen: 14,
  atrAvgLen: 50,
  useVola: true,
  atrLo: 0.6,
  atrHi: 3.0,

  // Sideways filter
  useRange: true,
  rangeMin: 3,
  adxLen: 14,
  adxMin: 22,
  chopLen: 14,
  chopMax: 55,
  bbLen: 20,
  bbMult: 2.0,
  bbwMin: 2.0,
  dcLen: 20,
  dcwMin: 1.5,
  atrComp: 0.8,
  flatLen: 5,
  flatMin: 0.05,

  // Stop loss
  slMethod: "ATR",
  slAtr: 1.5,
  slPct: 1.0,
  slBufAtr: 0.2,

  // Take profit
  tpMethod: "Risk Reward",
  rr: 2.0,
  tpAtr: 3.0,
  tpPct: 2.0,
};

// Symbols available in the quick selector (Binance spot tickers).
export const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
];

// Supported chart intervals (Binance kline intervals).
export const INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w"];

export const DEFAULT_SYMBOL = "BTCUSDT";
export const DEFAULT_INTERVAL = "1h";
export const DEFAULT_LIMIT = 500;
