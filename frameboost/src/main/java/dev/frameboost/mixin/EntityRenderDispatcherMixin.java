package dev.frameboost.mixin;

import dev.frameboost.client.FrameBoostCulling;
import net.minecraft.client.render.Frustum;
import net.minecraft.client.render.entity.EntityRenderDispatcher;
import net.minecraft.entity.Entity;
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
		if (FrameBoostCulling.shouldSkipEntity(entity, x, y, z)) {
			cir.setReturnValue(false);
		}
	}
}
