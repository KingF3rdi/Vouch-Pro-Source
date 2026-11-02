# FrameBoost

Client-side Fabric performance companion for **Minecraft 1.21.1**.

It does **not** replace the chunk renderer. Install **either**:

- [Sodium](https://modrinth.com/mod/sodium) (OpenGL, recommended), **or**
- [VulkanMod](https://modrinth.com/mod/vulkanmod) (Vulkan)

Do **not** run Sodium and VulkanMod together — they conflict. FrameBoost stacks on top of whichever one you pick.

## What it does

| Feature | Default | Effect |
|--------|---------|--------|
| Particle hard cap | 512 | Stops particle FPS spikes |
| Entity distance cull | 64 blocks × 0.65 | Fewer entity draws |
| Disable entity shadows | on | Big win on weak GPUs |
| Shorter terrain fog | on | Less overdraw |
| Unfocused FPS cap | 30 | Saves CPU/GPU in background |
| Optional: no clouds / weather / view bob | off | Extra toggles in config |

**Honest note:** Nobody can guarantee “2× FPS” on every PC. Sodium/VulkanMod do the heavy lifting; FrameBoost cuts leftover entity/particle/fog cost. On busy servers/mob farms the uplift is often large; in empty worlds it’s smaller.

## Install

1. Fabric Loader + Fabric API for 1.21.1  
2. Sodium **or** VulkanMod  
3. Drop `frameboost-1.0.0.jar` into `.minecraft/mods`  
4. (Optional) Edit `.minecraft/config/frameboost.json`

## Build

```bash
cd frameboost
./gradlew build
```

JAR output: `build/libs/frameboost-1.0.0.jar`

## Config (`config/frameboost.json`)

```json
{
  "maxParticles": 512,
  "entityRenderDistanceScale": 0.65,
  "entityHardCullDistance": 64.0,
  "disableEntityShadows": true,
  "reduceFog": true,
  "disableClouds": false,
  "disableWeatherRendering": false,
  "unfocusedFpsLimit": 30,
  "disableViewBobbing": false,
  "hardParticleCap": true
}
```

Aggressive profile (more FPS, less pretty): set `disableClouds` + `disableWeatherRendering` to `true`, `entityHardCullDistance` to `48`, `maxParticles` to `256`.
