// ============================================================================
// Shared types for the SMC Pro Scanner
// ============================================================================

export interface Candle {
  time: number; // ms epoch (bar open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalMode = "Confluence" | "Strict";
export type SLMethod = "ATR" | "Swing" | "Order Block" | "Fixed %";
export type TPMethod = "Risk Reward" | "ATR" | "Liquidity" | "Fixed %";
export type Direction = "BUY" | "SELL";

export interface Settings {
  // Trend
  emaFast: number;
  emaSlow: number;
  useTrend: boolean;
  useStruct: boolean;

  // Structure
  pivotLen: number;
  structLookback: number;
  useBOS: boolean;
  useOB: boolean;
  obLookback: number;

  // Signal engine
  signalMode: SignalMode;
  minConf: number;

  // FVG
  useFVG: boolean;
  fvgMinAtr: number;

  // Liquidity
  useLiq: boolean;
  eqTolAtr: number;

  // Premium / Discount
  usePD: boolean;
  pdLen: number;

  // HTF (proxy via longer EMAs)
  useHTF: boolean;
  htfFactor: number;

  // Momentum
  useMom: boolean;
  rsiLen: number;
  macdFast: number;
  macdSlow: number;
  macdSig: number;
  cciLen: number;
  momLen: number;
  momMin: number;

  // Volume
  useVol: boolean;
  volLen: number;
  volMult: number;

  // Volatility
  atrLen: number;
  atrAvgLen: number;
  useVola: boolean;
  atrLo: number;
  atrHi: number;

  // Sideways filter
  useRange: boolean;
  rangeMin: number;
  adxLen: number;
  adxMin: number;
  chopLen: number;
  chopMax: number;
  bbLen: number;
  bbMult: number;
  bbwMin: number;
  dcLen: number;
  dcwMin: number;
  atrComp: number;
  flatLen: number;
  flatMin: number;

  // Stop loss
  slMethod: SLMethod;
  slAtr: number;
  slPct: number;
  slBufAtr: number;

  // Take profit
  tpMethod: TPMethod;
  rr: number;
  tpAtr: number;
  tpPct: number;
}

export interface OrderBlock {
  index: number;
  top: number;
  bottom: number;
  bull: boolean;
  active: boolean;
}

export interface FVGZone {
  index: number;
  top: number;
  bottom: number;
  bull: boolean;
}

export interface Swing {
  index: number;
  price: number;
  type: "H" | "L";
}

export interface StructureEvent {
  index: number;
  bull: boolean;
  choch: boolean;
}

export interface LiquiditySweep {
  index: number;
  bull: boolean; // true = sell-side grab (bullish), false = buy-side grab (bearish)
}

export interface TradeSignal {
  index: number;
  time: number;
  dir: Direction;
  price: number;
  sl: number;
  tp: number;
  score: number;
  rr: number;
  confluences: number;
}

export interface DashboardSnapshot {
  price: number;
  emaBull: boolean;
  emaBear: boolean;
  htfBull: boolean;
  htfBear: boolean;
  msBull: boolean;
  msBear: boolean;
  lastEventBull: boolean | null;
  adx: number;
  adxOk: boolean;
  chop: number;
  chopRanging: boolean;
  atr: number;
  atrRatio: number;
  volaOk: boolean;
  rangeScore: number;
  isSideways: boolean;
  momText: string;
  momBull: boolean;
  momBear: boolean;
  relVol: number;
  volSpike: boolean;
  hasVol: boolean;
  zone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
  buyCount: number;
  sellCount: number;
  enabledCount: number;
  confNeed: number;
  signal: Direction | "WAIT";
  score: number;
  sl: number | null;
  tp: number | null;
  rr: number | null;
}

export interface EngineResult {
  candles: Candle[];
  emaFast: number[];
  emaSlow: number[];
  equilibrium: number[];
  orderBlocks: OrderBlock[];
  fvgs: FVGZone[];
  swings: Swing[];
  structureEvents: StructureEvent[];
  sweeps: LiquiditySweep[];
  signals: TradeSignal[];
  snapshot: DashboardSnapshot;
}
