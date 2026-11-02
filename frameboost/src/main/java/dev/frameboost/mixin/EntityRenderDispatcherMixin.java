package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.render.Frustum;
import net.minecraft.client.render.entity.EntityRenderDispatcher;
import net.minecraft.entity.Entity;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(EntityRenderDispatcher.class)
public abstract class EntityRenderDispatcherMixin {
	@Inject(
			method = "shouldRender(Lnet/minecraft/entity/Entity;Lnet/minecraft/client/render/Frustum;DDD)Z",
			at = @At("HEAD"),
			cancellable = true
	)
	private void frameboost$cullDistantEntities(
			Entity entity,
			Frustum frustum,
			double x,
			double y,
			double z,
			CallbackInfoReturnable<Boolean> cir
	) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		double hard = cfg.entityHardCullDistance;
		if (hard <= 0.0) {
			return;
		}

		double scale = Math.max(0.15, cfg.entityRenderDistanceScale);
		double max = hard * scale;
		double maxSq = max * max;

		Vec3d pos = entity.getPos();
		double dx = pos.x - x;
		double dy = pos.y - y;
		double dz = pos.z - z;
		if (dx * dx + dy * dy + dz * dz > maxSq) {
			cir.setReturnValue(false);
		}
	}
}
