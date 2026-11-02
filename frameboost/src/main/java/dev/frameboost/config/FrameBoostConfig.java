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
 * Aggressive-by-default tunables that stack with Sodium / VulkanMod.
 */
public final class FrameBoostConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("frameboost.json");

	public static FrameBoostConfig INSTANCE = new FrameBoostConfig();

	/** Master switch. */
	public boolean enabled = true;

	/** Max particles alive at once. */
	public int maxParticles = 256;

	/** Extra entity render-distance multiplier (1.0 = vanilla). */
	public double entityRenderDistanceScale = 0.55;

	/** Hard entity cull distance in blocks (after scale). 0 = off. */
	public double entityHardCullDistance = 48.0;

	/** Tighter cull for dropped items / XP orbs. */
	public double itemEntityCullDistance = 28.0;

	/** Cull distance for block entities (chests, signs, skulls…). */
	public double blockEntityCullDistance = 40.0;

	/** Always render players + the camera entity. */
	public boolean keepPlayersVisible = true;

	/** Don't render entity shadows. */
	public boolean disableEntityShadows = true;

	/** Shorter / cheaper terrain fog. */
	public boolean reduceFog = true;

	/** Fog length multiplier when reduceFog is on (lower = more FPS). */
	public float fogLengthScale = 0.72f;

	/** Skip cloud rendering. */
	public boolean disableClouds = true;

	/** Skip weather (rain/snow) rendering. */
	public boolean disableWeatherRendering = true;

	/** Skip rain splash / drip ambient particles. */
	public boolean disableWeatherParticles = true;

	/** Cap FPS when the window is unfocused. */
	public int unfocusedFpsLimit = 15;

	/** Disable view bobbing. */
	public boolean disableViewBobbing = true;

	/** Drop particle spawns when over the cap. */
	public boolean hardParticleCap = true;

	/** Skip vignette overlay. */
	public boolean disableVignette = true;

	/** Skip portal / nausea overlay distortion. */
	public boolean disableNauseaOverlay = true;

	/** Throttle lightmap updates (smoother FPS on CPU-bound PCs). */
	public boolean throttleLightmap = true;

	/** Only update lightmap every N client ticks when throttling. */
	public int lightmapUpdateInterval = 2;

	/** Skip beacon beams beyond this distance (blocks). 0 = always render. */
	public double beaconBeamCullDistance = 64.0;

	/** Skip armor stands beyond entity cull (they are expensive). */
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
