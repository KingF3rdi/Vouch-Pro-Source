package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.LightmapTextureManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LightmapTextureManager.class)
public abstract class LightmapTextureManagerMixin {
	@Unique
	private int frameboost$skipCounter;

	@Inject(method = "update", at = @At("HEAD"), cancellable = true)
	private void frameboost$throttleLightmap(float delta, CallbackInfo ci) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || !cfg.throttleLightmap) {
			return;
		}
		int interval = Math.max(1, cfg.lightmapUpdateInterval);
		if (++frameboost$skipCounter % interval != 0) {
			// Still allow update when the world just loaded / player changed dimension.
			MinecraftClient client = MinecraftClient.getInstance();
			if (client != null && client.player != null && client.player.age > 20) {
				ci.cancel();
			}
		}
	}
}
