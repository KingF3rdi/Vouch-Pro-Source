package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
	@Inject(method = "renderVignetteOverlay", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipVignette(DrawContext context, Entity entity, CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.enabled && FrameBoostConfig.INSTANCE.disableVignette) {
			ci.cancel();
		}
	}

	@Inject(method = "renderPortalOverlay", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipPortal(DrawContext context, float nauseaStrength, CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.enabled && FrameBoostConfig.INSTANCE.disableNauseaOverlay) {
			ci.cancel();
		}
	}
}
