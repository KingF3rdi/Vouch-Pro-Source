package de.oakffa.anticheat.prediction;

import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

import java.util.ArrayList;
import java.util.List;

public final class MovementPredictor {

    private static final double GRAVITY = 0.08;
    private static final double DRAG = 0.98;
    private static final double JUMP = 0.42;
    private static final double GROUND_FRICTION = 0.6;
    private static final double AIR_FRICTION = 0.91;

    private MovementPredictor() {
    }

    public static PredictionResult predict(Player player, PlayerData data, Location from, Location to) {
        if (from == null || to == null || from.getWorld() == null || !from.getWorld().equals(to.getWorld())) {
            return PredictionResult.ignore();
        }
        if (player.getGameMode() == GameMode.CREATIVE || player.getGameMode() == GameMode.SPECTATOR
                || player.isInsideVehicle() || player.isFlying() || player.isGliding() || player.isRiptiding()) {
            return PredictionResult.ignore();
        }

        Vector actual = to.toVector().subtract(from.toVector());

        if (actual.lengthSquared() < 1.0E-8) {
            return PredictionResult.ok(0, 0, 0);
        }

        Vector lastVel = data.getLastVelocity();
        boolean wasOnGround = data.wasOnGround();
        double speedAttr = 0.1;
        if (player.getAttribute(Attribute.GENERIC_MOVEMENT_SPEED) != null) {
            speedAttr = player.getAttribute(Attribute.GENERIC_MOVEMENT_SPEED).getValue();
        }
        double speed = speedAttr * (player.isSprinting() ? 1.3 : 1.0);
        if (player.hasPotionEffect(PotionEffectType.SPEED)) {
            int amp = player.getPotionEffect(PotionEffectType.SPEED).getAmplifier() + 1;
            speed *= 1.0 + 0.2 * amp;
        }
        if (player.hasPotionEffect(PotionEffectType.SLOW)) {
            int amp = player.getPotionEffect(PotionEffectType.SLOW).getAmplifier() + 1;
            speed *= Math.max(0.2, 1.0 - 0.15 * amp);
        }

        float yaw = from.getYaw();
        List<Vector> candidates = new ArrayList<>(36);
        double[] inputs = {-1.0, 0.0, 1.0};

        candidates.add(step(lastVel.clone(), 0, 0, speed, wasOnGround, false, yaw));

        for (double forward : inputs) {
            for (double strafe : inputs) {
                candidates.add(step(lastVel.clone(), forward, strafe, speed, wasOnGround, false, yaw));
                if (wasOnGround) {
                    candidates.add(step(lastVel.clone(), forward, strafe, speed, true, true, yaw));
                }
            }
        }

        Vector serverVel = player.getVelocity().clone();
        if (serverVel.lengthSquared() > 0.0001) {
            candidates.add(serverVel.clone());
            candidates.add(step(serverVel.clone(), 0, 0, speed, wasOnGround, false, yaw));
            for (double forward : inputs) {
                for (double strafe : inputs) {
                    if (forward == 0 && strafe == 0) {
                        continue;
                    }
                    candidates.add(step(serverVel.clone(), forward, strafe, speed, wasOnGround, false, yaw));
                }
            }
        }

        double best = Double.MAX_VALUE;
        Vector bestPred = null;
        for (Vector pred : candidates) {
            double dist = pred.distance(actual);
            if (dist < best) {
                best = dist;
                bestPred = pred;
            }
        }

        double hTol = UncertaintyHandler.horizontalTolerance(player, data, 0.08);
        double vTol = UncertaintyHandler.verticalTolerance(player, data, 0.12);

        double hActual = Math.hypot(actual.getX(), actual.getZ());
        double hPred = bestPred == null ? 0 : Math.hypot(bestPred.getX(), bestPred.getZ());
        double hOffset = Math.max(0, Math.abs(hActual - hPred) - hTol);

        double fullOffset = Math.max(0, best - Math.hypot(hTol, vTol));
        double vOffset = bestPred == null ? 0
                : Math.max(0, Math.abs(actual.getY() - bestPred.getY()) - vTol);

        double offset = Math.max(fullOffset, Math.hypot(hOffset, vOffset));

        return new PredictionResult(false, offset, hOffset, vOffset, bestPred == null ? actual : bestPred, actual);
    }

    private static Vector step(Vector vel, double forward, double strafe, double speed,
                               boolean onGround, boolean jump, float yaw) {

        double length = Math.hypot(forward, strafe);
        if (length > 1.0E-4) {
            if (length > 1.0) {
                forward /= length;
                strafe /= length;
            }
            double inputForce = onGround
                    ? speed * (0.21600002 / (GROUND_FRICTION * GROUND_FRICTION * GROUND_FRICTION))
                    : speed * 0.2;
            double rad = Math.toRadians(yaw);
            double sin = Math.sin(rad);
            double cos = Math.cos(rad);

            double mx = strafe * cos - forward * sin;
            double mz = forward * cos + strafe * sin;
            vel.setX(vel.getX() + mx * inputForce);
            vel.setZ(vel.getZ() + mz * inputForce);
        }

        if (jump && onGround) {
            vel.setY(JUMP);
        }

        if (!onGround || jump) {
            vel.setY((vel.getY() - GRAVITY) * DRAG);
        } else if (Math.abs(vel.getY()) < 0.005) {
            vel.setY(0);
        } else {
            vel.setY(vel.getY() * DRAG - GRAVITY);
        }

        double friction = onGround && !jump ? GROUND_FRICTION * AIR_FRICTION : AIR_FRICTION;
        vel.setX(vel.getX() * friction);
        vel.setZ(vel.getZ() * friction);
        return vel;
    }

    public record PredictionResult(
            boolean ignored,
            double offset,
            double horizontalOffset,
            double verticalOffset,
            Vector predicted,
            Vector actual
    ) {
        public static PredictionResult ignore() {
            return new PredictionResult(true, 0, 0, 0, new Vector(), new Vector());
        }

        public static PredictionResult ok(double offset, double h, double v) {
            return new PredictionResult(false, offset, h, v, new Vector(), new Vector());
        }

        public boolean isViolation(double threshold) {
            return !ignored && offset > threshold;
        }
    }
}
