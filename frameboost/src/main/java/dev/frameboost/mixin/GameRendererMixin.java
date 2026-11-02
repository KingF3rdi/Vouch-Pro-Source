package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
	@Inject(method = "bobView", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipBob(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.disableViewBobbing) {
			ci.cancel();
		}
	}
}
