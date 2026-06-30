// ============================================================================
// SMC Pro Scanner — application entry point.
// Wires data loading, the SMC engine and the UI together. 100% client-side.
// ============================================================================
import "./styles.css";
import type { Candle, EngineResult, Settings } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_SYMBOL, DEFAULT_INTERVAL, DEFAULT_LIMIT } from "./config";
import { analyze } from "./smc/engine";
import { fetchKlines } from "./data/binance";
import { generateDemo, intervalToMs } from "./data/demo";
import { renderChart } from "./ui/chart";
import { renderDashboard } from "./ui/dashboard";
import { renderSignals } from "./ui/signalsTable";
import { buildControls, type ControlState } from "./ui/controls";

// ---- DOM refs ---------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const topEl = $("controls");
const settingsEl = $("settings");
const dashboardEl = $("dashboard");
const signalsEl = $("signalsTable");
const signalsCountEl = document.getElementById("signalsCount");
const canvas = $<HTMLCanvasElement>("chart");
const symbolTitleEl = $("symbolTitle");
const statusEl = $("statusBadge");

// ---- State ------------------------------------------------------------------
const settings: Settings = { ...DEFAULT_SETTINGS };
const state: ControlState = { symbol: DEFAULT_SYMBOL, interval: DEFAULT_INTERVAL };
let candles: Candle[] = [];
let lastResult: EngineResult | null = null;

function setStatus(text: string, cls: "" | "ok" | "err" | "demo"): void {
  statusEl.textContent = text;
  statusEl.className = `status-badge ${cls}`.trim();
}

function analyzeAndRender(): void {
  if (candles.length === 0) return;
  const result = analyze(candles, settings);
  lastResult = result;
  symbolTitleEl.textContent = `${state.symbol} · ${state.interval} · ${candles.length} bars`;
  renderChart(canvas, result);
  renderDashboard(dashboardEl, result.snapshot, state.symbol, state.interval);
  renderSignals(signalsEl, result.signals, signalsCountEl);
}

async function load(forceDemo: boolean): Promise<void> {
  if (forceDemo) {
    candles = generateDemo(DEFAULT_LIMIT, intervalToMs(state.interval));
    setStatus("demo data", "demo");
    analyzeAndRender();
    return;
  }

  setStatus("loading…", "");
  try {
    const data = await fetchKlines(state.symbol, state.interval, DEFAULT_LIMIT);
    if (!data.length) throw new Error("empty dataset");
    candles = data;
    setStatus("live · Binance", "ok");
  } catch (err) {
    console.warn("Live fetch failed, using demo data:", err);
    candles = generateDemo(DEFAULT_LIMIT, intervalToMs(state.interval));
    setStatus("offline · demo data", "demo");
  }
  analyzeAndRender();
}

// ---- Boot -------------------------------------------------------------------
buildControls({
  topEl,
  settingsEl,
  settings,
  state,
  onLoad: (forceDemo) => void load(forceDemo),
  onSettings: analyzeAndRender,
});

renderLegend();

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (lastResult) renderChart(canvas, lastResult);
  }, 120);
});

void load(false);

function renderLegend(): void {
  const legend = document.getElementById("legend");
  if (!legend) return;
  const items: Array<[string, string]> = [
    ["#42a5f5", "EMA Fast"],
    ["#ffb300", "EMA Slow"],
    ["rgba(144,164,174,0.7)", "Equilibrium"],
    ["rgba(0,230,118,0.5)", "Bull OB / FVG"],
    ["rgba(255,82,82,0.5)", "Bear OB / FVG"],
    ["#00e676", "BUY"],
    ["#ff5252", "SELL"],
  ];
  legend.innerHTML = items
    .map(([c, l]) => `<span><span class="dot" style="background:${c}"></span>${l}</span>`)
    .join("");
}
