# SMC Pro Scanner

A **client-side** Smart Money Concept signal scanner built with **Vite + TypeScript**.
It ports the logic of the `SMC_Pro_Strategy.pine` TradingView strategy into the browser:
trend + HTF bias, market structure (BOS / CHoCH), order blocks, fair value gaps,
liquidity sweeps, premium/discount zones, a 6-factor sideways-market filter, and a
confluence-based BUY/SELL signal engine with automatic SL / TP.

> **No backend.** There is no Node.js server or API of our own. Node is used only as
> the local build tool (Vite). The built `dist/` is 100% static HTML/CSS/JS and runs
> entirely in the browser. Market data comes from Binance's public REST endpoint
> (CORS-enabled, no key); if that is unreachable an offline **demo dataset** is generated
> so the tool always works.

## Features

- **Candlestick chart** (custom zero-dependency canvas renderer) with EMA lines,
  equilibrium line, order-block & FVG zones, swing points, BUY/SELL markers and SL/TP lines.
- **Live dashboard** — market state, LTF/HTF trend, structure, ADX, choppiness, ATR ratio,
  range score, momentum, relative volume, zone, confluence count, SL/TP and R:R.
- **Signal history table** — every signal across the loaded candles (acts like a mini backtest log).
- **Fully configurable** — signal mode (Confluence/Strict), min confluences, all filter
  toggles, EMA lengths, pivot/lookback, ADX threshold, R:R, SL/TP methods, and more.
- **Non-repainting** — pivots confirm `pivotLen` bars later; every computation is causal.

## Requirements

- Node.js 18+ (build tooling only) and npm.

## Getting started

```bash
cd web
npm install      # installs vite + typescript (dev tooling only)
npm run dev      # start the dev server (http://localhost:5173)
```

## Build for production

```bash
npm run build    # outputs static assets to web/dist/
npm run preview  # locally preview the production build
```

Deploy the contents of `web/dist/` to any static host (GitHub Pages, Netlify, S3, etc.).

## Type-check

```bash
npm run typecheck
```

## Project structure

```
web/
  index.html
  src/
    main.ts                 # app entry: data load + render wiring
    config.ts               # default settings, symbols, intervals
    types.ts                # shared types
    indicators/
      math.ts               # sma/ema/rma/stdev/highest/lowest/sum/change
      indicators.ts         # ATR, RSI, MACD, CCI, ADX, Choppiness, BBW, Donchian, OBV
    smc/
      engine.ts             # the SMC analysis + confluence signal engine
    data/
      binance.ts            # public REST data source
      demo.ts               # offline synthetic data fallback
    ui/
      chart.ts              # canvas candlestick chart + overlays
      dashboard.ts          # status panel
      controls.ts           # toolbar + settings panel
      signalsTable.ts       # signal history table
    styles.css
```

## Disclaimer

Educational tool only — **not financial advice**. Trading involves substantial risk.
