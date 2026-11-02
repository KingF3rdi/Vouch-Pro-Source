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
			LOGGER.warn("Sodium + VulkanMod conflict — pick ONE renderer.");
		} else if (sodium) {
			LOGGER.info("Sodium + FrameBoost PvP profile.");
		} else if (vulkan) {
			LOGGER.info("VulkanMod + FrameBoost PvP profile.");
		} else {
			LOGGER.info("Add Sodium (best) or VulkanMod under FrameBoost.");
		}

		FrameBoostConfig c = FrameBoostConfig.INSTANCE;
		LOGGER.info(
				"FrameBoost 1.2 PvP | pvpMode={} | particles≤{} | mobCull={} | hurtCam={} | totemAnim={}",
				c.pvpMode,
				c.maxParticles,
				c.mobCullDistance,
				!c.disableHurtCam,
				!c.disableTotemAnimation
		);
	}
}
