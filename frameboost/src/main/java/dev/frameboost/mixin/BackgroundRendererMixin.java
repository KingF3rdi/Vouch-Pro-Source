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
	@Inject(method = "applyFog", at = @At("TAIL"))
	private static void frameboost$shortenFog(
			Camera camera,
			BackgroundRenderer.FogType fogType,
			float viewDistance,
			boolean thickenFog,
			float tickDelta,
			CallbackInfo ci
	) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || !cfg.reduceFog) {
			return;
		}
		if (fogType != BackgroundRenderer.FogType.FOG_TERRAIN) {
			return;
		}
		float start = RenderSystem.getShaderFogStart();
		float end = RenderSystem.getShaderFogEnd();
		if (end > start) {
			float scale = Math.max(0.35f, Math.min(1.0f, cfg.fogLengthScale));
			float shortened = start + (end - start) * scale;
			RenderSystem.setShaderFogStart(start);
			RenderSystem.setShaderFogEnd(shortened);
			RenderSystem.setShaderFogShape(FogShape.CYLINDER);
		}
	}
}
