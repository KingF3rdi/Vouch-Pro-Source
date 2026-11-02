package dev.frameboost.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * PvP-first performance profile. Stacks with Sodium / VulkanMod.
 * Clarity + FPS — not combat cheats.
 */
public final class FrameBoostConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("frameboost.json");

	public static FrameBoostConfig INSTANCE = new FrameBoostConfig();

	public boolean enabled = true;

	/**
	 * PvP profile: never hide players / pearls / arrows / crystals;
	 * cut explosion/potion clutter; disable hurtcam/bob.
	 */
	public boolean pvpMode = true;

	/** Max particles alive at once. Lower = clearer fights + more FPS. */
	public int maxParticles = 128;

	public double entityRenderDistanceScale = 0.50;

	/** Generic mob / entity cull distance. */
	public double entityHardCullDistance = 40.0;

	/** Dropped items / XP (totems, gaps matter in PvP — keep a bit farther). */
	public double itemEntityCullDistance = 36.0;

	/** Hostile/passive mobs get this tighter cull in pvpMode. */
	public double mobCullDistance = 28.0;

	public double blockEntityCullDistance = 32.0;

	public boolean keepPlayersVisible = true;

	/** Pearls, arrows, tridents, potions, crystals, fireballs. */
	public boolean keepCombatProjectilesVisible = true;

	public boolean disableEntityShadows = true;

	public boolean reduceFog = true;

	public float fogLengthScale = 0.68f;

	public boolean disableClouds = true;

	public boolean disableWeatherRendering = true;

	public boolean disableWeatherParticles = true;

	/** Cut explosion / crystal blast smoke that hides enemies. */
	public boolean reduceCombatClutterParticles = true;

	/** Soften potion swirl / effect particles. */
	public boolean reducePotionParticles = true;

	/** Skip totem pop fullscreen animation (less blind frames). */
	public boolean disableTotemAnimation = true;

	public int unfocusedFpsLimit = 10;

	public boolean disableViewBobbing = true;

	/** Separate hurt-cam kill — critical for PvP aim. */
	public boolean disableHurtCam = true;

	public boolean hardParticleCap = true;

	public boolean disableVignette = true;

	public boolean disableNauseaOverlay = true;

	public boolean throttleLightmap = true;

	public int lightmapUpdateInterval = 3;

	public double beaconBeamCullDistance = 48.0;

	public boolean aggressiveArmorStandCull = true;

	public static void load() {
		if (Files.exists(PATH)) {
			try (Reader reader = Files.newBufferedReader(PATH)) {
				FrameBoostConfig loaded = GSON.fromJson(reader, FrameBoostConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				System.err.println("[FrameBoost] Failed to read config, using defaults: " + e.getMessage());
			}
		}
		save();
	}

	public static void save() {
		try {
			Files.createDirectories(PATH.getParent());
			try (Writer writer = Files.newBufferedWriter(PATH)) {
				GSON.toJson(INSTANCE, writer);
			}
		} catch (IOException e) {
			System.err.println("[FrameBoost] Failed to write config: " + e.getMessage());
		}
	}
}
