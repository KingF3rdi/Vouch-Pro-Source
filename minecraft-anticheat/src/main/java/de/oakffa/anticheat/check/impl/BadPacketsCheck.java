package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

/**
 * Heuristic bad-packet patterns: impossible on-ground claims, sprinting while sneaking, etc.
 */
public final class BadPacketsCheck extends Check {

    public BadPacketsCheck(CheckManager manager) {
        super(manager, "BadPackets");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isBadPacketsEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getBadPacketsWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getBadPacketsMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location from = event.getFrom();
        Location to = event.getTo();
        if (to == null) {
            return;
        }

        double dy = to.getY() - from.getY();

        // Claiming ground while falling fast is a common spoof
        if (player.isOnGround() && dy < -0.6) {
            flag(player, data, String.format("onGround while falling dy=%.3f", dy));
        }

        if (player.isSprinting() && player.isSneaking() && !player.isInsideVehicle()) {
            flag(player, data, "sprint + sneak packet combination");
        }

        // Impossible pitch jitter combined with zero pos change but absurd yaw wrap
        float yawDelta = Math.abs(wrap(to.getYaw() - from.getYaw()));
        if (yawDelta > 350.0f) {
            flag(player, data, "impossible yaw wrap " + yawDelta);
        }
    }

    private static float wrap(float angle) {
        angle %= 360.0f;
        if (angle < 0) {
            angle += 360.0f;
        }
        return angle;
    }
}
