package dev.frameboost.client;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.ExperienceOrbEntity;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

public final class FrameBoostCulling {
	private FrameBoostCulling() {}

	public static boolean shouldSkipEntity(Entity entity, double cameraX, double cameraY, double cameraZ) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled) {
			return false;
		}

		MinecraftClient client = MinecraftClient.getInstance();
		if (client != null && entity == client.getCameraEntity()) {
			return false;
		}
		if (cfg.keepPlayersVisible && entity instanceof PlayerEntity) {
			return false;
		}

		double max = cfg.entityHardCullDistance;
		if (entity instanceof ItemEntity || entity instanceof ExperienceOrbEntity) {
			max = cfg.itemEntityCullDistance > 0 ? cfg.itemEntityCullDistance : max;
		} else if (cfg.aggressiveArmorStandCull && entity instanceof ArmorStandEntity) {
			max = Math.min(max > 0 ? max : 48.0, 24.0);
		}

		if (max <= 0.0) {
			return false;
		}

		double scale = Math.max(0.12, cfg.entityRenderDistanceScale);
		double limit = max * scale;
		double limitSq = limit * limit;

		Vec3d pos = entity.getPos();
		double dx = pos.x - cameraX;
		double dy = pos.y - cameraY;
		double dz = pos.z - cameraZ;
		return dx * dx + dy * dy + dz * dz > limitSq;
	}

	public static boolean shouldSkipBlockEntity(BlockEntity blockEntity, Vec3d camera) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || cfg.blockEntityCullDistance <= 0.0) {
			return false;
		}
		BlockPos pos = blockEntity.getPos();
		double limit = cfg.blockEntityCullDistance * Math.max(0.12, cfg.entityRenderDistanceScale);
		double limitSq = limit * limit;
		double dx = (pos.getX() + 0.5) - camera.x;
		double dy = (pos.getY() + 0.5) - camera.y;
		double dz = (pos.getZ() + 0.5) - camera.z;
		return dx * dx + dy * dy + dz * dz > limitSq;
	}

	public static boolean shouldSkipBeaconBeam(BlockPos pos, Vec3d camera) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || cfg.beaconBeamCullDistance <= 0.0) {
			return false;
		}
		double limit = cfg.beaconBeamCullDistance;
		double limitSq = limit * limit;
		double dx = (pos.getX() + 0.5) - camera.x;
		double dy = (pos.getY() + 0.5) - camera.y;
		double dz = (pos.getZ() + 0.5) - camera.z;
		return dx * dx + dy * dy + dz * dz > limitSq;
	}
}
