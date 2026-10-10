package de.helix.anticheat.config;

import de.helix.anticheat.HelixACPlugin;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class PluginConfig {

    private final HelixACPlugin plugin;

    private String prefix;
    private boolean punishmentEnabled;
    private int flagThreshold;
    private int flagDecaySeconds;
    private int banDurationDays;
    private String banReason;
    private String banKickMessage;
    private int maxFlagLogs;
    private int maxBanLogs;

    private boolean invalidPacketEnabled;
    private int invalidPacketWeight;
    private int invalidPacketMaxVl;

    private boolean invalidMovementEnabled;
    private int invalidMovementWeight;
    private int invalidMovementMaxVl;
    private double maxHorizontalSpeed;
    private double maxVerticalSpeed;
    private double maxTeleportDistance;

    private boolean roboticRotationEnabled;
    private int roboticRotationWeight;
    private int roboticRotationMaxVl;
    private int identicalDeltaStreak;
    private double snapMinYaw;
    private double snapMaxPitchChange;
    private int microStepSamples;
    private double microStepTolerance;

    private boolean badPacketsEnabled;
    private int badPacketsWeight;
    private int badPacketsMaxVl;

    private boolean ghostClientEnabled;
    private int ghostClientWeight;
    private int ghostClientMaxVl;
    private List<String> suspiciousChannels;
    private List<String> suspiciousBrands;

    private boolean meteorSignEnabled;
    private int meteorSignDelayTicks;
    private int meteorSignTimeoutTicks;
    private boolean meteorSignBan;

    private boolean tickAbuseEnabled;
    private int tickAbuseWeight;
    private int tickAbuseMaxVl;
    private int tickAbuseFlagBalanceMs;
    private int tickAbuseMaxBalanceMs;
    private int tickAbuseMinBalanceMs;
    private int tickAbuseTimerStreak;
    private int tickAbuseMaxMovesPerSecond;
    private int tickAbuseMaxActionsPerSecond;
    private int tickAbuseBurstStreak;
    private int tickAbuseAttackDesyncCount;
    private int tickAbuseMinMovesWithAttacks;
    private int tickAbuseMaxPingExempt;

    private boolean simulationEnabled;
    private int simulationWeight;
    private int simulationMaxVl;
    private double simulationOffsetThreshold;
    private int simulationStreak;
    private boolean setbacksEnabled;

    private int maxStaffLogs;

    public PluginConfig(HelixACPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        FileConfiguration c = plugin.getConfig();
        prefix = c.getString("prefix", "&8[&cHelixAC&8]&r ");

        punishmentEnabled = c.getBoolean("punishment.enabled", true);
        flagThreshold = c.getInt("punishment.flag-threshold", 25);
        flagDecaySeconds = c.getInt("punishment.flag-decay-seconds", 600);
        banDurationDays = c.getInt("punishment.ban-duration-days", 7);
        banReason = c.getString("punishment.ban-reason", "Cheating (HelixAC: %checks%)");
        banKickMessage = c.getString("punishment.ban-kick-message",
                "&cYou have been banned for 7 days.\n&7Reason: &fCheating\n&8Flags: %checks%");

        maxFlagLogs = c.getInt("storage.max-flag-logs", 200);
        maxBanLogs = c.getInt("storage.max-ban-logs", 100);
        maxStaffLogs = c.getInt("storage.max-staff-logs", 300);

        invalidPacketEnabled = c.getBoolean("checks.invalid-packet.enabled", true);
        invalidPacketWeight = c.getInt("checks.invalid-packet.weight", 3);
        invalidPacketMaxVl = c.getInt("checks.invalid-packet.max-vl", 8);

        invalidMovementEnabled = c.getBoolean("checks.invalid-movement.enabled", true);
        invalidMovementWeight = c.getInt("checks.invalid-movement.weight", 2);
        invalidMovementMaxVl = c.getInt("checks.invalid-movement.max-vl", 10);
        maxHorizontalSpeed = c.getDouble("checks.invalid-movement.max-horizontal-speed", 1.35);
        maxVerticalSpeed = c.getDouble("checks.invalid-movement.max-vertical-speed", 1.10);
        maxTeleportDistance = c.getDouble("checks.invalid-movement.max-teleport-distance", 80.0);

        roboticRotationEnabled = c.getBoolean("checks.robotic-rotation.enabled", true);
        roboticRotationWeight = c.getInt("checks.robotic-rotation.weight", 2);
        roboticRotationMaxVl = c.getInt("checks.robotic-rotation.max-vl", 12);
        identicalDeltaStreak = c.getInt("checks.robotic-rotation.identical-delta-streak", 8);
        snapMinYaw = c.getDouble("checks.robotic-rotation.snap-min-yaw", 35.0);
        snapMaxPitchChange = c.getDouble("checks.robotic-rotation.snap-max-pitch-change", 0.01);
        microStepSamples = c.getInt("checks.robotic-rotation.micro-step-samples", 14);
        microStepTolerance = c.getDouble("checks.robotic-rotation.micro-step-tolerance", 0.0008);

        badPacketsEnabled = c.getBoolean("checks.bad-packets.enabled", true);
        badPacketsWeight = c.getInt("checks.bad-packets.weight", 3);
        badPacketsMaxVl = c.getInt("checks.bad-packets.max-vl", 6);

        ghostClientEnabled = c.getBoolean("checks.ghost-client.enabled", true);
        ghostClientWeight = c.getInt("checks.ghost-client.weight", 5);
        ghostClientMaxVl = c.getInt("checks.ghost-client.max-vl", 4);
        suspiciousChannels = normalizeList(c.getStringList("checks.ghost-client.suspicious-channels"));
        suspiciousBrands = normalizeList(c.getStringList("checks.ghost-client.suspicious-brands"));

        meteorSignEnabled = c.getBoolean("checks.meteor-sign.enabled", true);
        meteorSignDelayTicks = c.getInt("checks.meteor-sign.delay-ticks", 40);
        meteorSignTimeoutTicks = c.getInt("checks.meteor-sign.timeout-ticks", 200);
        meteorSignBan = c.getBoolean("checks.meteor-sign.ban-on-detect", false);

        // Conservative defaults — low weight, high streaks → hard to false-ban
        tickAbuseEnabled = c.getBoolean("checks.tick-abuse.enabled", true);
        tickAbuseWeight = c.getInt("checks.tick-abuse.weight", 1);
        tickAbuseMaxVl = c.getInt("checks.tick-abuse.max-vl", 20);
        tickAbuseFlagBalanceMs = c.getInt("checks.tick-abuse.flag-balance-ms", 450);
        tickAbuseMaxBalanceMs = c.getInt("checks.tick-abuse.max-balance-ms", 1200);
        tickAbuseMinBalanceMs = c.getInt("checks.tick-abuse.min-balance-ms", -800);
        tickAbuseTimerStreak = c.getInt("checks.tick-abuse.timer-streak", 8);
        tickAbuseMaxMovesPerSecond = c.getInt("checks.tick-abuse.max-moves-per-second", 32);
        tickAbuseMaxActionsPerSecond = c.getInt("checks.tick-abuse.max-actions-per-second", 28);
        tickAbuseBurstStreak = c.getInt("checks.tick-abuse.burst-streak", 5);
        tickAbuseAttackDesyncCount = c.getInt("checks.tick-abuse.attack-desync-count", 12);
        tickAbuseMinMovesWithAttacks = c.getInt("checks.tick-abuse.min-moves-with-attacks", 1);
        tickAbuseMaxPingExempt = c.getInt("checks.tick-abuse.max-ping-exempt", 450);

        simulationEnabled = c.getBoolean("checks.simulation.enabled", true);
        simulationWeight = c.getInt("checks.simulation.weight", 2);
        simulationMaxVl = c.getInt("checks.simulation.max-vl", 16);
        simulationOffsetThreshold = c.getDouble("checks.simulation.offset-threshold", 0.55);
        simulationStreak = c.getInt("checks.simulation.streak", 4);
        setbacksEnabled = c.getBoolean("setbacks.enabled", true);
    }

    private static List<String> normalizeList(List<String> input) {
        if (input == null || input.isEmpty()) {
            return Collections.emptyList();
        }
        return input.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT).trim())
                .collect(Collectors.toList());
    }

    public String getPrefix() {
        return prefix;
    }

    public boolean isPunishmentEnabled() {
        return punishmentEnabled;
    }

    public int getFlagThreshold() {
        return flagThreshold;
    }

    public int getFlagDecaySeconds() {
        return flagDecaySeconds;
    }

    public int getBanDurationDays() {
        return banDurationDays;
    }

    public String getBanReason() {
        return banReason;
    }

    public String getBanKickMessage() {
        return banKickMessage;
    }

    public int getMaxFlagLogs() {
        return maxFlagLogs;
    }

    public int getMaxBanLogs() {
        return maxBanLogs;
    }

    public boolean isInvalidPacketEnabled() {
        return invalidPacketEnabled;
    }

    public int getInvalidPacketWeight() {
        return invalidPacketWeight;
    }

    public int getInvalidPacketMaxVl() {
        return invalidPacketMaxVl;
    }

    public boolean isInvalidMovementEnabled() {
        return invalidMovementEnabled;
    }

    public int getInvalidMovementWeight() {
        return invalidMovementWeight;
    }

    public int getInvalidMovementMaxVl() {
        return invalidMovementMaxVl;
    }

    public double getMaxHorizontalSpeed() {
        return maxHorizontalSpeed;
    }

    public double getMaxVerticalSpeed() {
        return maxVerticalSpeed;
    }

    public double getMaxTeleportDistance() {
        return maxTeleportDistance;
    }

    public boolean isRoboticRotationEnabled() {
        return roboticRotationEnabled;
    }

    public int getRoboticRotationWeight() {
        return roboticRotationWeight;
    }

    public int getRoboticRotationMaxVl() {
        return roboticRotationMaxVl;
    }

    public int getIdenticalDeltaStreak() {
        return identicalDeltaStreak;
    }

    public double getSnapMinYaw() {
        return snapMinYaw;
    }

    public double getSnapMaxPitchChange() {
        return snapMaxPitchChange;
    }

    public int getMicroStepSamples() {
        return microStepSamples;
    }

    public double getMicroStepTolerance() {
        return microStepTolerance;
    }

    public boolean isBadPacketsEnabled() {
        return badPacketsEnabled;
    }

    public int getBadPacketsWeight() {
        return badPacketsWeight;
    }

    public int getBadPacketsMaxVl() {
        return badPacketsMaxVl;
    }

    public boolean isGhostClientEnabled() {
        return ghostClientEnabled;
    }

    public int getGhostClientWeight() {
        return ghostClientWeight;
    }

    public int getGhostClientMaxVl() {
        return ghostClientMaxVl;
    }

    public List<String> getSuspiciousChannels() {
        return suspiciousChannels;
    }

    public List<String> getSuspiciousBrands() {
        return suspiciousBrands;
    }

    public boolean isMeteorSignEnabled() {
        return meteorSignEnabled;
    }

    public int getMeteorSignDelayTicks() {
        return meteorSignDelayTicks;
    }

    public int getMeteorSignTimeoutTicks() {
        return meteorSignTimeoutTicks;
    }

    public boolean isMeteorSignBan() {
        return meteorSignBan;
    }

    public boolean isTickAbuseEnabled() {
        return tickAbuseEnabled;
    }

    public int getTickAbuseWeight() {
        return tickAbuseWeight;
    }

    public int getTickAbuseMaxVl() {
        return tickAbuseMaxVl;
    }

    public int getTickAbuseFlagBalanceMs() {
        return tickAbuseFlagBalanceMs;
    }

    public int getTickAbuseMaxBalanceMs() {
        return tickAbuseMaxBalanceMs;
    }

    public int getTickAbuseMinBalanceMs() {
        return tickAbuseMinBalanceMs;
    }

    public int getTickAbuseTimerStreak() {
        return tickAbuseTimerStreak;
    }

    public int getTickAbuseMaxMovesPerSecond() {
        return tickAbuseMaxMovesPerSecond;
    }

    public int getTickAbuseMaxActionsPerSecond() {
        return tickAbuseMaxActionsPerSecond;
    }

    public int getTickAbuseBurstStreak() {
        return tickAbuseBurstStreak;
    }

    public int getTickAbuseAttackDesyncCount() {
        return tickAbuseAttackDesyncCount;
    }

    public int getTickAbuseMinMovesWithAttacks() {
        return tickAbuseMinMovesWithAttacks;
    }

    public int getTickAbuseMaxPingExempt() {
        return tickAbuseMaxPingExempt;
    }

    public boolean isSimulationEnabled() {
        return simulationEnabled;
    }

    public int getSimulationWeight() {
        return simulationWeight;
    }

    public int getSimulationMaxVl() {
        return simulationMaxVl;
    }

    public double getSimulationOffsetThreshold() {
        return simulationOffsetThreshold;
    }

    public int getSimulationStreak() {
        return simulationStreak;
    }

    public boolean isSetbacksEnabled() {
        return setbacksEnabled;
    }

    public int getMaxStaffLogs() {
        return maxStaffLogs;
    }

    public String message(String path, String def) {
        return plugin.getConfig().getString("messages." + path, def);
    }
}
