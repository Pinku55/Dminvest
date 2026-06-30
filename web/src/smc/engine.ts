// ============================================================================
// SMC ENGINE
// Sequential, fully-causal (non-repainting) pass over the candle series.
// Ports the fixed Pine v6 strategy logic: market structure (BOS/CHoCH),
// order blocks, FVG, liquidity sweeps, premium/discount, sideways filter,
// HTF bias, momentum/volume confirmation and the confluence signal engine.
// ============================================================================
import type {
  Candle,
  Settings,
  EngineResult,
  OrderBlock,
  FVGZone,
  Swing,
  StructureEvent,
  LiquiditySweep,
  TradeSignal,
  DashboardSnapshot,
  Direction,
} from "../types";
import { ema, sma, highest, lowest } from "../indicators/math";
import {
  atr as atrFn,
  rsi as rsiFn,
  macd as macdFn,
  cci as cciFn,
  momentum as momFn,
  adx as adxFn,
  choppiness as chopFn,
  bollingerWidth,
  donchianWidth,
  obv as obvFn,
} from "../indicators/indicators";

const BIG = 1e9;

export function analyze(candles: Candle[], s: Settings): EngineResult {
  const n = candles.length;
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const opens = candles.map((c) => c.open);
  const vols = candles.map((c) => c.volume);

  // ---- Indicator arrays -----------------------------------------------------
  const emaFast = ema(closes, s.emaFast);
  const emaSlow = ema(closes, s.emaSlow);
  const htfFast = ema(closes, s.emaFast * s.htfFactor);
  const htfSlow = ema(closes, s.emaSlow * s.htfFactor);
  const atr = atrFn(candles, s.atrLen);
  const atrAvg = sma(atr, s.atrAvgLen);
  const rsi = rsiFn(closes, s.rsiLen);
  const mac = macdFn(closes, s.macdFast, s.macdSlow, s.macdSig);
  const cci = cciFn(candles, s.cciLen);
  const mom = momFn(closes, s.momLen);
  const adx = adxFn(candles, s.adxLen);
  const chop = chopFn(candles, s.chopLen);
  const bbw = bollingerWidth(closes, s.bbLen, s.bbMult);
  const dcw = donchianWidth(candles, s.dcLen);
  const obv = obvFn(candles);
  const obvEma = ema(obv, s.volLen);
  const volSma = sma(vols, s.volLen);
  const rangeHi = highest(highs, s.pdLen);
  const rangeLo = lowest(lows, s.pdLen);

  // ---- Pivots (left = right = pivotLen, confirmed pivotLen bars later) ------
  const L = s.pivotLen;
  const confHighVal = new Array<number>(n).fill(Number.NaN);
  const confHighBar = new Array<number>(n).fill(-1);
  const confLowVal = new Array<number>(n).fill(Number.NaN);
  const confLowBar = new Array<number>(n).fill(-1);
  for (let j = L; j < n - L; j++) {
    let isHigh = true;
    let isLow = true;
    for (let k = j - L; k <= j + L; k++) {
      if (k === j) continue;
      if (highs[k] >= highs[j]) isHigh = false;
      if (lows[k] <= lows[j]) isLow = false;
    }
    if (isHigh) {
      confHighVal[j + L] = highs[j];
      confHighBar[j + L] = j;
    }
    if (isLow) {
      confLowVal[j + L] = lows[j];
      confLowBar[j + L] = j;
    }
  }

  // ---- Outputs --------------------------------------------------------------
  const equilibrium = new Array<number>(n).fill(Number.NaN);
  const orderBlocks: OrderBlock[] = [];
  const fvgs: FVGZone[] = [];
  const swings: Swing[] = [];
  const structureEvents: StructureEvent[] = [];
  const sweeps: LiquiditySweep[] = [];
  const signals: TradeSignal[] = [];

  // ---- State ----------------------------------------------------------------
  let lastSH = Number.NaN;
  let prevSH = Number.NaN;
  let lastSL = Number.NaN;
  let prevSL = Number.NaN;

  let bullOB: OrderBlock | null = null;
  let bearOB: OrderBlock | null = null;

  let barsBosBull = BIG;
  let barsBosBear = BIG;
  let barsSweepBull = BIG;
  let barsSweepBear = BIG;
  let barsFvgBull = BIG;
  let barsFvgBear = BIG;

  let lastSignalBar = -BIG;
  const cooldown = Math.max(2, s.pivotLen);

  const hasVolData = vols.some((v) => v > 0);

  // Snapshot values captured on the final bar
  let snap: DashboardSnapshot | null = null;

  for (let i = 0; i < n; i++) {
    // Update confirmed swings as their confirmation bar is reached
    if (!Number.isNaN(confHighVal[i])) {
      prevSH = lastSH;
      lastSH = confHighVal[i];
      swings.push({ index: confHighBar[i], price: confHighVal[i], type: "H" });
    }
    if (!Number.isNaN(confLowVal[i])) {
      prevSL = lastSL;
      lastSL = confLowVal[i];
      swings.push({ index: confLowBar[i], price: confLowVal[i], type: "L" });
    }

    // age counters
    barsBosBull++;
    barsBosBear++;
    barsSweepBull++;
    barsSweepBear++;
    barsFvgBull++;
    barsFvgBear++;

    const close = closes[i];
    const prevClose = i > 0 ? closes[i - 1] : close;
    const a = Number.isNaN(atr[i]) ? 0 : atr[i];

    // Market structure
    const hh = !Number.isNaN(lastSH) && !Number.isNaN(prevSH) && lastSH > prevSH;
    const hl = !Number.isNaN(lastSL) && !Number.isNaN(prevSL) && lastSL > prevSL;
    const lh = !Number.isNaN(lastSH) && !Number.isNaN(prevSH) && lastSH < prevSH;
    const ll = !Number.isNaN(lastSL) && !Number.isNaN(prevSL) && lastSL < prevSL;
    const msBull = hh && hl;
    const msBear = lh && ll;

    // Break of structure / change of character
    const bosBull = !Number.isNaN(lastSH) && close > lastSH && prevClose <= lastSH;
    const bosBear = !Number.isNaN(lastSL) && close < lastSL && prevClose >= lastSL;
    const chochBull = bosBull && msBear;
    const chochBear = bosBear && msBull;
    const structBull = bosBull || chochBull;
    const structBear = bosBear || chochBear;

    if (structBull) {
      barsBosBull = 0;
      structureEvents.push({ index: i, bull: true, choch: chochBull });
      // Bullish OB = last down candle before the impulse
      for (let k = 1; k <= s.obLookback && i - k >= 0; k++) {
        if (closes[i - k] < opens[i - k]) {
          bullOB = { index: i - k, top: highs[i - k], bottom: lows[i - k], bull: true, active: true };
          orderBlocks.push(bullOB);
          break;
        }
      }
    }
    if (structBear) {
      barsBosBear = 0;
      structureEvents.push({ index: i, bull: false, choch: chochBear });
      for (let k = 1; k <= s.obLookback && i - k >= 0; k++) {
        if (closes[i - k] > opens[i - k]) {
          bearOB = { index: i - k, top: highs[i - k], bottom: lows[i - k], bull: false, active: true };
          orderBlocks.push(bearOB);
          break;
        }
      }
    }

    // OB invalidation
    if (bullOB && bullOB.active && close < bullOB.bottom) bullOB.active = false;
    if (bearOB && bearOB.active && close > bearOB.top) bearOB.active = false;

    const inBullOB = !!bullOB && bullOB.active && lows[i] <= bullOB.top && highs[i] >= bullOB.bottom;
    const inBearOB = !!bearOB && bearOB.active && highs[i] >= bearOB.bottom && lows[i] <= bearOB.top;

    // Fair Value Gaps (3-candle imbalance using i, i-1, i-2)
    if (s.useFVG && i >= 2) {
      const bullGap = lows[i] - highs[i - 2];
      const bearGap = lows[i - 2] - highs[i];
      if (bullGap > 0 && bullGap >= s.fvgMinAtr * a) {
        fvgs.push({ index: i, top: lows[i], bottom: highs[i - 2], bull: true });
        barsFvgBull = 0;
      }
      if (bearGap > 0 && bearGap >= s.fvgMinAtr * a) {
        fvgs.push({ index: i, top: lows[i - 2], bottom: highs[i], bull: false });
        barsFvgBear = 0;
      }
    }

    // Liquidity sweeps
    const sweepBull = !Number.isNaN(lastSL) && lows[i] < lastSL && close > lastSL; // sell-side grab
    const sweepBear = !Number.isNaN(lastSH) && highs[i] > lastSH && close < lastSH; // buy-side grab
    if (sweepBull) {
      barsSweepBull = 0;
      sweeps.push({ index: i, bull: true });
    }
    if (sweepBear) {
      barsSweepBear = 0;
      sweeps.push({ index: i, bull: false });
    }

    // Premium / discount
    const eq =
      !Number.isNaN(rangeHi[i]) && !Number.isNaN(rangeLo[i]) ? (rangeHi[i] + rangeLo[i]) / 2 : Number.NaN;
    equilibrium[i] = eq;
    const inDiscount = !Number.isNaN(eq) && close <= eq;
    const inPremium = !Number.isNaN(eq) && close >= eq;

    // HTF bias (proxy via longer EMAs — fully causal)
    const htfBull = !Number.isNaN(htfSlow[i]) && htfFast[i] > htfSlow[i] && close > htfSlow[i];
    const htfBear = !Number.isNaN(htfSlow[i]) && htfFast[i] < htfSlow[i] && close < htfSlow[i];

    // Momentum
    const macdBull = mac.macd[i] > mac.signal[i] && mac.hist[i] > 0;
    const macdBear = mac.macd[i] < mac.signal[i] && mac.hist[i] < 0;
    const momBullCnt =
      (rsi[i] > 50 && rsi[i] < 72 ? 1 : 0) + (macdBull ? 1 : 0) + (cci[i] > 0 ? 1 : 0) + (mom[i] > 0 ? 1 : 0);
    const momBearCnt =
      (rsi[i] < 50 && rsi[i] > 28 ? 1 : 0) + (macdBear ? 1 : 0) + (cci[i] < 0 ? 1 : 0) + (mom[i] < 0 ? 1 : 0);

    // Volume (neutral when no volume data)
    const hasVol = hasVolData && !Number.isNaN(volSma[i]) && volSma[i] > 0;
    const relVol = hasVol ? vols[i] / volSma[i] : 1;
    const volSpike = hasVol ? vols[i] >= volSma[i] * s.volMult : true;
    const obvRising = !hasVol || obv[i] > obvEma[i];
    const obvFalling = !hasVol || obv[i] < obvEma[i];

    // Volatility
    const atrRatio = !Number.isNaN(atrAvg[i]) && atrAvg[i] > 0 ? a / atrAvg[i] : 1;
    const volaOk = !s.useVola || (atrRatio >= s.atrLo && atrRatio <= s.atrHi);

    // Sideways detection (6 detectors)
    const emaSlope =
      i >= s.flatLen && !Number.isNaN(emaSlow[i]) && emaSlow[i] !== 0
        ? (Math.abs(emaSlow[i] - emaSlow[i - s.flatLen]) / emaSlow[i]) * 100
        : 100;
    const emaFlat = emaSlope < s.flatMin;
    let rangeScore = 0;
    if (!Number.isNaN(adx[i]) && adx[i] < s.adxMin) rangeScore++;
    if (!Number.isNaN(chop[i]) && chop[i] > s.chopMax) rangeScore++;
    if (!Number.isNaN(bbw[i]) && bbw[i] < s.bbwMin) rangeScore++;
    if (!Number.isNaN(dcw[i]) && dcw[i] < s.dcwMin) rangeScore++;
    if (!Number.isNaN(atrAvg[i]) && a < atrAvg[i] * s.atrComp) rangeScore++;
    if (emaFlat) rangeScore++;
    const isSideways = s.useRange && rangeScore >= s.rangeMin;

    // Confluence confirmations
    const cTrendUp = emaFast[i] > emaSlow[i] && (!s.useStruct || !msBear);
    const cTrendDn = emaFast[i] < emaSlow[i] && (!s.useStruct || !msBull);
    const cBosUp = barsBosBull <= s.structLookback;
    const cBosDn = barsBosBear <= s.structLookback;
    const cObUp = inBullOB || barsFvgBull <= s.structLookback;
    const cObDn = inBearOB || barsFvgBear <= s.structLookback;
    const cLiqUp = barsSweepBull <= s.structLookback;
    const cLiqDn = barsSweepBear <= s.structLookback;
    const cMomUp = momBullCnt >= s.momMin;
    const cMomDn = momBearCnt >= s.momMin;
    const cVolUp = volSpike && obvRising;
    const cVolDn = volSpike && obvFalling;
    const cHtfUp = htfBull;
    const cHtfDn = htfBear;
    const cPdUp = inDiscount;
    const cPdDn = inPremium;

    const on = (b: boolean): number => (b ? 1 : 0);
    const enabledCount =
      on(s.useTrend) +
      on(s.useBOS) +
      on(s.useOB) +
      on(s.useLiq) +
      on(s.useMom) +
      on(s.useVol) +
      on(s.useHTF) +
      on(s.usePD);

    const buyCount =
      on(s.useTrend && cTrendUp) +
      on(s.useBOS && cBosUp) +
      on(s.useOB && cObUp) +
      on(s.useLiq && cLiqUp) +
      on(s.useMom && cMomUp) +
      on(s.useVol && cVolUp) +
      on(s.useHTF && cHtfUp) +
      on(s.usePD && cPdUp);

    const sellCount =
      on(s.useTrend && cTrendDn) +
      on(s.useBOS && cBosDn) +
      on(s.useOB && cObDn) +
      on(s.useLiq && cLiqDn) +
      on(s.useMom && cMomDn) +
      on(s.useVol && cVolDn) +
      on(s.useHTF && cHtfDn) +
      on(s.usePD && cPdDn);

    const confNeed = Math.max(
      1,
      s.signalMode === "Strict" ? enabledCount : Math.min(s.minConf, enabledCount),
    );

    const hardOk = !isSideways && volaOk;
    const dirOkBuy = !s.useTrend || cTrendUp;
    const dirOkSell = !s.useTrend || cTrendDn;

    const buyRaw = enabledCount > 0 && buyCount >= confNeed && dirOkBuy;
    const sellRaw = enabledCount > 0 && sellCount >= confNeed && dirOkSell;

    const buySignal = buyRaw && !sellRaw && hardOk;
    const sellSignal = sellRaw && !buyRaw && hardOk;

    const buyScore =
      on(cTrendUp) * 20 +
      on(cBosUp) * 15 +
      on(cObUp) * 15 +
      on(cLiqUp) * 15 +
      on(cMomUp) * 10 +
      on(cVolUp) * 10 +
      on(cHtfUp) * 10 +
      on(cPdUp) * 5;
    const sellScore =
      on(cTrendDn) * 20 +
      on(cBosDn) * 15 +
      on(cObDn) * 15 +
      on(cLiqDn) * 15 +
      on(cMomDn) * 10 +
      on(cVolDn) * 10 +
      on(cHtfDn) * 10 +
      on(cPdDn) * 5;

    // Emit signals (with cooldown) — only on confirmed bars
    const canFire = i - lastSignalBar >= cooldown && a > 0;
    if (buySignal && canFire) {
      const sl = longSL(close, a, lastSL, bullOB, s);
      const tp = longTP(close, sl, a, rangeHi[i], s);
      signals.push(makeSignal(i, candles[i].time, "BUY", close, sl, tp, buyScore, buyCount));
      lastSignalBar = i;
    } else if (sellSignal && canFire) {
      const sl = shortSL(close, a, lastSH, bearOB, s);
      const tp = shortTP(close, sl, a, rangeLo[i], s);
      signals.push(makeSignal(i, candles[i].time, "SELL", close, sl, tp, sellScore, sellCount));
      lastSignalBar = i;
    }

    // Capture snapshot on the last bar
    if (i === n - 1) {
      const signal: Direction | "WAIT" = buySignal ? "BUY" : sellSignal ? "SELL" : "WAIT";
      let sl: number | null = null;
      let tp: number | null = null;
      if (signal === "BUY") {
        sl = longSL(close, a, lastSL, bullOB, s);
        tp = longTP(close, sl, a, rangeHi[i], s);
      } else if (signal === "SELL") {
        sl = shortSL(close, a, lastSH, bearOB, s);
        tp = shortTP(close, sl, a, rangeLo[i], s);
      }
      const rr = sl !== null && tp !== null && Math.abs(close - sl) > 0
        ? Math.abs(tp - close) / Math.abs(close - sl)
        : null;
      const lastEventBull =
        barsBosBull === BIG && barsBosBear === BIG
          ? null
          : barsBosBull < barsBosBear
            ? true
            : barsBosBear < barsBosBull
              ? false
              : null;
      snap = {
        price: close,
        emaBull: emaFast[i] > emaSlow[i] && close > emaFast[i],
        emaBear: emaFast[i] < emaSlow[i] && close < emaFast[i],
        htfBull,
        htfBear,
        msBull,
        msBear,
        lastEventBull,
        adx: Number.isNaN(adx[i]) ? 0 : adx[i],
        adxOk: !Number.isNaN(adx[i]) && adx[i] >= s.adxMin,
        chop: Number.isNaN(chop[i]) ? 0 : chop[i],
        chopRanging: !Number.isNaN(chop[i]) && chop[i] > s.chopMax,
        atr: a,
        atrRatio,
        volaOk,
        rangeScore,
        isSideways,
        momText: momBullCnt > momBearCnt ? `BULL ${momBullCnt}/4` : momBearCnt > momBullCnt ? `BEAR ${momBearCnt}/4` : "NEUTRAL",
        momBull: cMomUp,
        momBear: cMomDn,
        relVol,
        volSpike,
        hasVol,
        zone: inDiscount && !inPremium ? "DISCOUNT" : inPremium && !inDiscount ? "PREMIUM" : "EQUILIBRIUM",
        buyCount,
        sellCount,
        enabledCount,
        confNeed,
        signal,
        score: signal === "SELL" ? sellScore : buyScore,
        sl,
        tp,
        rr,
      };
    }
  }

  return {
    candles,
    emaFast,
    emaSlow,
    equilibrium,
    orderBlocks,
    fvgs,
    swings,
    structureEvents,
    sweeps,
    signals,
    snapshot: snap ?? emptySnapshot(closes[n - 1] ?? 0),
  };
}

// ---- SL / TP helpers --------------------------------------------------------
function longSL(entry: number, a: number, lastSL: number, bullOB: OrderBlock | null, s: Settings): number {
  let sl: number;
  switch (s.slMethod) {
    case "ATR":
      sl = entry - s.slAtr * a;
      break;
    case "Swing":
      sl = (!Number.isNaN(lastSL) ? lastSL : entry - s.slAtr * a) - s.slBufAtr * a;
      break;
    case "Order Block":
      sl = (bullOB && bullOB.active ? bullOB.bottom : entry - s.slAtr * a) - s.slBufAtr * a;
      break;
    default:
      sl = entry * (1 - s.slPct / 100);
  }
  if (sl >= entry) sl = entry - s.slAtr * a;
  return sl;
}

function shortSL(entry: number, a: number, lastSH: number, bearOB: OrderBlock | null, s: Settings): number {
  let sl: number;
  switch (s.slMethod) {
    case "ATR":
      sl = entry + s.slAtr * a;
      break;
    case "Swing":
      sl = (!Number.isNaN(lastSH) ? lastSH : entry + s.slAtr * a) + s.slBufAtr * a;
      break;
    case "Order Block":
      sl = (bearOB && bearOB.active ? bearOB.top : entry + s.slAtr * a) + s.slBufAtr * a;
      break;
    default:
      sl = entry * (1 + s.slPct / 100);
  }
  if (sl <= entry) sl = entry + s.slAtr * a;
  return sl;
}

function longTP(entry: number, sl: number, a: number, rangeHi: number, s: Settings): number {
  const risk = entry - sl;
  let tp: number;
  switch (s.tpMethod) {
    case "Risk Reward":
      tp = entry + s.rr * risk;
      break;
    case "ATR":
      tp = entry + s.tpAtr * a;
      break;
    case "Liquidity":
      tp = Math.max(Number.isNaN(rangeHi) ? entry + s.rr * risk : rangeHi, entry + s.rr * risk);
      break;
    default:
      tp = entry * (1 + s.tpPct / 100);
  }
  if (tp <= entry) tp = entry + s.rr * risk;
  return tp;
}

function shortTP(entry: number, sl: number, a: number, rangeLo: number, s: Settings): number {
  const risk = sl - entry;
  let tp: number;
  switch (s.tpMethod) {
    case "Risk Reward":
      tp = entry - s.rr * risk;
      break;
    case "ATR":
      tp = entry - s.tpAtr * a;
      break;
    case "Liquidity":
      tp = Math.min(Number.isNaN(rangeLo) ? entry - s.rr * risk : rangeLo, entry - s.rr * risk);
      break;
    default:
      tp = entry * (1 - s.tpPct / 100);
  }
  if (tp >= entry) tp = entry - s.rr * risk;
  return tp;
}

function makeSignal(
  index: number,
  time: number,
  dir: Direction,
  price: number,
  sl: number,
  tp: number,
  score: number,
  confluences: number,
): TradeSignal {
  const rr = Math.abs(price - sl) > 0 ? Math.abs(tp - price) / Math.abs(price - sl) : 0;
  return { index, time, dir, price, sl, tp, score, rr, confluences };
}

function emptySnapshot(price: number): DashboardSnapshot {
  return {
    price,
    emaBull: false,
    emaBear: false,
    htfBull: false,
    htfBear: false,
    msBull: false,
    msBear: false,
    lastEventBull: null,
    adx: 0,
    adxOk: false,
    chop: 0,
    chopRanging: false,
    atr: 0,
    atrRatio: 1,
    volaOk: false,
    rangeScore: 0,
    isSideways: false,
    momText: "NEUTRAL",
    momBull: false,
    momBear: false,
    relVol: 1,
    volSpike: false,
    hasVol: false,
    zone: "EQUILIBRIUM",
    buyCount: 0,
    sellCount: 0,
    enabledCount: 0,
    confNeed: 0,
    signal: "WAIT",
    score: 0,
    sl: null,
    tp: null,
    rr: null,
  };
}
