# HelixAC

Prediction-first Paper anti-cheat (Grim-inspired) with LuckPerms permissions, setbacks, and staff tools.

## Requirements

- Java 17+
- Paper (or compatible) **1.20.4+** (`api-version: 1.20`)
- Optional: [LuckPerms](https://luckperms.net/)

## Build

```bash
cd minecraft-anticheat
./gradlew build
```

Jar: `build/libs/HelixAC-1.0.0.jar`

## Architecture (Grim-like)

1. **Simulation** — predicts plausible client ticks (inputs × friction/gravity/jump) and measures **offset**
2. **Uncertainty** — ping, knockback, teleport, vehicle, 0.03 movement forgiven
3. **Setbacks** — illegal moves resync to last valid position (don’t ban on first hit)
4. **TickAbuse** — timer / wrong-tick action bursts (streak + balance buffer)
5. **Heuristics** — bad packets, robotic aim, ghost-client brands/channels, Meteor sign probe

Bans still require sustained flags (`punishment.flag-threshold`), not a single prediction miss.

## Commands

| Command | Permission | Description |
| --- | --- | --- |
| `/ac logs [player]` | `ac.logs` | Latest bans (+ flags if `ac.flags`) |
| `/ban logs [player]` | `ac.logs` | Same as `/ac logs` |
| `/ac staff logs` | `ac.logs` | Staff command audit |
| `/ac ban <player> <duration> <reason>` | `ac.ban` | Name-ban |
| `/ac ip ban <player> <duration> <reason>` | `ac.ban` | IP-ban |
| `/ac clear <player>` | `ac.clear` | Clear inventory |
| `/ac wipe <player>` | `ac.wipe` | Inv + EC + XP + stats |
| `/ac whitelist …` | `ac.admin` | Flag-only whitelist |
| `/ac reload` / `/ac info` | `ac.admin` | Reload / status |

## LuckPerms

`ac.admin` includes **every** `ac.*` permission.

```
ac.flags   # live flags + flag lines in logs
ac.logs    # /ac logs, /ban logs, /ac staff logs
ac.ban / ac.clear / ac.wipe
ac.bypass / ac.whitelist
ac.notify / ac.staff
```

```
/lp group admin permission set ac.admin true
/lp group mod permission set ac.flags true
/lp group mod permission set ac.logs true
```

## Config highlights

- `setbacks.enabled`
- `checks.simulation.*` — offset threshold + streak
- `checks.tick-abuse.*` — timer / action rates
- `punishment.flag-threshold` — flags before 7d ban

## Honest note

Full Grim parity needs packet-level NMS / PacketEvents and a compensated world. HelixAC brings the same **prediction → uncertainty → setback → escalate** loop on the Paper API, tuned to avoid easy false bans.
