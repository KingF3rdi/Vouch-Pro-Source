# OakFFA Anti Cheat

Prediction-first Paper anti-cheat for **OakFFA**, with LuckPerms permissions, setbacks, and staff tools.

## Requirements

- Java 17+
- Paper (or compatible) **1.20.4+** (`api-version: 1.20`)
- Optional: [LuckPerms](https://luckperms.net/)

## Build

```bash
cd minecraft-anticheat
./gradlew build
```

Jar: `build/libs/OakFFA-AntiCheat-1.0.0.jar`

## Architecture

1. **Simulation** — predicts plausible client ticks and measures **offset**
2. **Uncertainty** — ping, knockback, teleport, vehicle, 0.03 movement forgiven
3. **Setbacks** — illegal moves resync to last valid position
4. **TickAbuse** — timer / wrong-tick action bursts
5. **InvalidInput / InvalidAction** — forged key combos, dig spoof, reach, off-angle hits
6. **Heuristics** — bad packets, robotic aim, ghost-client brands/channels, Meteor sign probe

## Commands

| Command | Permission | Description |
| --- | --- | --- |
| `/ac logs [player]` | `ac.logs` | Latest bans (+ flags if `ac.flags`) |
| `/ban logs [player]` | `ac.logs` | Same as `/ac logs` |
| `/ac staff logs` | `ac.logs` | Staff command audit |
| `/ac ban` / `/ac ip ban` | `ac.ban` | Name / IP ban |
| `/ac clear` / `/ac wipe` | `ac.clear` / `ac.wipe` | Clear / full wipe |
| `/ac whitelist …` | `ac.admin` | Flag-only whitelist |
| `/ac reload` / `/ac info` | `ac.admin` | Reload / status |

Aliases: `/oakffa`, `/oakffaac`, `/anticheat`

## LuckPerms

`ac.admin` includes every `ac.*` permission.

```
/lp group admin permission set ac.admin true
/lp group mod permission set ac.flags true
/lp group mod permission set ac.logs true
```
