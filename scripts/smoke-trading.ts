import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assessRugRisk,
  generateSignalFromCandles,
  placeOrder,
  resetPaperPortfolio,
  runTradingCycle,
  saveTradingSettings,
  tradingStatus,
  type Candle,
} from "../src/agent/trading.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "helix-trade-"));

await saveTradingSettings(tmp, {
  autoTrade: false,
  startingBalance: 10_000,
  watchlist: ["BTCUSDT"],
});
await resetPaperPortfolio(tmp);

const rugBtc = await assessRugRisk("BTCUSDT");
console.log("rug_btc", rugBtc.risk, rugBtc.scorePenalty);

// Synthetic uptrend candles for local signal test (no network required for this part)
const candles: Candle[] = [];
let px = 100;
for (let i = 0; i < 120; i++) {
  px = px * (1 + (i > 80 ? 0.004 : 0.001));
  const high = px * 1.002;
  const low = px * 0.998;
  candles.push({
    openTime: Date.now() - (120 - i) * 300_000,
    open: px * 0.999,
    high,
    low,
    close: px,
    volume: i > 100 ? 5000 : 1000,
  });
}
const signal = generateSignalFromCandles("BTCUSDT", candles, rugBtc);
console.log("signal", signal?.strategy, signal?.side, signal?.score.toFixed(2));

const buy = await placeOrder(tmp, {
  symbol: "BTCUSDT",
  side: "buy",
  notional: 500,
  reason: "smoke",
  force: true,
});
console.log("buy_ok", buy.ok);

const status = await tradingStatus(tmp);
console.log("equity", status.portfolio.equity, "positions", status.portfolio.positions.length);

const cycle = await runTradingCycle(tmp);
console.log("cycle_actions", cycle.actions?.length);

// Live should stay gated
await saveTradingSettings(tmp, { allowLiveTrading: false, mode: "live" });
const settings = await tradingStatus(tmp);
console.log("forced_paper", settings.settings.mode === "paper");

console.log("smoke_trading_ok", tmp);
