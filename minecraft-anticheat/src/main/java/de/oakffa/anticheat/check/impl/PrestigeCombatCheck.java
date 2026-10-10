package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

import java.util.Deque;
import java.util.UUID;

public final class PrestigeCombatCheck extends Check {

    public PrestigeCombatCheck(CheckManager manager) {
        super(manager, "PrestigeCombat");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isPrestigeCombatEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getPrestigeCombatWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getPrestigeCombatMaxVl();
    }

    public void onSwing(Player player, PlayerData data) {
        if (!isEnabled()) {
            return;
        }
        data.setLastArmSwingMs(System.currentTimeMillis());
    }

    public void onAttack(Player player, PlayerData data, Entity target) {
        if (!isEnabled() || target == null) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - data.getJoinTimeMs() < 3000L) {
            return;
        }
        if (player.getPing() > manager.getConfig().getPrestigeCombatMaxPingExempt()) {
            return;
        }

        Location eye = player.getEyeLocation();
        Location aim = target.getLocation().clone().add(0, Math.min(target.getHeight() * 0.85, 1.55), 0);
        Vector toTarget = aim.toVector().subtract(eye.toVector());
        double distance = toTarget.length();
        double lookDot = 1.0;
        if (distance > 0.01) {
            lookDot = eye.getDirection().normalize().dot(toTarget.clone().normalize());
        }

        checkNoSwing(player, data, now);
        checkSilentAim(player, data, lookDot, distance);
        checkSnapHit(player, data, lookDot, distance);
        checkMultiAura(player, data, target, eye, aim, now);
        checkAutoclicker(player, data, now);

        data.setLastAttackTarget(target.getUniqueId());
        data.setLastAttackMs(now);
        data.setLastAttackYaw(eye.getYaw());
        data.setLastAttackPitch(eye.getPitch());
    }

    private void checkNoSwing(Player player, PlayerData data, long now) {
        long sinceSwing = now - data.getLastArmSwingMs();
        int maxMs = manager.getConfig().getPrestigeCombatSwingGraceMs();
        if (data.getLastArmSwingMs() <= 0L || sinceSwing > maxMs) {
            data.addCombatNoSwingStreak(1);
            if (data.getCombatNoSwingStreak() >= manager.getConfig().getPrestigeCombatNoSwingStreak()) {
                flag(player, data, "attack packet without arm-swing (" + sinceSwing + "ms)");
                data.setCombatNoSwingStreak(0);
            }
        } else {
            data.setCombatNoSwingStreak(0);
        }
    }

    private void checkSilentAim(Player player, PlayerData data, double lookDot, double distance) {
        double minDot = manager.getConfig().getPrestigeCombatSilentAimDot();
        double minDist = manager.getConfig().getPrestigeCombatSilentAimMinDistance();
        if (distance >= minDist && lookDot < minDot) {
            data.addCombatSilentAimStreak(1);
            if (data.getCombatSilentAimStreak() >= manager.getConfig().getPrestigeCombatSilentAimStreak()) {
                flag(player, data, String.format("silent-aim hit dot=%.2f dist=%.2f", lookDot, distance));
                data.setCombatSilentAimStreak(0);
            }
        } else if (lookDot >= minDot) {
            data.setCombatSilentAimStreak(Math.max(0, data.getCombatSilentAimStreak() - 1));
        }
    }

    private void checkSnapHit(Player player, PlayerData data, double lookDot, double distance) {
        float absYaw = Math.abs(data.getLastDeltaYaw());
        float absPitch = Math.abs(data.getLastDeltaPitch());
        double snapYaw = manager.getConfig().getPrestigeCombatSnapYaw();
        if (distance >= 1.2
                && absYaw >= snapYaw
                && lookDot >= 0.92
                && absPitch <= manager.getConfig().getPrestigeCombatSnapMaxPitch()) {
            data.addCombatSnapStreak(1);
            if (data.getCombatSnapStreak() >= manager.getConfig().getPrestigeCombatSnapStreak()) {
                flag(player, data, String.format("aura snap-hit yaw=%.1f dot=%.2f", absYaw, lookDot));
                data.setCombatSnapStreak(0);
            }
        } else {
            data.setCombatSnapStreak(Math.max(0, data.getCombatSnapStreak() - 1));
        }
    }

    private void checkMultiAura(Player player, PlayerData data, Entity target,
                                Location eye, Location aim, long now) {
        UUID previous = data.getLastAttackTarget();
        long lastMs = data.getLastAttackMs();
        if (previous == null || previous.equals(target.getUniqueId()) || lastMs <= 0L) {
            return;
        }
        long gap = now - lastMs;
        int window = manager.getConfig().getPrestigeCombatMultiTargetMs();
        if (gap > window) {
            data.setCombatMultiTargetStreak(0);
            return;
        }

        Location prevAimDir = eye.clone();
        prevAimDir.setYaw(data.getLastAttackYaw());
        prevAimDir.setPitch(data.getLastAttackPitch());
        Vector prevLook = prevAimDir.getDirection().normalize();
        Vector nowTo = aim.toVector().subtract(eye.toVector());
        if (nowTo.lengthSquared() < 0.01) {
            return;
        }
        double switchDot = prevLook.dot(nowTo.normalize());
        double minAngleDot = manager.getConfig().getPrestigeCombatMultiTargetMaxDot();
        if (switchDot < minAngleDot) {
            data.addCombatMultiTargetStreak(1);
            if (data.getCombatMultiTargetStreak() >= manager.getConfig().getPrestigeCombatMultiTargetStreak()) {
                flag(player, data, String.format(
                        "multi-aura switch %dms angleDot=%.2f", gap, switchDot));
                data.setCombatMultiTargetStreak(0);
            }
        }
    }

    private void checkAutoclicker(Player player, PlayerData data, long now) {
        long last = data.getLastAttackMs();
        if (last > 0L) {
            long interval = now - last;

            if (interval >= 45L && interval <= 220L) {
                data.pushAttackInterval(interval, manager.getConfig().getPrestigeCombatClickSamples());
            }
        }

        Deque<Long> samples = data.getAttackIntervals();
        int need = manager.getConfig().getPrestigeCombatClickSamples();
        if (samples.size() < need) {
            return;
        }

        double mean = 0;
        for (long v : samples) {
            mean += v;
        }
        mean /= samples.size();
        if (mean < 50 || mean > 180) {
            return;
        }

        double variance = 0;
        for (long v : samples) {
            double d = v - mean;
            variance += d * d;
        }
        variance /= samples.size();
        double stdDev = Math.sqrt(variance);
        double maxStd = manager.getConfig().getPrestigeCombatClickMaxStdDev();
        if (stdDev <= maxStd) {
            data.addCombatClickerStreak(1);
            if (data.getCombatClickerStreak() >= manager.getConfig().getPrestigeCombatClickerStreak()) {
                flag(player, data, String.format(
                        "combat clicker mean=%.1fms sd=%.2f (n=%d)", mean, stdDev, samples.size()));
                data.setCombatClickerStreak(0);
                samples.clear();
            }
        } else {
            data.setCombatClickerStreak(0);
        }
    }
}
