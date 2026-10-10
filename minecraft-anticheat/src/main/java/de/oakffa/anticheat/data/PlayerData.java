package de.oakffa.anticheat.data;

import org.bukkit.Location;
import org.bukkit.util.Vector;

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

    // Tick / timer tracking
    private long lastMovePacketMs;
    private long tickBalanceMs;
    private int timerStreak;
    private int moveBurstStreak;
    private int actionBurstStreak;
    private int actionDesyncStreak;
    private final Deque<Long> recentMoveTimestamps = new ArrayDeque<>();
    private final Deque<Long> recentActionTimestamps = new ArrayDeque<>();

    // Prediction / setback state (Grim-style)
    private Vector lastVelocity = new Vector();
    private boolean wasOnGround = true;
    private Location lastValidLocation;
    private int uncertaintyTicks;
    private int velocityTicks;
    private int simulationStreak;

    // Invalid input / action packet state
    private boolean digging;
    private Location digBlock;
    private long digStartMs;
    private int inputStreak;
    private int swapStreak;
    private long lastSwapHandsMs;
    private int dropStreak;
    private long lastDropMs;

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

    public long getLastMovePacketMs() {
        return lastMovePacketMs;
    }

    public void setLastMovePacketMs(long lastMovePacketMs) {
        this.lastMovePacketMs = lastMovePacketMs;
    }

    public long getTickBalanceMs() {
        return tickBalanceMs;
    }

    public void setTickBalanceMs(long tickBalanceMs) {
        this.tickBalanceMs = tickBalanceMs;
    }

    public int getTimerStreak() {
        return timerStreak;
    }

    public void setTimerStreak(int timerStreak) {
        this.timerStreak = timerStreak;
    }

    public int getMoveBurstStreak() {
        return moveBurstStreak;
    }

    public void setMoveBurstStreak(int moveBurstStreak) {
        this.moveBurstStreak = moveBurstStreak;
    }

    public int getActionBurstStreak() {
        return actionBurstStreak;
    }

    public void setActionBurstStreak(int actionBurstStreak) {
        this.actionBurstStreak = actionBurstStreak;
    }

    public int getActionDesyncStreak() {
        return actionDesyncStreak;
    }

    public void setActionDesyncStreak(int actionDesyncStreak) {
        this.actionDesyncStreak = actionDesyncStreak;
    }

    public void pushMoveTimestamp(long nowMs, int maxTracked) {
        recentMoveTimestamps.addLast(nowMs);
        while (recentMoveTimestamps.size() > maxTracked) {
            recentMoveTimestamps.removeFirst();
        }
    }

    public int countRecentMoves(long windowMs) {
        long cutoff = System.currentTimeMillis() - windowMs;
        while (!recentMoveTimestamps.isEmpty() && recentMoveTimestamps.peekFirst() < cutoff) {
            recentMoveTimestamps.removeFirst();
        }
        return recentMoveTimestamps.size();
    }

    public void pushActionTimestamp(long nowMs, int maxTracked) {
        recentActionTimestamps.addLast(nowMs);
        while (recentActionTimestamps.size() > maxTracked) {
            recentActionTimestamps.removeFirst();
        }
    }

    public int countRecentActions(long windowMs) {
        long cutoff = System.currentTimeMillis() - windowMs;
        while (!recentActionTimestamps.isEmpty() && recentActionTimestamps.peekFirst() < cutoff) {
            recentActionTimestamps.removeFirst();
        }
        return recentActionTimestamps.size();
    }

    public void resetTickTracking() {
        lastMovePacketMs = 0L;
        tickBalanceMs = 0L;
        timerStreak = 0;
        moveBurstStreak = 0;
        actionBurstStreak = 0;
        actionDesyncStreak = 0;
        recentMoveTimestamps.clear();
        recentActionTimestamps.clear();
    }

    public Vector getLastVelocity() {
        return lastVelocity == null ? new Vector() : lastVelocity.clone();
    }

    public void setLastVelocity(Vector lastVelocity) {
        this.lastVelocity = lastVelocity == null ? new Vector() : lastVelocity.clone();
    }

    public boolean wasOnGround() {
        return wasOnGround;
    }

    public void setWasOnGround(boolean wasOnGround) {
        this.wasOnGround = wasOnGround;
    }

    public Location getLastValidLocation() {
        return lastValidLocation == null ? null : lastValidLocation.clone();
    }

    public void setLastValidLocation(Location lastValidLocation) {
        this.lastValidLocation = lastValidLocation == null ? null : lastValidLocation.clone();
    }

    public int getUncertaintyTicks() {
        return uncertaintyTicks;
    }

    public void setUncertaintyTicks(int uncertaintyTicks) {
        this.uncertaintyTicks = Math.max(0, uncertaintyTicks);
    }

    public int getVelocityTicks() {
        return velocityTicks;
    }

    public void setVelocityTicks(int velocityTicks) {
        this.velocityTicks = Math.max(0, velocityTicks);
    }

    public int getSimulationStreak() {
        return simulationStreak;
    }

    public void setSimulationStreak(int simulationStreak) {
        this.simulationStreak = Math.max(0, simulationStreak);
    }

    public boolean isDigging() {
        return digging;
    }

    public void setDigging(boolean digging) {
        this.digging = digging;
    }

    public Location getDigBlock() {
        return digBlock == null ? null : digBlock.clone();
    }

    public void setDigBlock(Location digBlock) {
        this.digBlock = digBlock == null ? null : digBlock.clone();
    }

    public long getDigStartMs() {
        return digStartMs;
    }

    public void setDigStartMs(long digStartMs) {
        this.digStartMs = digStartMs;
    }

    public int getInputStreak() {
        return inputStreak;
    }

    public void setInputStreak(int inputStreak) {
        this.inputStreak = Math.max(0, inputStreak);
    }

    public void addInputStreak(int amount) {
        this.inputStreak = Math.max(0, this.inputStreak + amount);
    }

    public int getSwapStreak() {
        return swapStreak;
    }

    public void setSwapStreak(int swapStreak) {
        this.swapStreak = Math.max(0, swapStreak);
    }

    public void addSwapStreak(int amount) {
        this.swapStreak = Math.max(0, this.swapStreak + amount);
    }

    public long getLastSwapHandsMs() {
        return lastSwapHandsMs;
    }

    public void setLastSwapHandsMs(long lastSwapHandsMs) {
        this.lastSwapHandsMs = lastSwapHandsMs;
    }

    public int getDropStreak() {
        return dropStreak;
    }

    public void setDropStreak(int dropStreak) {
        this.dropStreak = Math.max(0, dropStreak);
    }

    public void addDropStreak(int amount) {
        this.dropStreak = Math.max(0, this.dropStreak + amount);
    }

    public long getLastDropMs() {
        return lastDropMs;
    }

    public void setLastDropMs(long lastDropMs) {
        this.lastDropMs = lastDropMs;
    }
}
