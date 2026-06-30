// ============================================================================
// Builds the top toolbar (symbol / timeframe / load) and the advanced settings
// panel. Mutates the shared `settings` and `state` objects and fires callbacks.
// ============================================================================
import type { Settings, SignalMode, SLMethod, TPMethod } from "../types";
import { SYMBOLS, INTERVALS } from "../config";

export interface ControlState {
  symbol: string;
  interval: string;
}

export interface BuildControlsOptions {
  topEl: HTMLElement;
  settingsEl: HTMLElement;
  settings: Settings;
  state: ControlState;
  onLoad: (forceDemo: boolean) => void;
  onSettings: () => void;
}

export function buildControls(opts: BuildControlsOptions): void {
  buildToolbar(opts);
  buildSettings(opts);
}

function buildToolbar(opts: BuildControlsOptions): void {
  const { topEl, state } = opts;
  topEl.innerHTML = `
    <div class="field">
      <label>Symbol</label>
      <select id="selSymbol">${SYMBOLS.map(
        (s) => `<option value="${s}" ${s === state.symbol ? "selected" : ""}>${s}</option>`,
      ).join("")}</select>
    </div>
    <div class="field">
      <label>Timeframe</label>
      <select id="selInterval">${INTERVALS.map(
        (i) => `<option value="${i}" ${i === state.interval ? "selected" : ""}>${i}</option>`,
      ).join("")}</select>
    </div>
    <div class="field"><label>&nbsp;</label><button id="btnLoad">↻ Load</button></div>
    <div class="field"><label>&nbsp;</label><button class="ghost" id="btnDemo">Demo data</button></div>
  `;

  const selSymbol = topEl.querySelector<HTMLSelectElement>("#selSymbol")!;
  const selInterval = topEl.querySelector<HTMLSelectElement>("#selInterval")!;
  selSymbol.addEventListener("change", () => {
    state.symbol = selSymbol.value;
    opts.onLoad(false);
  });
  selInterval.addEventListener("change", () => {
    state.interval = selInterval.value;
    opts.onLoad(false);
  });
  topEl.querySelector<HTMLButtonElement>("#btnLoad")!.addEventListener("click", () => opts.onLoad(false));
  topEl.querySelector<HTMLButtonElement>("#btnDemo")!.addEventListener("click", () => opts.onLoad(true));
}

function buildSettings(opts: BuildControlsOptions): void {
  const { settingsEl, settings } = opts;
  settingsEl.innerHTML = `
    <h3 class="collapse-head"><span>Settings</span><span class="muted" id="settingsToggle">hide ▾</span></h3>
    <div id="settingsBody"></div>
  `;
  const body = settingsEl.querySelector<HTMLElement>("#settingsBody")!;
  const toggle = settingsEl.querySelector<HTMLElement>("#settingsToggle")!;
  settingsEl.querySelector<HTMLElement>(".collapse-head")!.addEventListener("click", () => {
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "" : "none";
    toggle.textContent = hidden ? "hide ▾" : "show ▸";
  });

  const grid = document.createElement("div");
  grid.className = "setting-grid";
  body.appendChild(grid);

  const fire = opts.onSettings;

  // Signal engine
  grid.appendChild(
    selectField("Signal Mode", ["Confluence", "Strict"], settings.signalMode, (v) => {
      settings.signalMode = v as SignalMode;
      fire();
    }),
  );
  grid.appendChild(numberField("Min Confluences", settings.minConf, 1, 8, 1, (v) => ((settings.minConf = v), fire())));

  // Toggles
  const toggles: Array<[keyof Settings, string]> = [
    ["useTrend", "Trend"],
    ["useStruct", "Structure"],
    ["useBOS", "BOS/CHoCH"],
    ["useOB", "OB / FVG"],
    ["useLiq", "Liquidity"],
    ["useMom", "Momentum"],
    ["useVol", "Volume"],
    ["useHTF", "HTF Bias"],
    ["usePD", "Prem/Disc"],
    ["useRange", "Range Filter"],
    ["useVola", "Volatility"],
  ];
  for (const [key, label] of toggles) {
    grid.appendChild(
      toggleField(label, settings[key] as boolean, (v) => {
        (settings as unknown as Record<string, unknown>)[key] = v;
        fire();
      }),
    );
  }

  // Numeric tunables
  const numbers: Array<[keyof Settings, string, number, number, number]> = [
    ["emaFast", "EMA Fast", 1, 400, 1],
    ["emaSlow", "EMA Slow", 1, 800, 1],
    ["pivotLen", "Pivot Len", 2, 30, 1],
    ["structLookback", "Conf. Lookback", 1, 50, 1],
    ["obLookback", "OB Depth", 3, 50, 1],
    ["pdLen", "Range Len", 5, 200, 1],
    ["htfFactor", "HTF Factor", 2, 12, 1],
    ["adxMin", "ADX Min", 1, 60, 1],
    ["rangeMin", "Range Score Min", 1, 6, 1],
    ["momMin", "Momentum Min", 1, 4, 1],
    ["rr", "Risk:Reward", 0.5, 6, 0.1],
    ["slAtr", "SL ATR x", 0.1, 6, 0.1],
    ["tpAtr", "TP ATR x", 0.1, 10, 0.1],
  ];
  for (const [key, label, mn, mx, step] of numbers) {
    grid.appendChild(
      numberField(label, settings[key] as number, mn, mx, step, (v) => {
        (settings as unknown as Record<string, unknown>)[key] = v;
        fire();
      }),
    );
  }

  // SL / TP method selects
  grid.appendChild(
    selectField("SL Method", ["ATR", "Swing", "Order Block", "Fixed %"], settings.slMethod, (v) => {
      settings.slMethod = v as SLMethod;
      fire();
    }),
  );
  grid.appendChild(
    selectField("TP Method", ["Risk Reward", "ATR", "Liquidity", "Fixed %"], settings.tpMethod, (v) => {
      settings.tpMethod = v as TPMethod;
      fire();
    }),
  );
}

// ---- Field builders ---------------------------------------------------------
function numberField(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "setting";
  const id = `f_${label.replace(/\W+/g, "")}`;
  wrap.innerHTML = `<label for="${id}">${label}</label>`;
  const input = document.createElement("input");
  input.type = "number";
  input.id = id;
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.addEventListener("change", () => {
    let v = parseFloat(input.value);
    if (Number.isNaN(v)) v = value;
    v = Math.min(max, Math.max(min, v));
    input.value = String(v);
    onChange(v);
  });
  wrap.appendChild(input);
  return wrap;
}

function toggleField(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "setting toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  const lab = document.createElement("label");
  lab.textContent = label;
  wrap.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}

function selectField(
  label: string,
  options: string[],
  value: string,
  onChange: (v: string) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "setting";
  wrap.innerHTML = `<label>${label}</label>`;
  const sel = document.createElement("select");
  sel.innerHTML = options
    .map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`)
    .join("");
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.appendChild(sel);
  return wrap;
}
