package dev.frameboost.mixin;

import dev.frameboost.client.FrameBoostCulling;
import net.minecraft.block.entity.BeaconBlockEntity;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.block.entity.BeaconBlockEntityRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(BeaconBlockEntityRenderer.class)
public abstract class BeaconBlockEntityRendererMixin {
	@Inject(
			method = "render(Lnet/minecraft/block/entity/BeaconBlockEntity;FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;II)V",
			at = @At("HEAD"),
			cancellable = true
	)
	private void frameboost$cullBeaconBeam(
			BeaconBlockEntity beaconBlockEntity,
			float tickDelta,
			MatrixStack matrices,
			VertexConsumerProvider vertexConsumers,
			int light,
			int overlay,
			CallbackInfo ci
	) {
		MinecraftClient client = MinecraftClient.getInstance();
		if (client == null || client.gameRenderer == null) {
			return;
		}
		Vec3d camera = client.gameRenderer.getCamera().getPos();
		if (FrameBoostCulling.shouldSkipBeaconBeam(beaconBlockEntity.getPos(), camera)) {
			ci.cancel();
		}
	}
}
