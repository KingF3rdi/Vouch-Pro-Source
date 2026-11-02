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
 * Tunables that stack with Sodium / VulkanMod without replacing chunk meshing.
 */
public final class FrameBoostConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("frameboost.json");

	public static FrameBoostConfig INSTANCE = new FrameBoostConfig();

	/** Max particles alive at once. Vanilla can explode during fights/weather. */
	public int maxParticles = 512;

	/** Extra entity render-distance multiplier (1.0 = vanilla). Lower = more FPS. */
	public double entityRenderDistanceScale = 0.65;

	/** Skip rendering entities farther than this (blocks), after scale. 0 = disabled. */
	public double entityHardCullDistance = 64.0;

	/** Don't render entity shadows (big win on low-end GPUs). */
	public boolean disableEntityShadows = true;

	/** Thinner / cheaper fog. */
	public boolean reduceFog = true;

	/** Skip cloud rendering. Sodium already helps; this is extra. */
	public boolean disableClouds = false;

	/** Skip weather (rain/snow) rendering. */
	public boolean disableWeatherRendering = false;

	/** Cap FPS when the window is unfocused. */
	public int unfocusedFpsLimit = 30;

	/** Disable view bobbing (tiny CPU/feel tweak). */
	public boolean disableViewBobbing = false;

	/** Drop particle spawn attempts when over the cap instead of queueing. */
	public boolean hardParticleCap = true;

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
