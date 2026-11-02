package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
	@Shadow
	public abstract boolean isWindowFocused();

	@Inject(method = "getFramerateLimit", at = @At("HEAD"), cancellable = true)
	private void frameboost$limitUnfocused(CallbackInfoReturnable<Integer> cir) {
		int cap = FrameBoostConfig.INSTANCE.unfocusedFpsLimit;
		if (cap > 0 && !this.isWindowFocused()) {
			cir.setReturnValue(Math.max(10, cap));
		}
	}
}
