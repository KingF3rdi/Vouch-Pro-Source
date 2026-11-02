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
			LOGGER.warn("Sodium and VulkanMod are both loaded. They usually conflict — pick ONE renderer. FrameBoost still applies entity/particle cuts.");
		} else if (sodium) {
			LOGGER.info("Sodium detected — FrameBoost stacks on top (no chunk-meshing conflict).");
		} else if (vulkan) {
			LOGGER.info("VulkanMod detected — FrameBoost stacks on top (no chunk-meshing conflict).");
		} else {
			LOGGER.info("No Sodium/VulkanMod found. FrameBoost still helps; install Sodium (OpenGL) OR VulkanMod (Vulkan) for best FPS.");
		}

		LOGGER.info("FrameBoost ready | particles≤{} | entityScale={} | shadows={}",
				FrameBoostConfig.INSTANCE.maxParticles,
				FrameBoostConfig.INSTANCE.entityRenderDistanceScale,
				!FrameBoostConfig.INSTANCE.disableEntityShadows);
	}
}
