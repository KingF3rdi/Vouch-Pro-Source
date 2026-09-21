/**
 * Helix advanced day-trading bot.
 * Paper by default. Live only with explicit allow + exchange keys.
 * Not financial advice — markets can lose money; no profit guarantee.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { loadSecrets, saveSecrets, type HelixSecrets } from "./github.js";

export type TradeSide = "buy" | "sell";
export type TradeMode = "paper" | "live";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TradeSignal = {
  symbol: string;
  side: TradeSide;
  confidence: number; // 0..1
  strategy: string;
  reason: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  score: number;
  rugRisk: "low" | "medium" | "high" | "unknown";
  rugNotes: string[];
};

export type Position = {
  id: string;
  symbol: string;
  side: "long";
  qty: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: string;
  strategy: string;
};

export type Fill = {
  id: string;
  at: string;
  mode: TradeMode;
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
  fee: number;
  pnl?: number;
  reason: string;
};

export type TradingSettings = {
  allowLiveTrading: boolean;
  autoTrade: boolean;
  mode: TradeMode;
  quote: "USDT";
  startingBalance: number;
  maxPositionPct: number; // of equity
  maxDailyLossPct: number;
  minConfidence: number;
  maxOpenPositions: number;
  feeBps: number; // 10 = 0.10%
  watchlist: string[];
  binanceApiKey?: string;
  binanceApiSecret?: string;
};

export type Portfolio = {
  cash: number;
  equity: number;
  startingBalance: number;
  realizedPnl: number;
  dayPnl: number;
  dayStartedAt: string;
  positions: Position[];
  fills: Fill[];
  updatedAt: string;
};

const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
];

function tradingDir(workspace: string) {
  return path.join(workspace, ".helix", "trading");
}

function settingsPath(workspace: string) {
  return path.join(tradingDir(workspace), "settings.json");
}

function portfolioPath(workspace: string) {
  return path.join(tradingDir(workspace), "portfolio.json");
}

function defaultSettings(): TradingSettings {
  return {
    allowLiveTrading: false,
    autoTrade: false,
    mode: "paper",
    quote: "USDT",
    startingBalance: 10_000,
    maxPositionPct: 0.08,
    maxDailyLossPct: 0.03,
    minConfidence: 0.62,
    maxOpenPositions: 4,
    feeBps: 10,
    watchlist: DEFAULT_WATCHLIST,
  };
}

async function ensureDir(workspace: string) {
  await fs.mkdir(tradingDir(workspace), { recursive: true });
}

function tradingFromSecrets(secrets: HelixSecrets): Partial<TradingSettings> {
  const t = secrets.trading ?? {};
  return {
    allowLiveTrading: Boolean(t.allowLiveTrading),
    binanceApiKey: t.binanceApiKey,
    binanceApiSecret: t.binanceApiSecret,
  };
}

export async function loadTradingSettings(workspace: string): Promise<TradingSettings> {
  await ensureDir(workspace);
  const secrets = tradingFromSecrets(await loadSecrets(workspace));
  let file: Partial<TradingSettings> = {};
  try {
    file = JSON.parse(await fs.readFile(settingsPath(workspace), "utf8")) as Partial<TradingSettings>;
  } catch {
    // first run
  }
  const merged: TradingSettings = {
    ...defaultSettings(),
    ...file,
    allowLiveTrading: secrets.allowLiveTrading ?? file.allowLiveTrading ?? false,
    binanceApiKey: secrets.binanceApiKey || file.binanceApiKey,
    binanceApiSecret: secrets.binanceApiSecret || file.binanceApiSecret,
  };
  // Never imply live without allow
  if (!merged.allowLiveTrading) merged.mode = "paper";
  return merged;
}

export async function saveTradingSettings(
  workspace: string,
  patch: Partial<TradingSettings>
): Promise<TradingSettings> {
  await ensureDir(workspace);
  const current = await loadTradingSettings(workspace);
  const next: TradingSettings = {
    ...current,
    ...patch,
    watchlist: patch.watchlist ?? current.watchlist,
  };
  if (!next.allowLiveTrading) next.mode = "paper";

  // Persist non-secret settings to file; secrets to secrets.json
  const { binanceApiKey, binanceApiSecret, allowLiveTrading, ...fileSafe } = next;
  await fs.writeFile(settingsPath(workspace), JSON.stringify(fileSafe, null, 2), "utf8");

  const secrets = await loadSecrets(workspace);
  const trading: NonNullable<HelixSecrets["trading"]> = {
    allowLiveTrading: next.allowLiveTrading,
  };
  if (typeof patch.binanceApiKey === "string" && patch.binanceApiKey.trim()) {
    trading.binanceApiKey = patch.binanceApiKey.trim();
  } else if (current.binanceApiKey) {
    trading.binanceApiKey = current.binanceApiKey;
  }
  if (typeof patch.binanceApiSecret === "string" && patch.binanceApiSecret.trim()) {
    trading.binanceApiSecret = patch.binanceApiSecret.trim();
  } else if (current.binanceApiSecret) {
    trading.binanceApiSecret = current.binanceApiSecret;
  }
  if (patch.allowLiveTrading === false) {
    // keep keys but disable live
  }
  await saveSecrets(workspace, { trading });

  return loadTradingSettings(workspace);
}

export async function loadPortfolio(workspace: string): Promise<Portfolio> {
  await ensureDir(workspace);
  const settings = await loadTradingSettings(workspace);
  try {
    const raw = JSON.parse(await fs.readFile(portfolioPath(workspace), "utf8")) as Portfolio;
    return raw;
  } catch {
    const now = new Date().toISOString();
    const fresh: Portfolio = {
      cash: settings.startingBalance,
      equity: settings.startingBalance,
      startingBalance: settings.startingBalance,
      realizedPnl: 0,
      dayPnl: 0,
      dayStartedAt: now.slice(0, 10),
      positions: [],
      fills: [],
      updatedAt: now,
    };
    await savePortfolio(workspace, fresh);
    return fresh;
  }
}

async function savePortfolio(workspace: string, portfolio: Portfolio) {
  await ensureDir(workspace);
  portfolio.updatedAt = new Date().toISOString();
  await fs.writeFile(portfolioPath(workspace), JSON.stringify(portfolio, null, 2), "utf8");
  return portfolio;
}

function resetDayIfNeeded(portfolio: Portfolio): Portfolio {
  const today = new Date().toISOString().slice(0, 10);
  if (portfolio.dayStartedAt !== today) {
    portfolio.dayStartedAt = today;
    portfolio.dayPnl = 0;
  }
  return portfolio;
}

const MARKET_BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.us",
  "https://api.binance.com",
];

async function binanceGet(pathAndQuery: string): Promise<Response> {
  let last: Response | null = null;
  for (const base of MARKET_BASES) {
    try {
      const res = await fetch(`${base}${pathAndQuery}`, {
        headers: { "User-Agent": "HelixTrading/1.0" },
      });
      last = res;
      if (res.ok) return res;
    } catch {
      // try next
    }
  }
  if (last) return last;
  throw new Error("All market data endpoints failed");
}

const COINBASE_MAP: Record<string, string> = {
  BTCUSDT: "BTC-USD",
  ETHUSDT: "ETH-USD",
  SOLUSDT: "SOL-USD",
  BNBUSDT: "BNB-USD",
  XRPUSDT: "XRP-USD",
  ADAUSDT: "ADA-USD",
  DOGEUSDT: "DOGE-USD",
  AVAXUSDT: "AVAX-USD",
  LINKUSDT: "LINK-USD",
  DOTUSDT: "DOT-USD",
};

/** Public klines with geo fallbacks */
export async function fetchCandles(symbol: string, interval = "5m", limit = 120): Promise<Candle[]> {
  const pathAndQuery = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  try {
    const res = await binanceGet(pathAndQuery);
    if (res.ok) {
      const rows = (await res.json()) as Array<[number, string, string, string, string, string]>;
      return rows.map((r) => ({
        openTime: r[0],
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      }));
    }
  } catch {
    // fall through
  }

  // Coinbase candles fallback for mapped majors
  const product = COINBASE_MAP[symbol];
  if (!product) throw new Error(`Market data failed for ${symbol}`);
  const end = Math.floor(Date.now() / 1000);
  const start = end - limit * 300;
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=300&start=${start}&end=${end}`;
  const res = await fetch(url, { headers: { "User-Agent": "HelixTrading/1.0" } });
  if (!res.ok) throw new Error(`Market data failed for ${symbol}: ${res.status}`);
  // Coinbase returns [time, low, high, open, close, volume] newest first
  const rows = (await res.json()) as Array<[number, number, number, number, number, number]>;
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      openTime: r[0] * 1000,
      low: r[1],
      high: r[2],
      open: r[3],
      close: r[4],
      volume: r[5],
    }));
}

export async function fetchTicker(symbol: string) {
  try {
    const res = await binanceGet(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    if (res.ok) {
      const data = (await res.json()) as {
        lastPrice: string;
        priceChangePercent: string;
        quoteVolume: string;
        highPrice: string;
        lowPrice: string;
      };
      return {
        symbol,
        price: Number(data.lastPrice),
        changePct: Number(data.priceChangePercent),
        quoteVolume: Number(data.quoteVolume),
        high: Number(data.highPrice),
        low: Number(data.lowPrice),
      };
    }
  } catch {
    // fall through
  }

  const product = COINBASE_MAP[symbol];
  if (!product) throw new Error(`Ticker failed for ${symbol}`);
  const res = await fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
    headers: { "User-Agent": "HelixTrading/1.0" },
  });
  if (!res.ok) throw new Error(`Ticker failed for ${symbol}: ${res.status}`);
  const data = (await res.json()) as { price: string };
  const stats = await fetch(`https://api.exchange.coinbase.com/products/${product}/stats`, {
    headers: { "User-Agent": "HelixTrading/1.0" },
  });
  const st = stats.ok
    ? ((await stats.json()) as { high?: string; low?: string; volume?: string; open?: string })
    : {};
  const price = Number(data.price);
  const open = st.open ? Number(st.open) : price;
  const changePct = open ? ((price - open) / open) * 100 : 0;
  return {
    symbol,
    price,
    changePct,
    quoteVolume: st.volume ? Number(st.volume) * price : 0,
    high: st.high ? Number(st.high) : price,
    low: st.low ? Number(st.low) : price,
  };
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
  }
  return prev;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  return sma(trs, period);
}

function stdev(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

/** Major CEX pairs are generally not classic “rug pulls”; scam risk focuses on obscure tokens. */
export async function assessRugRisk(symbol: string): Promise<{
  risk: TradeSignal["rugRisk"];
  notes: string[];
  scorePenalty: number;
}> {
  const notes: string[] = [];
  const base = symbol.replace(/USDT$|BUSD$|USD$/, "");
  const majors = new Set([
    "BTC",
    "ETH",
    "BNB",
    "SOL",
    "XRP",
    "ADA",
    "DOGE",
    "AVAX",
    "LINK",
    "DOT",
    "MATIC",
    "POL",
    "LTC",
    "BCH",
    "ATOM",
    "UNI",
    "NEAR",
    "APT",
    "ARB",
    "OP",
    "SUI",
    "TON",
    "TRX",
  ]);

  if (majors.has(base)) {
    return {
      risk: "low",
      notes: ["Listed major on Binance spot — classic contract rug risk is low vs meme/DEX launches."],
      scorePenalty: 0,
    };
  }

  // DexScreener search for obscure / meme tickers
  try {
    const q = encodeURIComponent(base);
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${q}`, {
      headers: { "User-Agent": "HelixTrading/1.0" },
    });
    if (!res.ok) {
      return { risk: "unknown", notes: ["Could not query DexScreener for rug heuristics."], scorePenalty: 0.15 };
    }
    const data = (await res.json()) as {
      pairs?: Array<{
        chainId?: string;
        liquidity?: { usd?: number };
        fdv?: number;
        marketCap?: number;
        pairCreatedAt?: number;
        txns?: { h24?: { buys?: number; sells?: number } };
        volume?: { h24?: number };
        priceChange?: { h24?: number };
        url?: string;
        baseToken?: { symbol?: string };
      }>;
    };
    const pairs = (data.pairs ?? [])
      .filter((p) => (p.baseToken?.symbol || "").toUpperCase() === base)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (!pairs.length) {
      notes.push("No clear DEX pair found — treat as elevated unknown risk.");
      return { risk: "medium", notes, scorePenalty: 0.2 };
    }

    const top = pairs[0]!;
    const liq = top.liquidity?.usd ?? 0;
    const vol = top.volume?.h24 ?? 0;
    const ageMs = top.pairCreatedAt ? Date.now() - top.pairCreatedAt : null;
    const ageHours = ageMs != null ? ageMs / 3_600_000 : null;
    const buys = top.txns?.h24?.buys ?? 0;
    const sells = top.txns?.h24?.sells ?? 0;
    const change = top.priceChange?.h24 ?? 0;

    let risk: TradeSignal["rugRisk"] = "low";
    let penalty = 0;

    if (liq < 50_000) {
      notes.push(`Low liquidity ($${Math.round(liq)}) — easy to rug / high slippage.`);
      risk = "high";
      penalty += 0.45;
    } else if (liq < 250_000) {
      notes.push(`Modest liquidity ($${Math.round(liq)}).`);
      risk = "medium";
      penalty += 0.2;
    } else {
      notes.push(`Liquidity ~$${Math.round(liq)}.`);
    }

    if (ageHours != null && ageHours < 24) {
      notes.push(`Pair age < 24h (${ageHours.toFixed(1)}h) — classic rug window.`);
      risk = "high";
      penalty += 0.35;
    } else if (ageHours != null && ageHours < 72) {
      notes.push(`Young pair (${ageHours.toFixed(1)}h).`);
      if (risk === "low") risk = "medium";
      penalty += 0.15;
    }

    if (vol > 0 && liq > 0 && vol / liq > 15) {
      notes.push("Volume/liquidity extremely high — wash-trading or mania risk.");
      if (risk === "low") risk = "medium";
      penalty += 0.1;
    }

    if (sells > 0 && buys / Math.max(sells, 1) > 8 && change > 80) {
      notes.push("Buy-heavy + parabolic move — dump risk.");
      risk = risk === "high" ? "high" : "medium";
      penalty += 0.15;
    }

    if (change < -60) {
      notes.push("Already dumped hard in 24h — avoid catching knives.");
      penalty += 0.2;
      if (risk === "low") risk = "medium";
    }

    if (penalty >= 0.45) risk = "high";
    else if (penalty >= 0.2 && risk === "low") risk = "medium";

    return { risk, notes, scorePenalty: Math.min(0.7, penalty) };
  } catch (error) {
    return {
      risk: "unknown",
      notes: [`Rug scan error: ${error instanceof Error ? error.message : String(error)}`],
      scorePenalty: 0.15,
    };
  }
}

export function generateSignalFromCandles(
  symbol: string,
  candles: Candle[],
  rug: { risk: TradeSignal["rugRisk"]; notes: string[]; scorePenalty: number }
): TradeSignal | null {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const price = closes.at(-1);
  if (price == null) return null;

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema55 = ema(closes, 55);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const volSma = sma(volumes, 20);
  const lastVol = volumes.at(-1) ?? 0;
  const bbMid = sma(closes, 20);
  const bbStd = stdev(closes, 20);

  if (ema9 == null || ema21 == null || ema55 == null || rsi14 == null || atr14 == null || !bbMid || !bbStd) {
    return null;
  }

  // Hard block high rug risk for auto entries
  if (rug.risk === "high") {
    return {
      symbol,
      side: "sell",
      confidence: 0.9,
      strategy: "rug-avoidance",
      reason: `Hard avoid: ${rug.notes.join(" ")}`,
      entry: price,
      stopLoss: price,
      takeProfit: price,
      score: -1,
      rugRisk: rug.risk,
      rugNotes: rug.notes,
    };
  }

  let score = 0;
  const reasons: string[] = [];
  let side: TradeSide | null = null;
  let strategy = "multi-factor";

  // Trend filter: only long when EMA stack is bullish (day-trade with trend)
  const trendUp = ema9 > ema21 && ema21 > ema55;
  const trendDown = ema9 < ema21 && ema21 < ema55;

  // Momentum breakout
  const recentHigh = Math.max(...candles.slice(-20, -1).map((c) => c.high));
  const volSurge = volSma ? lastVol > volSma * 1.4 : false;
  if (trendUp && price > recentHigh && volSurge && rsi14 < 72) {
    side = "buy";
    strategy = "breakout-momentum";
    score += 0.55;
    reasons.push("Breakout above 20-bar high with volume surge in uptrend.");
  }

  // Pullback in uptrend (mean reversion to EMA21)
  const distToEma21 = (price - ema21) / ema21;
  if (trendUp && distToEma21 < -0.002 && distToEma21 > -0.02 && rsi14 > 38 && rsi14 < 55) {
    if (!side) {
      side = "buy";
      strategy = "trend-pullback";
    }
    score += 0.4;
    reasons.push("Pullback toward EMA21 in uptrend with RSI reset.");
  }

  // Bollinger bounce (only with trend)
  const lower = bbMid - 2 * bbStd;
  if (trendUp && price <= lower * 1.002 && rsi14 < 40) {
    if (!side) {
      side = "buy";
      strategy = "bollinger-reclaim";
    }
    score += 0.3;
    reasons.push("Price at lower Bollinger in uptrend.");
  }

  // Avoid chasing
  if (rsi14 > 78) {
    score -= 0.35;
    reasons.push("RSI overbought — chase penalty.");
  }

  // Short-term fade only as “sell signal” for exiting / standing aside (we only open longs)
  if (trendDown && rsi14 > 60) {
    score -= 0.25;
    reasons.push("Downtrend — no new longs.");
  }

  score -= rug.scorePenalty;
  if (rug.risk === "medium") reasons.push("Elevated token risk — size will be reduced.");

  if (!side || side !== "buy" || score < 0.35) {
    // Stand aside
    return {
      symbol,
      side: "sell",
      confidence: Math.max(0, Math.min(1, 1 - score)),
      strategy: "stand-aside",
      reason: reasons.join(" ") || "No high-quality long setup.",
      entry: price,
      stopLoss: price * 0.99,
      takeProfit: price * 1.01,
      score,
      rugRisk: rug.risk,
      rugNotes: rug.notes,
    };
  }

  const stop = price - atr14 * 1.4;
  const risk = price - stop;
  const take = price + risk * 2.2; // ~1:2.2 RR
  const confidence = Math.max(0.4, Math.min(0.95, score));

  return {
    symbol,
    side: "buy",
    confidence,
    strategy,
    reason: reasons.join(" "),
    entry: price,
    stopLoss: Number(stop.toFixed(8)),
    takeProfit: Number(take.toFixed(8)),
    score,
    rugRisk: rug.risk,
    rugNotes: rug.notes,
  };
}

export async function scanBestTrades(
  workspace: string,
  symbols?: string[]
): Promise<{ signals: TradeSignal[]; scannedAt: string }> {
  const settings = await loadTradingSettings(workspace);
  const list = symbols?.length ? symbols : settings.watchlist;
  const signals: TradeSignal[] = [];

  for (const symbol of list) {
    try {
      const [candles, rug] = await Promise.all([
        fetchCandles(symbol, "5m", 120),
        assessRugRisk(symbol),
      ]);
      const signal = generateSignalFromCandles(symbol, candles, rug);
      if (signal) signals.push(signal);
    } catch (error) {
      signals.push({
        symbol,
        side: "sell",
        confidence: 0,
        strategy: "error",
        reason: error instanceof Error ? error.message : String(error),
        entry: 0,
        stopLoss: 0,
        takeProfit: 0,
        score: -99,
        rugRisk: "unknown",
        rugNotes: ["scan failed"],
      });
    }
  }

  // Best longs first by score*confidence, exclude hard avoids (score < 0)
  signals.sort((a, b) => b.score * b.confidence - a.score * a.confidence);
  return { signals, scannedAt: new Date().toISOString() };
}

function markEquity(portfolio: Portfolio, marks: Record<string, number>): Portfolio {
  let equity = portfolio.cash;
  for (const pos of portfolio.positions) {
    const px = marks[pos.symbol] ?? pos.entry;
    equity += pos.qty * px;
  }
  portfolio.equity = equity;
  return portfolio;
}

async function markPrices(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const t = await fetchTicker(symbol);
        out[symbol] = t.price;
      } catch {
        // skip
      }
    })
  );
  return out;
}

export async function placeOrder(
  workspace: string,
  input: {
    symbol: string;
    side: TradeSide;
    qty?: number;
    notional?: number;
    reason?: string;
    stopLoss?: number;
    takeProfit?: number;
    strategy?: string;
    force?: boolean;
  }
) {
  const settings = await loadTradingSettings(workspace);
  let portfolio = resetDayIfNeeded(await loadPortfolio(workspace));

  if (settings.mode === "live" && !settings.allowLiveTrading) {
    return { ok: false as const, error: "Live trading not allowed. Enable in Trade tab." };
  }
  if (settings.mode === "live") {
    return {
      ok: false as const,
      error:
        "Live exchange order routing is gated. Keys can be saved, but Helix ships paper execution first — enable paper auto-trade, then extend live signing when you accept the risk.",
      hint: "Use mode=paper for automatic fills. Live Binance signed orders can be added after you confirm risk tolerance.",
    };
  }

  // Daily loss circuit breaker
  if (portfolio.dayPnl <= -settings.startingBalance * settings.maxDailyLossPct && !input.force) {
    return { ok: false as const, error: "Max daily loss hit — trading paused for today." };
  }

  const ticker = await fetchTicker(input.symbol);
  const price = ticker.price;
  const marks = await markPrices([
    ...new Set([input.symbol, ...portfolio.positions.map((p) => p.symbol)]),
  ]);
  portfolio = markEquity(portfolio, marks);

  if (input.side === "buy") {
    if (portfolio.positions.length >= settings.maxOpenPositions && !input.force) {
      return { ok: false as const, error: "Max open positions reached." };
    }
    const rug = await assessRugRisk(input.symbol);
    if (rug.risk === "high" && !input.force) {
      return { ok: false as const, error: `Blocked rug risk: ${rug.notes.join(" ")}`, rug };
    }

    const maxNotional = portfolio.equity * settings.maxPositionPct;
    let notional = input.notional ?? maxNotional;
    if (rug.risk === "medium") notional *= 0.5;
    notional = Math.min(notional, portfolio.cash * 0.98, maxNotional);
    if (notional < 10) return { ok: false as const, error: "Insufficient cash / notional too small." };

    const fee = (notional * settings.feeBps) / 10_000;
    const qty = input.qty ?? (notional - fee) / price;
    const cost = qty * price + fee;
    if (cost > portfolio.cash) return { ok: false as const, error: "Insufficient cash." };

    portfolio.cash -= cost;
    const atrGuess = price * 0.008;
    const pos: Position = {
      id: crypto.randomUUID(),
      symbol: input.symbol,
      side: "long",
      qty,
      entry: price,
      stopLoss: input.stopLoss ?? price - atrGuess * 1.4,
      takeProfit: input.takeProfit ?? price + atrGuess * 2.2,
      openedAt: new Date().toISOString(),
      strategy: input.strategy ?? "manual",
    };
    portfolio.positions.push(pos);
    const fill: Fill = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      mode: "paper",
      symbol: input.symbol,
      side: "buy",
      qty,
      price,
      fee,
      reason: input.reason ?? "manual buy",
    };
    portfolio.fills.unshift(fill);
    portfolio.fills = portfolio.fills.slice(0, 200);
    portfolio = markEquity(portfolio, { ...marks, [input.symbol]: price });
    await savePortfolio(workspace, portfolio);
    return { ok: true as const, fill, position: pos, portfolio, mode: "paper" as const };
  }

  // sell / close
  const pos = portfolio.positions.find((p) => p.symbol === input.symbol);
  if (!pos) return { ok: false as const, error: "No open position for symbol." };
  const qty = Math.min(input.qty ?? pos.qty, pos.qty);
  const fee = (qty * price * settings.feeBps) / 10_000;
  const proceeds = qty * price - fee;
  const pnl = (price - pos.entry) * qty - fee;
  portfolio.cash += proceeds;
  portfolio.realizedPnl += pnl;
  portfolio.dayPnl += pnl;
  if (qty >= pos.qty - 1e-12) {
    portfolio.positions = portfolio.positions.filter((p) => p.id !== pos.id);
  } else {
    pos.qty -= qty;
  }
  const fill: Fill = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    mode: "paper",
    symbol: input.symbol,
    side: "sell",
    qty,
    price,
    fee,
    pnl,
    reason: input.reason ?? "manual sell",
  };
  portfolio.fills.unshift(fill);
  portfolio.fills = portfolio.fills.slice(0, 200);
  portfolio = markEquity(portfolio, { ...marks, [input.symbol]: price });
  await savePortfolio(workspace, portfolio);
  return { ok: true as const, fill, portfolio, mode: "paper" as const };
}

/** Manage stops/targets and optionally enter best signals. */
export async function runTradingCycle(workspace: string) {
  const settings = await loadTradingSettings(workspace);
  let portfolio = resetDayIfNeeded(await loadPortfolio(workspace));
  const actions: string[] = [];

  const openSymbols = portfolio.positions.map((p) => p.symbol);
  const marks = await markPrices([...new Set([...openSymbols, ...settings.watchlist.slice(0, 5)])]);
  portfolio = markEquity(portfolio, marks);

  // Exit logic
  for (const pos of [...portfolio.positions]) {
    const px = marks[pos.symbol];
    if (px == null) continue;
    if (px <= pos.stopLoss) {
      const res = await placeOrder(workspace, {
        symbol: pos.symbol,
        side: "sell",
        reason: `Stop-loss hit @ ${px}`,
        force: true,
      });
      actions.push(`SL ${pos.symbol}: ${res.ok ? "closed" : "fail"}`);
    } else if (px >= pos.takeProfit) {
      const res = await placeOrder(workspace, {
        symbol: pos.symbol,
        side: "sell",
        reason: `Take-profit hit @ ${px}`,
        force: true,
      });
      actions.push(`TP ${pos.symbol}: ${res.ok ? "closed" : "fail"}`);
    }
  }

  portfolio = await loadPortfolio(workspace);

  if (!settings.autoTrade) {
    return {
      ok: true,
      autoTrade: false,
      actions,
      portfolio,
      note: "Auto-trade off — managed exits only. Enable autoTrade to place new entries.",
    };
  }

  if (portfolio.dayPnl <= -settings.startingBalance * settings.maxDailyLossPct) {
    return { ok: true, autoTrade: true, actions: [...actions, "Daily loss limit — no new entries"], portfolio };
  }

  const { signals } = await scanBestTrades(workspace);
  const best = signals.find(
    (s) =>
      s.side === "buy" &&
      s.score > 0 &&
      s.confidence >= settings.minConfidence &&
      s.rugRisk !== "high" &&
      s.strategy !== "stand-aside" &&
      s.strategy !== "rug-avoidance"
  );

  if (best) {
    const already = portfolio.positions.some((p) => p.symbol === best.symbol);
    if (!already) {
      const res = await placeOrder(workspace, {
        symbol: best.symbol,
        side: "buy",
        stopLoss: best.stopLoss,
        takeProfit: best.takeProfit,
        strategy: best.strategy,
        reason: best.reason,
      });
      actions.push(
        res.ok
          ? `ENTER ${best.symbol} conf=${best.confidence.toFixed(2)} (${best.strategy})`
          : `SKIP ${best.symbol}: ${"error" in res ? res.error : "failed"}`
      );
    }
  } else {
    actions.push("No qualifying long setup after rug filters.");
  }

  portfolio = await loadPortfolio(workspace);
  return { ok: true, autoTrade: true, actions, portfolio, topSignals: signals.slice(0, 5) };
}

export async function tradingStatus(workspace: string) {
  const settings = await loadTradingSettings(workspace);
  const portfolio = await loadPortfolio(workspace);
  const open = portfolio.positions.map((p) => p.symbol);
  const marks = open.length ? await markPrices(open) : {};
  markEquity(portfolio, marks);
  return {
    disclaimer:
      "Experimental trading assistant. Not financial advice. No profit guarantee. You can lose money.",
    settings: {
      ...settings,
      binanceApiKey: settings.binanceApiKey ? "***" : undefined,
      binanceApiSecret: settings.binanceApiSecret ? "***" : undefined,
      hasBinanceKey: Boolean(settings.binanceApiKey),
      hasBinanceSecret: Boolean(settings.binanceApiSecret),
    },
    portfolio,
    marks,
  };
}

export async function resetPaperPortfolio(workspace: string) {
  const settings = await loadTradingSettings(workspace);
  const now = new Date().toISOString();
  const fresh: Portfolio = {
    cash: settings.startingBalance,
    equity: settings.startingBalance,
    startingBalance: settings.startingBalance,
    realizedPnl: 0,
    dayPnl: 0,
    dayStartedAt: now.slice(0, 10),
    positions: [],
    fills: [],
    updatedAt: now,
  };
  await savePortfolio(workspace, fresh);
  return fresh;
}

export function createTradingTools(workspace: string) {
  return {
    trading_status: tool({
      description: "Show Helix trading bot status, paper portfolio, risk limits, and disclaimers.",
      inputSchema: z.object({}),
      execute: async () => tradingStatus(workspace),
    }),

    trading_scan: tool({
      description:
        "Scan watchlist for the best day-trade setups using multi-factor signals + rug-pull filters.",
      inputSchema: z.object({
        symbols: z.array(z.string()).optional(),
      }),
      execute: async ({ symbols }) => scanBestTrades(workspace, symbols),
    }),

    trading_rug_check: tool({
      description: "Assess rug-pull / scam risk for a symbol (majors vs DEX liquidity/age heuristics).",
      inputSchema: z.object({ symbol: z.string().min(1) }),
      execute: async ({ symbol }) => assessRugRisk(symbol.toUpperCase()),
    }),

    trading_place_order: tool({
      description:
        "Place a paper (default) buy/sell. High rug risk is blocked unless force=true. Live is gated.",
      inputSchema: z.object({
        symbol: z.string(),
        side: z.enum(["buy", "sell"]),
        notional: z.number().positive().optional(),
        qty: z.number().positive().optional(),
        stopLoss: z.number().positive().optional(),
        takeProfit: z.number().positive().optional(),
        reason: z.string().optional(),
        force: z.boolean().default(false),
      }),
      execute: async (input) => placeOrder(workspace, { ...input, symbol: input.symbol.toUpperCase() }),
    }),

    trading_run_cycle: tool({
      description:
        "One bot cycle: manage stop/take-profit exits; if autoTrade is on, enter the best filtered setup.",
      inputSchema: z.object({}),
      execute: async () => runTradingCycle(workspace),
    }),

    trading_set_config: tool({
      description: "Update trading bot config (autoTrade, limits, watchlist). Live requires allowLiveTrading.",
      inputSchema: z.object({
        autoTrade: z.boolean().optional(),
        allowLiveTrading: z.boolean().optional(),
        mode: z.enum(["paper", "live"]).optional(),
        maxPositionPct: z.number().min(0.01).max(0.5).optional(),
        maxDailyLossPct: z.number().min(0.005).max(0.2).optional(),
        minConfidence: z.number().min(0.5).max(0.95).optional(),
        maxOpenPositions: z.number().int().min(1).max(20).optional(),
        watchlist: z.array(z.string()).optional(),
        startingBalance: z.number().positive().optional(),
      }),
      execute: async (patch) => {
        const settings = await saveTradingSettings(workspace, {
          ...patch,
          watchlist: patch.watchlist?.map((s) => s.toUpperCase()),
        });
        return {
          ok: true,
          settings: {
            ...settings,
            binanceApiKey: undefined,
            binanceApiSecret: undefined,
            hasBinanceKey: Boolean(settings.binanceApiKey),
          },
        };
      },
    }),
  };
}
