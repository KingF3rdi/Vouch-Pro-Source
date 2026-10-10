# OakFFA Anti Cheat

Paper anti-cheat for OakFFA with LuckPerms, setbacks, and staff tools.

## Requirements

- Java 17+
- Paper 1.20.4+ (`api-version: 1.20`)
- Optional: [LuckPerms](https://luckperms.net/)

## Build

```bash
cd minecraft-anticheat
./gradlew build
```

Jar: `build/libs/OakFFA-AntiCheat-1.0.0.jar`

## Checks

Simulation, TickAbuse, InvalidInput, InvalidAction, PrestigeCombat, CombatUtility, IllegalPlace, BadPackets, RoboticRotation, GhostClient, MeteorSign

## Anti-indicators

Spoofs other players' health metadata and armor / max-health attributes in outbound packets so health-indicator and armor-stat mods cannot read real values. Also clears below-name health scoreboards.

Bypass receiving spoofed packets: `ac.seeindicators` (also included in `ac.admin`).

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

Aliases: `/ac`, `/oakffaac`

## LuckPerms

`ac.admin` includes every `ac.*` permission.

```
/lp group admin permission set ac.admin true
/lp group mod permission set ac.flags true
/lp group mod permission set ac.logs true
```
