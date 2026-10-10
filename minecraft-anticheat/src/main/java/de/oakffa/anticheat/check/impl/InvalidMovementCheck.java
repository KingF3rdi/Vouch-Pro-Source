package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * Flags impossible movement deltas that typically come from forged move packets.
 */
public final class InvalidMovementCheck extends Check {

    public InvalidMovementCheck(CheckManager manager) {
        super(manager, "InvalidMovement");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isInvalidMovementEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getInvalidMovementWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getInvalidMovementMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location from = event.getFrom();
        Location to = event.getTo();
        if (to == null || from.getWorld() == null || to.getWorld() == null) {
            return;
        }
        if (!from.getWorld().equals(to.getWorld())) {
            data.setExemptNextMove(true);
            return;
        }
        if (player.isInsideVehicle() || player.isGliding() || player.isFlying()
                || player.getGameMode() == GameMode.CREATIVE
                || player.getGameMode() == GameMode.SPECTATOR
                || player.isRiptiding()) {
            return;
        }

        double dx = to.getX() - from.getX();
        double dy = to.getY() - from.getY();
        double dz = to.getZ() - from.getZ();
        double horizontal = Math.hypot(dx, dz);
        double distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        double maxTp = manager.getConfig().getMaxTeleportDistance();
        if (distance > maxTp) {
            flag(player, data, String.format("teleport-like move %.2f blocks", distance));
            return;
        }

        // Ignore tiny look-only packets
        if (horizontal < 0.001 && Math.abs(dy) < 0.001) {
            return;
        }

        double speedBonus = 0.0;
        if (player.hasPotionEffect(PotionEffectType.SPEED)) {
            int amp = player.getPotionEffect(PotionEffectType.SPEED).getAmplifier() + 1;
            speedBonus += 0.2 * amp;
        }
        if (player.isSprinting()) {
            speedBonus += 0.15;
        }
        if (player.getVelocity().lengthSquared() > 0.25) {
            // knockback / explosions — be lenient
            speedBonus += Math.min(2.0, player.getVelocity().length());
        }

        double maxH = manager.getConfig().getMaxHorizontalSpeed() + speedBonus;
        double maxV = manager.getConfig().getMaxVerticalSpeed() + 0.4;

        if (horizontal > maxH && player.isOnGround()) {
            flag(player, data, String.format("horizontal %.3f > %.3f", horizontal, maxH));
        } else if (horizontal > maxH * 1.45) {
            flag(player, data, String.format("air horizontal %.3f > %.3f", horizontal, maxH * 1.45));
        }

        Vector vel = player.getVelocity();
        if (dy > maxV && vel.getY() < 0.42) {
            flag(player, data, String.format("vertical %.3f > %.3f", dy, maxV));
        }
    }
}
