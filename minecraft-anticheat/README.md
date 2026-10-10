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
- **Meteor sign technique** — on join, opens a probe sign with a Meteor-only translation key; resolved text → kick
- **Staff command log** — every staff command recorded for `/ac staff logs`
- **Auto-ban** — after enough flags in a window → **7-day** ban with reason listing checks
- **Whitelist** — still flags, never auto-bans
- **Bypass** — complete exemption from checks

## Commands

| Command | Permission | Description |
| --- | --- | --- |
| `/ac logs [player]` | `ac.logs` | Latest bans (+ flags if `ac.flags`) |
| `/ban logs [player]` | `ac.logs` | **Same as** `/ac logs` (does not steal normal `/ban`) |
| `/ac staff logs` | `ac.logs` | Latest staff commands (player + command) |
| `/ac ban <player> <duration> <reason>` | `ac.ban` | Easy name-ban |
| `/ac ip ban <player> <duration> <reason>` | `ac.ban` | IP-ban (+ name-ban); needs a seen IP |
| `/ac clear <player>` | `ac.clear` | Clear player inventory (armor/offhand too) |
| `/ac wipe <player>` | `ac.wipe` | Wipe inventory, ender chest, XP, effects, stats |
| `/ac whitelist add\|remove\|list [player]` | `ac.admin` | Manage AC whitelist |
| `/ac reload` | `ac.admin` | Reload config |
| `/ac info` | `ac.admin` | Status / LuckPerms / checks |

Duration examples: `7d`, `12h`, `30m`, `1w`, `permanent` (bare numbers = days).

## LuckPerms permissions

```
ac.flags      # See live flag alerts + flag lines in logs
ac.ban        # /ac ban and /ac ip ban
ac.clear      # /ac clear <player>
ac.wipe       # /ac wipe <player> (inv + EC + stats)
ac.logs       # Log commands (/ac logs, /ban logs, /ac staff logs)
ac.admin      # whitelist / reload / info (includes all staff perms above)
ac.bypass     # Completely bypasses HelixAC (no flags, no bans)
ac.whitelist  # Flags normally but never auto-banned
ac.banlogs    # Only /ac logs and /ban logs (also granted by ac.logs)
ac.stafflogs  # Only /ac staff logs (also granted by ac.logs)
ac.staff      # Marks player as staff for command logging
ac.notify     # Ban/punishment broadcasts
```

Examples:

```
/lp group mod permission set ac.flags true
/lp group mod permission set ac.ban true
/lp group mod permission set ac.clear true
/lp group mod permission set ac.wipe true
/lp group mod permission set ac.logs true
/lp group admin permission set ac.admin true
/lp user Steve permission set ac.bypass true
/lp user Alex permission set ac.whitelist true
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
