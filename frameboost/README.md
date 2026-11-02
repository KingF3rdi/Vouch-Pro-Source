# FrameBoost 1.2 — PvP FPS profile

Fabric **1.21.1** client companion for **Sodium** *or* **VulkanMod** (not both).

Built for **crystal / pot / dia PvP**: clearer fights + higher FPS.  
**No combat cheats** (no aura, reach, ESP, velocity…).

## PvP defaults

| Behavior | Default |
|----------|---------|
| `pvpMode` | **on** |
| Never hide | players, pearls, arrows, tridents, pots, crystals, projectiles |
| Mob cull | **28** blocks (aggressive) |
| Item/XP cull | **36** (totems/gaps still visible) |
| Particles | ≤ **128**, explosion/smoke/totem clutter cut ~80% |
| Potion swirls | reduced |
| Hurtcam | **off** |
| View bob + hand swing bob | **off** |
| Totem fullscreen anim | **off** |
| Nausea / vignette / portal | **off** |
| Clouds / weather / shadows | **off** |

## Install

1. Fabric Loader + Fabric API  
2. Sodium **or** VulkanMod  
3. `frameboost-1.2.0.jar` → `mods/`

Config: `.minecraft/config/frameboost.json`

## Build

```bash
cd frameboost && ./gradlew build
```
