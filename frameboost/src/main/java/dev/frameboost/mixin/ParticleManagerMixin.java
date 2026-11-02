package dev.frameboost.mixin;

import dev.frameboost.config.FrameBoostConfig;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleManager;
import net.minecraft.client.particle.ParticleTextureSheet;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

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
		if (!cfg.hardParticleCap || cfg.maxParticles <= 0) {
			return;
		}
		if (frameboost$countParticles() >= cfg.maxParticles) {
			ci.cancel();
		}
	}

	@Unique
	private int frameboost$countParticles() {
		// Recount at most every few adds — cheap enough for combat particle spam.
		if (++frameboost$cacheAge < 4) {
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
