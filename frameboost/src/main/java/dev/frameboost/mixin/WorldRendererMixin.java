package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.WorldRenderer;
import net.minecraft.client.util.math.MatrixStack;
import org.joml.Matrix4f;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(WorldRenderer.class)
public abstract class WorldRendererMixin {
	@Inject(method = "renderWeather", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipWeather(CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.disableWeatherRendering) {
			ci.cancel();
		}
	}

	@Inject(
			method = "renderClouds(Lnet/minecraft/client/util/math/MatrixStack;Lorg/joml/Matrix4f;Lorg/joml/Matrix4f;FDDD)V",
			at = @At("HEAD"),
			cancellable = true
	)
	private void frameboost$skipClouds(
			MatrixStack matrices,
			Matrix4f matrix4f,
			Matrix4f matrix4f2,
			float tickDelta,
			double cameraX,
			double cameraY,
			double cameraZ,
			CallbackInfo ci
	) {
		if (FrameBoostConfig.INSTANCE.disableClouds) {
			ci.cancel();
		}
	}
}
