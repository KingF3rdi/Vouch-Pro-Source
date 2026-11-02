package dev.frameboost.client;

import dev.frameboost.config.FrameBoostConfig;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class FrameBoostClient implements ClientModInitializer {
	public static final String MOD_ID = "frameboost";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeClient() {
		FrameBoostConfig.load();

		boolean sodium = FabricLoader.getInstance().isModLoaded("sodium");
		boolean vulkan = FabricLoader.getInstance().isModLoaded("vulkanmod");

		if (sodium && vulkan) {
			LOGGER.warn("Sodium + VulkanMod together usually crash/conflict — pick ONE. FrameBoost still applies culls.");
		} else if (sodium) {
			LOGGER.info("Sodium detected — FrameBoost stacks (entities/particles/fog/overlays).");
		} else if (vulkan) {
			LOGGER.info("VulkanMod detected — FrameBoost stacks (entities/particles/overlays).");
		} else {
			LOGGER.info("Install Sodium (recommended) OR VulkanMod under FrameBoost for max FPS.");
		}

		FrameBoostConfig c = FrameBoostConfig.INSTANCE;
		LOGGER.info(
				"FrameBoost v1.1 ready | particles≤{} | entityCull={} | itemCull={} | BE cull={} | clouds={} | weather={}",
				c.maxParticles,
				c.entityHardCullDistance,
				c.itemEntityCullDistance,
				c.blockEntityCullDistance,
				!c.disableClouds,
				!c.disableWeatherRendering
		);
	}
}
