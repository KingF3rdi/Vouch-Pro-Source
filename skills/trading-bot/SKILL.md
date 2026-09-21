---
name: Trading bot
description: Memecoin-focused paper day trader — discover, rug-filter, auto scalp. Live gated.
---

# Helix memecoin trading bot

Optimized to **day-trade memecoins** for the user (paper by default).

## Truths

- Memecoins are extremely volatile. **Not financial advice. No profit guarantee.**
- Default universe: liquid CEX memes (DOGE, PEPE, WIF, BONK, …) + optional DEX discovers.
- High rug-risk DEX tokens are **never** auto-entered.
- Live exchange routing stays gated.

## Workflow

1. `trading_discover_memes` — CEX watchlist + DexScreener boosts after rug gate.
2. `trading_scan` — meme breakout/pullback signals + DEX momentum.
3. `trading_run_cycle` — manage SL/TP; if `autoTrade`, enter best filtered meme.
4. `trading_rug_check` before any unknown ticker.

## Meme rules Helix applies

- Prefer CEX-listed memes over fresh DEX launches.
- DEX min liquidity / min age floors (`minMemeLiquidityUsd`, `minMemeAgeHours`).
- Skip parabolic 1h spikes and buy-heavy pump patterns.
- Smaller size, tighter stops, faster take-profit than blue chips.
- Daily loss circuit breaker still applies.
