package de.oakffa.anticheat.data;

import java.util.UUID;

public final class FlagLogEntry {

    private final long timestamp;
    private final UUID uuid;
    private final String playerName;
    private final String check;
    private final int vl;
    private final String detail;
    private final boolean wouldBan;
    private final boolean suppressedBan;

    public FlagLogEntry(long timestamp, UUID uuid, String playerName, String check, int vl,
                        String detail, boolean wouldBan, boolean suppressedBan) {
        this.timestamp = timestamp;
        this.uuid = uuid;
        this.playerName = playerName;
        this.check = check;
        this.vl = vl;
        this.detail = detail;
        this.wouldBan = wouldBan;
        this.suppressedBan = suppressedBan;
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

    public String getCheck() {
        return check;
    }

    public int getVl() {
        return vl;
    }

    public String getDetail() {
        return detail;
    }

    public boolean isWouldBan() {
        return wouldBan;
    }

    public boolean isSuppressedBan() {
        return suppressedBan;
    }
}
