package de.helix.anticheat.data;

import java.util.UUID;

public final class BanLogEntry {

    private final long timestamp;
    private final UUID uuid;
    private final String playerName;
    private final String reason;
    private final String checks;
    private final int flagCount;
    private final long expiresAt;

    public BanLogEntry(long timestamp, UUID uuid, String playerName, String reason,
                       String checks, int flagCount, long expiresAt) {
        this.timestamp = timestamp;
        this.uuid = uuid;
        this.playerName = playerName;
        this.reason = reason;
        this.checks = checks;
        this.flagCount = flagCount;
        this.expiresAt = expiresAt;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public UUID getUuid() {
        return uuid;
    }

    public String getPlayerName() {
        return playerName;
    }

    public String getReason() {
        return reason;
    }

    public String getChecks() {
        return checks;
    }

    public int getFlagCount() {
        return flagCount;
    }

    public long getExpiresAt() {
        return expiresAt;
    }
}
