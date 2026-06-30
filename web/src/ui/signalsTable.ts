// ============================================================================
// Signal history table — lists every BUY/SELL the engine produced across the
// loaded candles (newest first), acting like a lightweight backtest log.
// ============================================================================
import type { TradeSignal } from "../types";

function fmt(n: number, d = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function renderSignals(el: HTMLElement, signals: TradeSignal[], countEl: HTMLElement | null): void {
  if (countEl) countEl.textContent = `${signals.length} signal${signals.length === 1 ? "" : "s"}`;

  if (signals.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:14px;text-align:center">No signals on this dataset. Try a different symbol/timeframe, lower "Min confluences", or disable some filters.</p>`;
    return;
  }

  const rows = signals
    .slice()
    .reverse()
    .map((s) => {
      const dp = s.price < 1 ? 6 : 2;
      return `<tr>
        <td class="${s.dir === "BUY" ? "dir-buy" : "dir-sell"}">${s.dir}</td>
        <td>${fmtTime(s.time)}</td>
        <td>${fmt(s.price, dp)}</td>
        <td class="bear">${fmt(s.sl, dp)}</td>
        <td class="bull">${fmt(s.tp, dp)}</td>
        <td>1 : ${fmt(s.rr, 2)}</td>
        <td>${s.confluences}</td>
        <td>${s.score}</td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <table class="sig">
      <thead>
        <tr>
          <th style="text-align:left">Dir</th>
          <th>Time</th>
          <th>Entry</th>
          <th>SL</th>
          <th>TP</th>
          <th>R:R</th>
          <th>Conf.</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
