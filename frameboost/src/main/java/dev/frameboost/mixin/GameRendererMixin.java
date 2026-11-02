package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
	@Shadow
	private ItemStack floatingItem;

	@Shadow
	private int floatingItemTimeLeft;

	@Inject(method = "bobView", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipBob(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.enabled && FrameBoostConfig.INSTANCE.disableViewBobbing) {
			ci.cancel();
		}
	}

	@Inject(method = "tiltViewWhenHurt", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipHurtCam(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (cfg.enabled && (cfg.disableHurtCam || cfg.pvpMode || cfg.disableViewBobbing)) {
			ci.cancel();
		}
	}

	@Inject(method = "showFloatingItem", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipTotemAnim(ItemStack floatingItem, CallbackInfo ci) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || !cfg.disableTotemAnimation) {
			return;
		}
		if (floatingItem != null && floatingItem.isOf(Items.TOTEM_OF_UNDYING)) {
			ci.cancel();
		}
	}

	@Inject(method = "tick", at = @At("HEAD"))
	private void frameboost$clearTotemAnim(CallbackInfo ci) {
		// If something else queued a totem float, drop it in PvP profile.
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || !cfg.disableTotemAnimation) {
			return;
		}
		if (this.floatingItem != null && this.floatingItem.isOf(Items.TOTEM_OF_UNDYING)) {
			this.floatingItem = ItemStack.EMPTY;
			this.floatingItemTimeLeft = 0;
		}
	}

	@Inject(method = "renderNausea", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipNausea(net.minecraft.client.gui.DrawContext context, float distortionScale, CallbackInfo ci) {
		if (FrameBoostConfig.INSTANCE.enabled && FrameBoostConfig.INSTANCE.disableNauseaOverlay) {
			ci.cancel();
		}
	}
}
