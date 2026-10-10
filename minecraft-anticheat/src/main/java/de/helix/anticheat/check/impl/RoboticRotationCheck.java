package de.helix.anticheat.check.impl;

import de.helix.anticheat.check.Check;
import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

/**
 * Detects robotic / aimbot-like head movement patterns:
 * identical yaw deltas, perfect snaps with frozen pitch, and constant micro-step GCDs.
 */
public final class RoboticRotationCheck extends Check {

    public RoboticRotationCheck(CheckManager manager) {
        super(manager, "RoboticRotation");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isRoboticRotationEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getRoboticRotationWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getRoboticRotationMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location to = event.getTo();
        if (to == null || !data.hasLastRotation()) {
            return;
        }

        float yaw = to.getYaw();
        float pitch = to.getPitch();
        float deltaYaw = wrapAngle(yaw - data.getLastYaw());
        float deltaPitch = pitch - data.getLastPitch();

        float absYaw = Math.abs(deltaYaw);
        float absPitch = Math.abs(deltaPitch);

        // No meaningful look change
        if (absYaw < 0.001f && absPitch < 0.001f) {
            return;
        }

        // Identical delta streak (classic robotic aim)
        if (almostEqual(deltaYaw, data.getLastDeltaYaw(), 0.0001f)
                && almostEqual(deltaPitch, data.getLastDeltaPitch(), 0.0001f)
                && absYaw > 0.05f) {
            data.setIdenticalDeltaStreak(data.getIdenticalDeltaStreak() + 1);
            if (data.getIdenticalDeltaStreak() >= manager.getConfig().getIdenticalDeltaStreak()) {
                flag(player, data, "identical rotation deltas x" + data.getIdenticalDeltaStreak());
                data.setIdenticalDeltaStreak(0);
            }
        } else {
            data.setIdenticalDeltaStreak(0);
        }

        // Large yaw snap with essentially frozen pitch (common ghost-client aim assist)
        if (absYaw >= manager.getConfig().getSnapMinYaw()
                && absPitch <= manager.getConfig().getSnapMaxPitchChange()) {
            flag(player, data, String.format("yaw snap %.2f with frozen pitch", absYaw));
        }

        // Constant micro-step / GCD-like pattern
        int samples = manager.getConfig().getMicroStepSamples();
        data.pushYawDelta(absYaw, samples);
        if (data.getYawDeltas().size() >= samples) {
            float first = data.getYawDeltas().peekFirst();
            if (first > 0.02f && first < 12.0f) {
                boolean allSimilar = true;
                double tolerance = manager.getConfig().getMicroStepTolerance();
                for (float sample : data.getYawDeltas()) {
                    if (Math.abs(sample - first) > tolerance + first * 0.02) {
                        allSimilar = false;
                        break;
                    }
                }
                if (allSimilar) {
                    flag(player, data, String.format("constant yaw micro-step ~%.4f", first));
                    data.getYawDeltas().clear();
                }
            }
        }

        data.setLastDeltas(deltaYaw, deltaPitch);
    }

    private static float wrapAngle(float angle) {
        angle %= 360.0f;
        if (angle >= 180.0f) {
            angle -= 360.0f;
        }
        if (angle < -180.0f) {
            angle += 360.0f;
        }
        return angle;
    }

    private static boolean almostEqual(float a, float b, float eps) {
        return Math.abs(a - b) <= eps;
    }
}
