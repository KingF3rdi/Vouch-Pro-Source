package dev.frameboost.mixin;

import dev.frameboost.client.FrameBoostCulling;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.client.render.block.entity.BlockEntityRenderDispatcher;
import net.minecraft.client.render.block.entity.BlockEntityRenderer;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(BlockEntityRenderDispatcher.class)
public abstract class BlockEntityRenderDispatcherMixin {
	@Inject(
			method = "get(Lnet/minecraft/block/entity/BlockEntity;)Lnet/minecraft/client/render/block/entity/BlockEntityRenderer;",
			at = @At("HEAD"),
			cancellable = true
	)
	private <E extends BlockEntity> void frameboost$skipFarBlockEntities(
			E blockEntity,
			CallbackInfoReturnable<BlockEntityRenderer<E>> cir
	) {
		// Camera position is resolved lazily via MinecraftClient when available.
		net.minecraft.client.MinecraftClient client = net.minecraft.client.MinecraftClient.getInstance();
		if (client == null || client.gameRenderer == null) {
			return;
		}
		Vec3d camera = client.gameRenderer.getCamera().getPos();
		if (FrameBoostCulling.shouldSkipBlockEntity(blockEntity, camera)) {
			cir.setReturnValue(null);
		}
	}
}
