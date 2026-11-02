package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.item.HeldItemRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(HeldItemRenderer.class)
public abstract class HeldItemRendererSwingMixin {
	/**
	 * Flatten first-person swing/equip bob in PvP mode for a calmer viewmodel.
	 */
	@ModifyVariable(
			method = "renderFirstPersonItem(Lnet/minecraft/client/network/AbstractClientPlayerEntity;FFLnet/minecraft/util/Hand;FLnet/minecraft/item/ItemStack;FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V",
			at = @At("HEAD"),
			argsOnly = true,
			ordinal = 0
	)
	private float frameboost$flatSwing(float swingProgress) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (cfg.enabled && cfg.pvpMode && cfg.disableViewBobbing) {
			return 0.0f;
		}
		return swingProgress;
	}

	@ModifyVariable(
			method = "renderFirstPersonItem(Lnet/minecraft/client/network/AbstractClientPlayerEntity;FFLnet/minecraft/util/Hand;FLnet/minecraft/item/ItemStack;FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V",
			at = @At("HEAD"),
			argsOnly = true,
			ordinal = 1
	)
	private float frameboost$flatEquip(float equipProgress) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (cfg.enabled && cfg.pvpMode && cfg.disableViewBobbing) {
			return 0.0f;
		}
		return equipProgress;
	}
}
