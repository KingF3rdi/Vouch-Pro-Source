package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

import java.util.Deque;

public final class IllegalPlaceCheck extends Check {

    public IllegalPlaceCheck(CheckManager manager) {
        super(manager, "IllegalPlace");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isIllegalPlaceEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getIllegalPlaceWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getIllegalPlaceMaxVl();
    }

    public void onPlace(Player player, PlayerData data, Block against, BlockFace face, Block placed) {
        if (!isEnabled() || placed == null) {
            return;
        }
        if (player.getGameMode() == GameMode.CREATIVE || player.getGameMode() == GameMode.SPECTATOR) {
            return;
        }
        if (System.currentTimeMillis() - data.getJoinTimeMs() < 2500L) {
            return;
        }
        if (player.getPing() > manager.getConfig().getIllegalPlaceMaxPingExempt()) {
            return;
        }


        Material type = placed.getType();
        if (type == Material.AIR || type.name().contains("WATER") || type.name().contains("LAVA")) {
            return;
        }

        checkFastPlace(player, data);
        checkSilentPlace(player, data, against, face, placed);
    }


    private void checkFastPlace(Player player, PlayerData data) {
        long now = System.currentTimeMillis();
        long last = data.getLastBlockPlaceMs();
        if (last > 0L) {
            long gap = now - last;
            int minGap = manager.getConfig().getIllegalPlaceMinGapMs();
            if (gap < minGap) {
                data.addFastPlaceStreak(1);
                if (data.getFastPlaceStreak() >= manager.getConfig().getIllegalPlaceFastStreak()) {
                    flag(player, data, String.format("fast place gap=%dms (min %d)", gap, minGap));
                    data.setFastPlaceStreak(0);
                }
            } else {
                data.setFastPlaceStreak(Math.max(0, data.getFastPlaceStreak() - 1));
            }


            if (gap >= 20L && gap <= 280L) {
                data.pushPlaceInterval(gap, manager.getConfig().getIllegalPlaceSamples());
            }
            Deque<Long> samples = data.getPlaceIntervals();
            int need = manager.getConfig().getIllegalPlaceSamples();
            if (samples.size() >= need) {
                double mean = 0;
                for (long v : samples) {
                    mean += v;
                }
                mean /= samples.size();
                double variance = 0;
                for (long v : samples) {
                    double d = v - mean;
                    variance += d * d;
                }
                variance /= samples.size();
                double std = Math.sqrt(variance);
                if (mean <= manager.getConfig().getIllegalPlaceMaxMeanMs()
                        && std <= manager.getConfig().getIllegalPlaceMaxStdDev()) {
                    data.addFastPlaceStreak(1);
                    if (data.getFastPlaceStreak() >= manager.getConfig().getIllegalPlaceRegularStreak()) {
                        flag(player, data, String.format(
                                "regular fast place mean=%.1fms sd=%.2f", mean, std));
                        data.setFastPlaceStreak(0);
                        samples.clear();
                    }
                }
            }
        }
        data.setLastBlockPlaceMs(now);
    }


    private void checkSilentPlace(Player player, PlayerData data,
                                  Block against, BlockFace face, Block placed) {
        Location eye = player.getEyeLocation();
        Vector look = eye.getDirection().normalize();


        Location aim;
        if (against != null && face != null && face != BlockFace.SELF) {
            aim = against.getLocation().add(0.5, 0.5, 0.5)
                    .add(face.getModX() * 0.5, face.getModY() * 0.5, face.getModZ() * 0.5);
        } else {
            aim = placed.getLocation().add(0.5, 0.5, 0.5);
        }

        Vector to = aim.toVector().subtract(eye.toVector());
        double dist = to.length();
        if (dist < 0.35 || dist > 7.5) {
            return;
        }
        double dot = look.dot(to.normalize());
        double minDot = manager.getConfig().getIllegalPlaceSilentMinDot();


        Vector closest = eye.toVector().add(look.clone().multiply(Math.max(0.1, look.dot(to))));
        double rayMiss = closest.distance(aim.toVector());
        double maxMiss = manager.getConfig().getIllegalPlaceSilentMaxRayMiss();

        boolean offAngle = dot < minDot;
        boolean offRay = rayMiss > maxMiss && dist >= 1.2;

        if (offAngle || offRay) {
            data.addSilentPlaceStreak(1);
            if (data.getSilentPlaceStreak() >= manager.getConfig().getIllegalPlaceSilentStreak()) {
                flag(player, data, String.format(
                        "silent place dot=%.2f rayMiss=%.2f dist=%.2f face=%s",
                        dot, rayMiss, dist, face == null ? "?" : face.name()));
                data.setSilentPlaceStreak(0);
            }
        } else {
            data.setSilentPlaceStreak(Math.max(0, data.getSilentPlaceStreak() - 1));
        }
    }
}
