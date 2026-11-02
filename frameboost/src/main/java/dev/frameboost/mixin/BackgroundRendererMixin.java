package dev.frameboost.mixin;

import com.mojang.blaze3d.systems.RenderSystem;
import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.BackgroundRenderer;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.FogShape;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(BackgroundRenderer.class)
public abstract class BackgroundRendererMixin {
	/**
	 * After vanilla fog apply, push a slightly shorter fog end for cheaper overdraw.
	 * Safe with Sodium; VulkanMod may ignore GL fog — then this is a no-op.
	 */
	@Inject(method = "applyFog", at = @At("TAIL"))
	private static void frameboost$shortenFog(
			Camera camera,
			BackgroundRenderer.FogType fogType,
			float viewDistance,
			boolean thickenFog,
			float tickDelta,
			CallbackInfo ci
	) {
		if (!FrameBoostConfig.INSTANCE.reduceFog) {
			return;
		}
		if (fogType != BackgroundRenderer.FogType.FOG_TERRAIN) {
			return;
		}
		float start = RenderSystem.getShaderFogStart();
		float end = RenderSystem.getShaderFogEnd();
		if (end > start) {
			float shortened = start + (end - start) * 0.82f;
			RenderSystem.setShaderFogStart(start);
			RenderSystem.setShaderFogEnd(shortened);
			RenderSystem.setShaderFogShape(FogShape.CYLINDER);
		}
	}
}
