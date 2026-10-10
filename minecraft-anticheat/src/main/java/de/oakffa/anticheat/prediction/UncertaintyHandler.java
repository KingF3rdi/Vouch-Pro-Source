package de.oakffa.anticheat.prediction;

import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.entity.Player;

public final class UncertaintyHandler {

    private UncertaintyHandler() {
    }

    public static double horizontalTolerance(Player player, PlayerData data, double base) {
        double tol = base;

        tol += 0.03;
        int ping = Math.max(0, player.getPing());
        tol += Math.min(0.35, ping / 1000.0);
        if (data.getUncertaintyTicks() > 0) {
            tol += 0.45;
        }
        if (data.getVelocityTicks() > 0) {
            tol += 0.55;
        }
        if (player.isRiptiding() || player.isGliding()) {
            tol += 0.8;
        }
        if (player.isInsideVehicle()) {
            tol += 1.5;
        }
        if (player.getVelocity().lengthSquared() > 0.04) {
            tol += Math.min(1.2, player.getVelocity().length() * 0.6);
        }
        return tol;
    }

    public static double verticalTolerance(Player player, PlayerData data, double base) {
        double tol = base + 0.03;
        int ping = Math.max(0, player.getPing());
        tol += Math.min(0.4, ping / 800.0);
        if (data.getUncertaintyTicks() > 0) {
            tol += 0.55;
        }
        if (data.getVelocityTicks() > 0) {
            tol += 0.7;
        }
        if (player.isInWater() || player.isInLava()) {
            tol += 0.35;
        }
        return tol;
    }

    public static void tick(PlayerData data) {
        if (data.getUncertaintyTicks() > 0) {
            data.setUncertaintyTicks(data.getUncertaintyTicks() - 1);
        }
        if (data.getVelocityTicks() > 0) {
            data.setVelocityTicks(data.getVelocityTicks() - 1);
        }
    }
}
