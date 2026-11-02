package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleManager;
import net.minecraft.client.particle.ParticleTextureSheet;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.Map;
import java.util.Queue;

@Mixin(ParticleManager.class)
public abstract class ParticleManagerMixin {
	@Shadow
	@Final
	private Map<ParticleTextureSheet, Queue<Particle>> particles;

	@Unique
	private int frameboost$cachedCount;
	@Unique
	private int frameboost$cacheAge;

	@Inject(method = "addParticle(Lnet/minecraft/client/particle/Particle;)V", at = @At("HEAD"), cancellable = true)
	private void frameboost$capParticles(Particle particle, CallbackInfo ci) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled || !cfg.hardParticleCap || cfg.maxParticles <= 0) {
			return;
		}
		if (frameboost$countParticles() >= cfg.maxParticles) {
			ci.cancel();
		}
	}

	@Inject(
			method = "addParticle(Lnet/minecraft/particle/ParticleEffect;DDDDDD)Lnet/minecraft/client/particle/Particle;",
			at = @At("HEAD"),
			cancellable = true
	)
	private void frameboost$blockCheapAmbient(
			ParticleEffect parameters,
			double x,
			double y,
			double z,
			double velocityX,
			double velocityY,
			double velocityZ,
			CallbackInfoReturnable<Particle> cir
	) {
		FrameBoostConfig cfg = FrameBoostConfig.INSTANCE;
		if (!cfg.enabled) {
			return;
		}
		if (cfg.disableWeatherParticles && frameboost$isWeatherJunk(parameters)) {
			cir.setReturnValue(null);
			return;
		}
		if (cfg.hardParticleCap && cfg.maxParticles > 0 && frameboost$countParticles() >= cfg.maxParticles) {
			cir.setReturnValue(null);
		}
	}

	@Unique
	private static boolean frameboost$isWeatherJunk(ParticleEffect parameters) {
		return parameters.getType() == ParticleTypes.RAIN
				|| parameters.getType() == ParticleTypes.DRIPPING_WATER
				|| parameters.getType() == ParticleTypes.DRIPPING_LAVA
				|| parameters.getType() == ParticleTypes.FALLING_WATER
				|| parameters.getType() == ParticleTypes.FALLING_LAVA
				|| parameters.getType() == ParticleTypes.FALLING_HONEY
				|| parameters.getType() == ParticleTypes.FALLING_NECTAR
				|| parameters.getType() == ParticleTypes.FALLING_OBSIDIAN_TEAR
				|| parameters.getType() == ParticleTypes.DRIPPING_OBSIDIAN_TEAR
				|| parameters.getType() == ParticleTypes.DRIPPING_HONEY
				|| parameters.getType() == ParticleTypes.CLOUD
				|| parameters.getType() == ParticleTypes.WHITE_ASH
				|| parameters.getType() == ParticleTypes.ASH
				|| parameters.getType() == ParticleTypes.UNDERWATER;
	}

	@Unique
	private int frameboost$countParticles() {
		if (++frameboost$cacheAge < 3) {
			return frameboost$cachedCount;
		}
		frameboost$cacheAge = 0;
		int total = 0;
		for (Queue<Particle> queue : this.particles.values()) {
			total += queue.size();
		}
		frameboost$cachedCount = total;
		return total;
	}
}
