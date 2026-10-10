package de.helix.anticheat.data;

import org.bukkit.Location;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class PlayerData {

    private final UUID uuid;
    private final String name;

    private Location lastLocation;
    private float lastYaw;
    private float lastPitch;
    private float lastDeltaYaw;
    private float lastDeltaPitch;
    private int identicalDeltaStreak;
    private boolean hasLastRotation;
    private boolean exemptNextMove;
    private long joinTimeMs;
    private String clientBrand = "unknown";

    private final Map<String, Integer> violationLevels = new HashMap<>();
    private final Deque<Long> recentFlagTimes = new ArrayDeque<>();
    private final Deque<String> recentFlagChecks = new ArrayDeque<>();
    private final Deque<Float> yawDeltas = new ArrayDeque<>();

    public PlayerData(UUID uuid, String name) {
        this.uuid = uuid;
        this.name = name;
        this.joinTimeMs = System.currentTimeMillis();
    }

    public UUID getUuid() {
        return uuid;
    }

    public String getName() {
        return name;
    }

    public Location getLastLocation() {
        return lastLocation;
    }

    public void setLastLocation(Location lastLocation) {
        this.lastLocation = lastLocation == null ? null : lastLocation.clone();
    }

    public float getLastYaw() {
        return lastYaw;
    }

    public float getLastPitch() {
        return lastPitch;
    }

    public void setLastRotation(float yaw, float pitch) {
        this.lastYaw = yaw;
        this.lastPitch = pitch;
        this.hasLastRotation = true;
    }

    public boolean hasLastRotation() {
        return hasLastRotation;
    }

    public float getLastDeltaYaw() {
        return lastDeltaYaw;
    }

    public float getLastDeltaPitch() {
        return lastDeltaPitch;
    }

    public void setLastDeltas(float deltaYaw, float deltaPitch) {
        this.lastDeltaYaw = deltaYaw;
        this.lastDeltaPitch = deltaPitch;
    }

    public int getIdenticalDeltaStreak() {
        return identicalDeltaStreak;
    }

    public void setIdenticalDeltaStreak(int identicalDeltaStreak) {
        this.identicalDeltaStreak = identicalDeltaStreak;
    }

    public boolean isExemptNextMove() {
        return exemptNextMove;
    }

    public void setExemptNextMove(boolean exemptNextMove) {
        this.exemptNextMove = exemptNextMove;
    }

    public long getJoinTimeMs() {
        return joinTimeMs;
    }

    public String getClientBrand() {
        return clientBrand;
    }

    public void setClientBrand(String clientBrand) {
        this.clientBrand = clientBrand == null ? "unknown" : clientBrand;
    }

    public int getVl(String check) {
        return violationLevels.getOrDefault(check, 0);
    }

    public int addVl(String check, int amount) {
        int next = getVl(check) + amount;
        violationLevels.put(check, next);
        return next;
    }

    public void decayVl(String check, int amount) {
        int next = Math.max(0, getVl(check) - amount);
        if (next == 0) {
            violationLevels.remove(check);
        } else {
            violationLevels.put(check, next);
        }
    }

    public void recordFlag(String check, long nowMs, int maxTracked) {
        recentFlagTimes.addLast(nowMs);
        recentFlagChecks.addLast(check);
        while (recentFlagTimes.size() > maxTracked) {
            recentFlagTimes.removeFirst();
            recentFlagChecks.removeFirst();
        }
    }

    public int countRecentFlags(long windowMs) {
        long cutoff = System.currentTimeMillis() - windowMs;
        while (!recentFlagTimes.isEmpty() && recentFlagTimes.peekFirst() < cutoff) {
            recentFlagTimes.removeFirst();
            if (!recentFlagChecks.isEmpty()) {
                recentFlagChecks.removeFirst();
            }
        }
        return recentFlagTimes.size();
    }

    public String summarizeRecentChecks() {
        if (recentFlagChecks.isEmpty()) {
            return "unknown";
        }
        Map<String, Integer> counts = new HashMap<>();
        for (String check : recentFlagChecks) {
            counts.merge(check, 1, Integer::sum);
        }
        StringBuilder sb = new StringBuilder();
        counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(5)
                .forEach(e -> {
                    if (sb.length() > 0) {
                        sb.append(", ");
                    }
                    sb.append(e.getKey()).append('x').append(e.getValue());
                });
        return sb.toString();
    }

    public Deque<Float> getYawDeltas() {
        return yawDeltas;
    }

    public void pushYawDelta(float delta, int maxSamples) {
        yawDeltas.addLast(delta);
        while (yawDeltas.size() > maxSamples) {
            yawDeltas.removeFirst();
        }
    }
}
