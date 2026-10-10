package de.helix.anticheat.data;

import java.util.UUID;

public final class StaffLogEntry {

    private final long timestamp;
    private final UUID uuid;
    private final String playerName;
    private final String command;

    public StaffLogEntry(long timestamp, UUID uuid, String playerName, String command) {
        this.timestamp = timestamp;
        this.uuid = uuid;
        this.playerName = playerName;
        this.command = command;
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

    public String getCommand() {
        return command;
    }
}
