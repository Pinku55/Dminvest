// ============================================================================
// Dashboard panel — mirrors the Pine strategy's on-chart status table.
// ============================================================================
import type { DashboardSnapshot } from "../types";

function row(k: string, v: string, cls = ""): string {
  return `<div class="dash-row"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`;
}

function fmt(n: number, d = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

export function renderDashboard(
  el: HTMLElement,
  snap: DashboardSnapshot,
  symbol: string,
  interval: string,
): void {
  const sig = snap.signal;
  const sigCls = sig === "BUY" ? "buy" : sig === "SELL" ? "sell" : snap.isSideways ? "range" : "wait";
  const sigText = snap.isSideways && sig === "WAIT" ? "RANGING — NO TRADE" : sig;
  const score = sig === "WAIT" ? Math.max(snap.buyCount, snap.sellCount) * 12 : snap.score;

  const trendTxt = snap.emaBull ? "BULLISH ▲" : snap.emaBear ? "BEARISH ▼" : "NEUTRAL";
  const trendCls = snap.emaBull ? "bull" : snap.emaBear ? "bear" : "neutral";
  const htfTxt = snap.htfBull ? "BULLISH" : snap.htfBear ? "BEARISH" : "NEUTRAL";
  const htfCls = snap.htfBull ? "bull" : snap.htfBear ? "bear" : "neutral";
  const structTxt = snap.msBull ? "HH / HL ▲" : snap.msBear ? "LH / LL ▼" : "MIXED";
  const structCls = snap.msBull ? "bull" : snap.msBear ? "bear" : "neutral";
  const eventTxt = snap.lastEventBull === null ? "—" : snap.lastEventBull ? "BOS/CHoCH ▲" : "BOS/CHoCH ▼";
  const eventCls = snap.lastEventBull === null ? "neutral" : snap.lastEventBull ? "bull" : "bear";
  const zoneCls = snap.zone === "DISCOUNT" ? "bull" : snap.zone === "PREMIUM" ? "bear" : "neutral";
  const mktTxt = snap.isSideways ? "RANGING ▬" : snap.emaBull ? "TRENDING ▲" : snap.emaBear ? "TRENDING ▼" : "NEUTRAL";
  const mktCls = snap.isSideways ? "neutral" : snap.emaBull ? "bull" : snap.emaBear ? "bear" : "neutral";

  el.innerHTML = `
    <h2>Live Analysis</h2>
    <div class="big-signal ${sigCls}">${sigText}
      <div class="score-bar"><span style="width:${Math.min(100, score)}%"></span></div>
    </div>
    ${row("Symbol", `${symbol} · ${interval}`)}
    ${row("Price", fmt(snap.price, snap.price < 1 ? 6 : 2))}
    ${row("Market State", mktTxt, mktCls)}
    ${row("LTF Trend", trendTxt, trendCls)}
    ${row("HTF Bias", htfTxt, htfCls)}
    ${row("Structure", structTxt, structCls)}
    ${row("Last Event", eventTxt, eventCls)}
    ${row("ADX", `${fmt(snap.adx, 1)} ${snap.adxOk ? "✓" : "✗"}`, snap.adxOk ? "bull" : "bear")}
    ${row("Choppiness", `${fmt(snap.chop, 1)} ${snap.chopRanging ? "▬" : "✓"}`, snap.chopRanging ? "warn" : "bull")}
    ${row("ATR Ratio", `${fmt(snap.atrRatio, 2)} ${snap.volaOk ? "✓" : "✗"}`, snap.volaOk ? "bull" : "bear")}
    ${row("Range Score", `${snap.rangeScore} / 6`, snap.isSideways ? "warn" : "bull")}
    ${row("Momentum", snap.momText, snap.momBull ? "bull" : snap.momBear ? "bear" : "neutral")}
    ${row("Rel. Volume", `${fmt(snap.relVol, 2)}x ${snap.hasVol ? (snap.volSpike ? "✓" : "") : "(n/a)"}`, snap.volSpike ? "bull" : "neutral")}
    ${row("Zone", snap.zone, zoneCls)}
    ${row("Confluence", `${sig === "SELL" ? snap.sellCount : snap.buyCount} / ${snap.enabledCount} (need ${snap.confNeed})`)}
    ${row("Stop Loss", snap.sl !== null ? fmt(snap.sl, snap.sl < 1 ? 6 : 2) : "—", "bear")}
    ${row("Take Profit", snap.tp !== null ? fmt(snap.tp, snap.tp < 1 ? 6 : 2) : "—", "bull")}
    ${row("Risk : Reward", snap.rr !== null ? `1 : ${fmt(snap.rr, 2)}` : "—", "neutral")}
  `;
}
