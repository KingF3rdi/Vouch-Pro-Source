import { useEffect, useState } from "react";
import { CandlestickChart, Play, RefreshCw, ShieldAlert } from "lucide-react";

type Signal = {
  symbol: string;
  side: string;
  confidence: number;
  strategy: string;
  reason: string;
  score: number;
  rugRisk: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
};

type Status = {
  disclaimer: string;
  settings: {
    autoTrade: boolean;
    allowLiveTrading: boolean;
    mode: string;
    minConfidence: number;
    maxPositionPct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    startingBalance: number;
    watchlist: string[];
  };
  portfolio: {
    cash: number;
    equity: number;
    realizedPnl: number;
    dayPnl: number;
    positions: Array<{
      symbol: string;
      qty: number;
      entry: number;
      stopLoss: number;
      takeProfit: number;
      strategy: string;
    }>;
    fills: Array<{
      at: string;
      side: string;
      symbol: string;
      price: number;
      qty: number;
      pnl?: number;
      reason: string;
    }>;
  };
};

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function TradingPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [autoTrade, setAutoTrade] = useState(false);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/trading/status");
    const data = (await res.json()) as Status;
    setStatus(data);
    setAutoTrade(Boolean(data.settings?.autoTrade));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveAuto(next: boolean) {
    setBusy(true);
    try {
      await fetch("/api/trading/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTrade: next }),
      });
      setAutoTrade(next);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setLog("Scanning memecoins…");
    try {
      const res = await fetch("/api/trading/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      setSignals(data.signals ?? []);
      setLog(
        `Memes scanned ${data.signals?.length ?? 0} @ ${data.scannedAt}` +
          (data.memes ? ` · discovered ${data.memes.length}` : "")
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function discover() {
    setBusy(true);
    setLog("Discovering memecoins…");
    try {
      const res = await fetch("/api/trading/discover-memes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 15 }),
      });
      const data = await res.json();
      setLog(
        JSON.stringify(
          (data.candidates ?? []).slice(0, 10).map(
            (c: { id: string; source: string; rugRisk: string; change24h: number; liquidityUsd: number }) => ({
              id: c.id,
              source: c.source,
              rug: c.rugRisk,
              chg24: c.change24h,
              liq: c.liquidityUsd,
            })
          ),
          null,
          2
        )
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runCycle() {
    setBusy(true);
    setLog("Running bot cycle…");
    try {
      const res = await fetch("/api/trading/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      setLog(JSON.stringify({ actions: data.actions, equity: data.portfolio?.equity }, null, 2));
      if (data.topSignals) setSignals(data.topSignals);
      await refresh();
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPaper() {
    setBusy(true);
    try {
      await fetch("/api/trading/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await refresh();
      setLog("Paper portfolio reset.");
    } finally {
      setBusy(false);
    }
  }

  const p = status?.portfolio;

  return (
    <div className="side-panel">
      <div className="pane-label">Memecoin day trader</div>
      <p className="panel-copy">
        Finds and day-trades <strong>memecoins</strong> (CEX + filtered DEX). Strict rug gates,
        small size, fast scalps. <strong>Paper by default.</strong> Not financial advice —
        memes can go to zero.
      </p>

      <div className="status-card trade-warn">
        <ShieldAlert size={14} />
        <span>{status?.disclaimer ?? "Loading…"}</span>
      </div>

      {p ? (
        <div className="status-card" style={{ marginTop: "0.75rem" }}>
          <div>
            Equity <strong>{money(p.equity)}</strong> USDT · Cash {money(p.cash)}
          </div>
          <div className="muted">
            Day PnL {money(p.dayPnl)} · Realized {money(p.realizedPnl)} · Mode{" "}
            {status?.settings.mode}
          </div>
        </div>
      ) : null}

      <label className="host-allow" style={{ marginTop: "0.75rem" }}>
        <input
          type="checkbox"
          checked={autoTrade}
          disabled={busy}
          onChange={(e) => void saveAuto(e.target.checked)}
        />
        <span>
          <CandlestickChart size={14} /> Auto-trade best setups (paper)
        </span>
      </label>

      <div className="host-actions">
        <button type="button" className="send-btn" disabled={busy} onClick={() => void discover()}>
          Discover memes
        </button>
        <button type="button" className="send-btn" disabled={busy} onClick={() => void scan()}>
          <RefreshCw size={14} /> Scan best memes
        </button>
        <button type="button" className="send-btn" disabled={busy} onClick={() => void runCycle()}>
          <Play size={14} /> Run cycle
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={() => void resetPaper()}>
          Reset paper
        </button>
      </div>

      {p?.positions?.length ? (
        <div style={{ marginTop: "0.85rem" }}>
          <div className="pane-label">Open positions</div>
          <ul className="host-steps">
            {p.positions.map((pos) => (
              <li key={pos.symbol + pos.entry}>
                {pos.symbol} qty {pos.qty.toFixed(6)} @ {pos.entry} · SL {pos.stopLoss} · TP{" "}
                {pos.takeProfit} · {pos.strategy}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {signals.length ? (
        <div style={{ marginTop: "0.85rem" }}>
          <div className="pane-label">Ranked signals</div>
          <ul className="host-steps">
            {signals.slice(0, 8).map((s) => (
              <li key={s.symbol + s.strategy}>
                <strong>{s.symbol}</strong> {s.side} · {s.strategy} · conf{" "}
                {(s.confidence * 100).toFixed(0)}% · rug {s.rugRisk} · score {s.score.toFixed(2)}
                <div className="muted">{s.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {p?.fills?.length ? (
        <div style={{ marginTop: "0.85rem" }}>
          <div className="pane-label">Recent fills</div>
          <ul className="host-steps">
            {p.fills.slice(0, 6).map((f) => (
              <li key={f.at + f.symbol + f.side}>
                {f.side.toUpperCase()} {f.symbol} @ {f.price}
                {f.pnl != null ? ` · pnl ${money(f.pnl)}` : ""} — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {log ? <pre className="panel-log">{log}</pre> : null}
    </div>
  );
}
