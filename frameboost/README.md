# FrameBoost 1.1

Aggressive client-side Fabric performance companion for **Minecraft 1.21.1**.

Does **not** replace the chunk renderer. Use with:

- [Sodium](https://modrinth.com/mod/sodium) (recommended), **or**
- [VulkanMod](https://modrinth.com/mod/vulkanmod)

**Never both.** They conflict. FrameBoost stacks on top of either.

## What 1.1 does harder

| Feature | Default |
|--------|---------|
| Particle hard cap | **256** |
| Entity hard cull | **48** blocks × 0.55 |
| Item/XP cull | **28** blocks |
| Block-entity cull | **40** blocks |
| Armor-stand cull | aggressive |
| Beacon beam cull | 64 blocks |
| Entity shadows | **off** |
| Clouds | **off** |
| Weather + rain splash | **off** |
| Ambient drip/ash particles | **off** |
| Vignette / portal overlay | **off** |
| View bob + hurt tilt | **off** |
| Shorter fog | **on** (0.72×) |
| Lightmap throttle | every 2 ticks |
| Unfocused FPS | **15** |

Players + camera entity always stay visible.

## Install

1. Fabric Loader + Fabric API (1.21.1)  
2. Sodium **or** VulkanMod  
3. `frameboost-1.1.0.jar` → `mods/`  
4. Optional: edit `.minecraft/config/frameboost.json`

## Build

```bash
cd frameboost
./gradlew build
```

## Honest FPS note

Sodium/VulkanMod = big chunk win. FrameBoost = leftover entity/particle/overlay/fog cost.  
Busy servers / mob farms / item spam → often large uplift. Empty singleplayer meadows → smaller.
