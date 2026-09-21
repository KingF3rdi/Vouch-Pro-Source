import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assessRugRisk,
  discoverMemecoins,
  generateSignalFromCandles,
  placeOrder,
  resetPaperPortfolio,
  saveTradingSettings,
  tradingStatus,
  type Candle,
} from "../src/agent/trading.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "helix-meme-"));

await saveTradingSettings(tmp, {
  focus: "memecoins",
  autoTrade: false,
  discoverDexMemes: false, // keep smoke offline-ish for discovery noise
  watchlist: ["DOGEUSDT", "PEPEUSDT", "WIFUSDT"],
  startingBalance: 10_000,
});
await resetPaperPortfolio(tmp);

const rug = await assessRugRisk("PEPEUSDT", { focus: "memecoins" });
console.log("rug_pepe", rug.risk);

const candles: Candle[] = [];
let px = 0.00001;
for (let i = 0; i < 120; i++) {
  px = px * (1 + (i > 90 ? 0.006 : 0.0015));
  candles.push({
    openTime: Date.now() - (120 - i) * 300_000,
    open: px * 0.999,
    high: px * 1.003,
    low: px * 0.997,
    close: px,
    volume: i > 100 ? 8_000_000 : 900_000,
  });
}
const signal = generateSignalFromCandles("PEPEUSDT", candles, rug, { memeMode: true });
console.log("meme_signal", signal?.strategy, signal?.side, signal?.score.toFixed(2));

const buy = await placeOrder(tmp, {
  symbol: "DOGEUSDT",
  side: "buy",
  notional: 300,
  reason: "meme-smoke",
  force: true,
});
console.log("buy_ok", buy.ok);

const status = await tradingStatus(tmp);
console.log("focus", status.focus, "equity", status.portfolio.equity);

// Quick discover with network (may return CEX-only if Dex slow)
const found = await discoverMemecoins(tmp, 8);
console.log(
  "discovered",
  found.candidates.length,
  found.candidates.slice(0, 3).map((c) => `${c.source}:${c.symbol}:${c.rugRisk}`)
);

console.log("smoke_meme_ok", tmp);
