package dev.frameboost.client;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import net.minecraft.entity.ExperienceOrbEntity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.entity.decoration.EndCrystalEntity;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.PersistentProjectileEntity;
import net.minecraft.entity.projectile.ProjectileEntity;
import net.minecraft.entity.projectile.TridentEntity;
import net.minecraft.entity.projectile.thrown.EnderPearlEntity;
import net.minecraft.entity.projectile.thrown.PotionEntity;
import net.minecraft.entity.projectile.thrown.SnowballEntity;
import net.minecraft.entity.projectile.thrown.ThrownItemEntity;
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

		// PvP-critical: never hide these.
		if (cfg.keepPlayersVisible && entity instanceof PlayerEntity) {
			return false;
		}
		if (cfg.keepCombatProjectilesVisible && isCombatRelevant(entity)) {
			return false;
		}

		double max = cfg.entityHardCullDistance;
		if (entity instanceof ItemEntity || entity instanceof ExperienceOrbEntity) {
			max = cfg.itemEntityCullDistance > 0 ? cfg.itemEntityCullDistance : max;
		} else if (cfg.aggressiveArmorStandCull && entity instanceof ArmorStandEntity) {
			max = Math.min(max > 0 ? max : 40.0, 20.0);
		} else if (cfg.pvpMode && entity instanceof MobEntity) {
			max = cfg.mobCullDistance > 0 ? cfg.mobCullDistance : max;
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

	/** Entities you must see in crystal / pot / dia PvP. */
	public static boolean isCombatRelevant(Entity entity) {
		return entity instanceof PlayerEntity
				|| entity instanceof EndCrystalEntity
				|| entity instanceof PersistentProjectileEntity
				|| entity instanceof TridentEntity
				|| entity instanceof EnderPearlEntity
				|| entity instanceof PotionEntity
				|| entity instanceof SnowballEntity
				|| entity instanceof ThrownItemEntity
				|| entity instanceof ProjectileEntity;
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

	/** Distance check helper for living non-players (nametags etc.). */
	public static boolean isFarNonPlayer(LivingEntity entity, Vec3d camera, double max) {
		if (entity instanceof PlayerEntity) {
			return false;
		}
		double limitSq = max * max;
		Vec3d pos = entity.getPos();
		double dx = pos.x - camera.x;
		double dy = pos.y - camera.y;
		double dz = pos.z - camera.z;
		return dx * dx + dy * dy + dz * dz > limitSq;
	}
}
