# HelixAC

Professional Paper/Spigot anti-cheat plugin with LuckPerms-compatible permissions.

## Requirements

- Java 17+
- Paper (or compatible) **1.20.4+** (`api-version: 1.20`)
- Optional: [LuckPerms](https://luckperms.net/) for permission management

## Build

```bash
cd minecraft-anticheat
./gradlew build
```

Jar output: `build/libs/HelixAC-1.0.0.jar`

Drop the jar into your server `plugins/` folder and restart.

## Features

- **Invalid packets** — NaN/Inf positions, illegal pitch, out-of-bounds coords
- **Invalid movement** — impossible horizontal/vertical deltas from forged move packets
- **Robotic rotation** — identical yaw/pitch deltas, frozen-pitch snaps, constant micro-steps (aimbot-like)
- **Bad packets** — onGround while falling, sprint+sneak, impossible yaw wraps
- **Ghost client heuristics** — suspicious client brands and plugin channels (Vape / Prestige style indicators)
- **Auto-ban** — after enough flags in a window → **7-day** ban with reason listing checks
- **Whitelist** — still flags, never auto-bans
- **Bypass** — complete exemption from checks

## Commands

| Command | Permission | Description |
| --- | --- | --- |
| `/ac logs` | `ac.admin` | Latest flags and bans (with ban reasons / flag checks) |
| `/ac whitelist add\|remove\|list [player]` | `ac.admin` | Manage AC whitelist |
| `/ac banlogs <player>` | `ac.admin` | Player ban + flag history |
| `/ban logs <player>` | `ac.banlogs` | Same history (intercepted; does not steal normal `/ban`) |
| `/ac reload` | `ac.admin` | Reload config |
| `/ac info` | `ac.admin` | Status / LuckPerms / checks |

## LuckPerms permissions

```
ac.bypass      # Completely bypasses HelixAC (no flags, no bans)
ac.whitelist  # Flags normally but never auto-banned
ac.admin      # /ac commands
ac.banlogs    # /ban logs <player>
ac.notify     # Live flag notifications
```

Examples:

```
/lp user Steve permission set ac.bypass true
/lp user Alex permission set ac.whitelist true
/lp group admin permission set ac.admin true
/lp group mod permission set ac.banlogs true
/lp group mod permission set ac.notify true
```

## Config highlights

See `config.yml`:

- `punishment.flag-threshold` (default `25`)
- `punishment.flag-decay-seconds` (default `600`)
- `punishment.ban-duration-days` (default `7`)
- Per-check enable/weight/max-vl
- Ghost-client channel/brand lists

## Data files

Created under `plugins/HelixAC/`:

- `config.yml`
- `whitelist.yml`
- `logs.yml` — persisted flags and bans for `/ac logs` and `/ban logs`

## Notes on ghost clients

Commercial clients (Vape, Prestige, etc.) rotate private payloads. HelixAC uses **public heuristics** (brand strings, channel names, payload keywords, robotic aim patterns). This is not a guaranteed fingerprint of any paid client, and false positives are possible if you add overly broad brand rules.
