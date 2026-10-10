package de.oakffa.anticheat.config;

import de.oakffa.anticheat.OakFFAPlugin;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class PluginConfig {

    private final OakFFAPlugin plugin;

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

    private boolean invalidInputEnabled;
    private int invalidInputWeight;
    private int invalidInputMaxVl;
    private int invalidInputComboStreak;
    private int invalidInputMinSwapMs;

    private boolean invalidActionEnabled;
    private int invalidActionWeight;
    private int invalidActionMaxVl;
    private double invalidActionReachBuffer;
    private double invalidActionMinAttackDot;
    private int invalidActionMinDropMs;

    private boolean illegalPlaceEnabled;
    private int illegalPlaceWeight;
    private int illegalPlaceMaxVl;
    private int illegalPlaceMaxPingExempt;
    private int illegalPlaceMinGapMs;
    private int illegalPlaceFastStreak;
    private int illegalPlaceSamples;
    private double illegalPlaceMaxMeanMs;
    private double illegalPlaceMaxStdDev;
    private int illegalPlaceRegularStreak;
    private double illegalPlaceSilentMinDot;
    private double illegalPlaceSilentMaxRayMiss;
    private int illegalPlaceSilentStreak;

    private boolean combatUtilityEnabled;
    private int combatUtilityWeight;
    private int combatUtilityMaxVl;
    private int combatUtilityShieldSwapMs;
    private int combatUtilityShieldHitGapMs;
    private int combatUtilityShieldStreak;
    private int combatUtilityWebSwapMs;
    private int combatUtilityWebPlaceStreak;
    private double combatUtilityWebEnemyRange;
    private int combatUtilityCombatWindowMs;
    private int combatUtilityWebWaterMs;
    private int combatUtilityWebWaterStreak;
    private int combatUtilityBucketSwapMs;
    private int combatUtilityDrainMs;
    private int combatUtilityDrainStreak;

    private boolean prestigeCombatEnabled;
    private int prestigeCombatWeight;
    private int prestigeCombatMaxVl;
    private int prestigeCombatMaxPingExempt;
    private int prestigeCombatSwingGraceMs;
    private int prestigeCombatNoSwingStreak;
    private double prestigeCombatSilentAimDot;
    private double prestigeCombatSilentAimMinDistance;
    private int prestigeCombatSilentAimStreak;
    private double prestigeCombatSnapYaw;
    private double prestigeCombatSnapMaxPitch;
    private int prestigeCombatSnapStreak;
    private int prestigeCombatMultiTargetMs;
    private double prestigeCombatMultiTargetMaxDot;
    private int prestigeCombatMultiTargetStreak;
    private int prestigeCombatClickSamples;
    private double prestigeCombatClickMaxStdDev;
    private int prestigeCombatClickerStreak;
    private List<String> prestigeCombatPayloadKeywords;

    private int maxStaffLogs;

    public PluginConfig(OakFFAPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        FileConfiguration c = plugin.getConfig();
        prefix = c.getString("prefix", "&8[&aOakFFA AC&8]&r ");

        punishmentEnabled = c.getBoolean("punishment.enabled", true);
        flagThreshold = c.getInt("punishment.flag-threshold", 25);
        flagDecaySeconds = c.getInt("punishment.flag-decay-seconds", 600);
        banDurationDays = c.getInt("punishment.ban-duration-days", 7);
        banReason = c.getString("punishment.ban-reason", "Cheating (OakFFA Anti Cheat: %checks%)");
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

        invalidInputEnabled = c.getBoolean("checks.invalid-input.enabled", true);
        invalidInputWeight = c.getInt("checks.invalid-input.weight", 2);
        invalidInputMaxVl = c.getInt("checks.invalid-input.max-vl", 10);
        invalidInputComboStreak = c.getInt("checks.invalid-input.combo-streak", 5);
        invalidInputMinSwapMs = c.getInt("checks.invalid-input.min-swap-ms", 40);

        invalidActionEnabled = c.getBoolean("checks.invalid-action.enabled", true);
        invalidActionWeight = c.getInt("checks.invalid-action.weight", 3);
        invalidActionMaxVl = c.getInt("checks.invalid-action.max-vl", 10);
        invalidActionReachBuffer = c.getDouble("checks.invalid-action.reach-buffer", 0.35);
        invalidActionMinAttackDot = c.getDouble("checks.invalid-action.min-attack-dot", -0.15);
        invalidActionMinDropMs = c.getInt("checks.invalid-action.min-drop-ms", 35);

        illegalPlaceEnabled = c.getBoolean("checks.illegal-place.enabled", true);
        illegalPlaceWeight = c.getInt("checks.illegal-place.weight", 2);
        illegalPlaceMaxVl = c.getInt("checks.illegal-place.max-vl", 12);
        illegalPlaceMaxPingExempt = c.getInt("checks.illegal-place.max-ping-exempt", 400);
        illegalPlaceMinGapMs = c.getInt("checks.illegal-place.min-gap-ms", 45);
        illegalPlaceFastStreak = c.getInt("checks.illegal-place.fast-streak", 5);
        illegalPlaceSamples = c.getInt("checks.illegal-place.samples", 10);
        illegalPlaceMaxMeanMs = c.getDouble("checks.illegal-place.max-mean-ms", 95.0);
        illegalPlaceMaxStdDev = c.getDouble("checks.illegal-place.max-stddev", 4.0);
        illegalPlaceRegularStreak = c.getInt("checks.illegal-place.regular-streak", 2);
        illegalPlaceSilentMinDot = c.getDouble("checks.illegal-place.silent-min-dot", 0.35);
        illegalPlaceSilentMaxRayMiss = c.getDouble("checks.illegal-place.silent-max-ray-miss", 1.35);
        illegalPlaceSilentStreak = c.getInt("checks.illegal-place.silent-streak", 4);

        combatUtilityEnabled = c.getBoolean("checks.combat-utility.enabled", true);
        combatUtilityWeight = c.getInt("checks.combat-utility.weight", 3);
        combatUtilityMaxVl = c.getInt("checks.combat-utility.max-vl", 10);
        combatUtilityShieldSwapMs = c.getInt("checks.combat-utility.shield-swap-ms", 180);
        combatUtilityShieldHitGapMs = c.getInt("checks.combat-utility.shield-hit-gap-ms", 120);
        combatUtilityShieldStreak = c.getInt("checks.combat-utility.shield-streak", 3);
        combatUtilityWebSwapMs = c.getInt("checks.combat-utility.web-swap-ms", 200);
        combatUtilityWebPlaceStreak = c.getInt("checks.combat-utility.web-place-streak", 3);
        combatUtilityWebEnemyRange = c.getDouble("checks.combat-utility.web-enemy-range", 4.5);
        combatUtilityCombatWindowMs = c.getInt("checks.combat-utility.combat-window-ms", 2500);
        combatUtilityWebWaterMs = c.getInt("checks.combat-utility.web-water-ms", 900);
        combatUtilityWebWaterStreak = c.getInt("checks.combat-utility.web-water-streak", 2);
        combatUtilityBucketSwapMs = c.getInt("checks.combat-utility.bucket-swap-ms", 220);
        combatUtilityDrainMs = c.getInt("checks.combat-utility.drain-ms", 350);
        combatUtilityDrainStreak = c.getInt("checks.combat-utility.drain-streak", 2);

        prestigeCombatEnabled = c.getBoolean("checks.prestige-combat.enabled", true);
        prestigeCombatWeight = c.getInt("checks.prestige-combat.weight", 3);
        prestigeCombatMaxVl = c.getInt("checks.prestige-combat.max-vl", 12);
        prestigeCombatMaxPingExempt = c.getInt("checks.prestige-combat.max-ping-exempt", 400);
        prestigeCombatSwingGraceMs = c.getInt("checks.prestige-combat.swing-grace-ms", 400);
        prestigeCombatNoSwingStreak = c.getInt("checks.prestige-combat.no-swing-streak", 5);
        prestigeCombatSilentAimDot = c.getDouble("checks.prestige-combat.silent-aim-dot", 0.55);
        prestigeCombatSilentAimMinDistance = c.getDouble("checks.prestige-combat.silent-aim-min-distance", 1.8);
        prestigeCombatSilentAimStreak = c.getInt("checks.prestige-combat.silent-aim-streak", 4);
        prestigeCombatSnapYaw = c.getDouble("checks.prestige-combat.snap-yaw", 40.0);
        prestigeCombatSnapMaxPitch = c.getDouble("checks.prestige-combat.snap-max-pitch", 2.5);
        prestigeCombatSnapStreak = c.getInt("checks.prestige-combat.snap-streak", 3);
        prestigeCombatMultiTargetMs = c.getInt("checks.prestige-combat.multi-target-ms", 140);
        prestigeCombatMultiTargetMaxDot = c.getDouble("checks.prestige-combat.multi-target-max-dot", 0.55);
        prestigeCombatMultiTargetStreak = c.getInt("checks.prestige-combat.multi-target-streak", 3);
        prestigeCombatClickSamples = c.getInt("checks.prestige-combat.click-samples", 12);
        prestigeCombatClickMaxStdDev = c.getDouble("checks.prestige-combat.click-max-stddev", 3.5);
        prestigeCombatClickerStreak = c.getInt("checks.prestige-combat.clicker-streak", 2);
        prestigeCombatPayloadKeywords = normalizeList(c.getStringList("checks.prestige-combat.payload-keywords"));
        if (prestigeCombatPayloadKeywords.isEmpty()) {
            prestigeCombatPayloadKeywords = List.of(
                    "killaura", "kill aura", "aimassist", "aim assist", "triggerbot",
                    "autoblock", "keep sprint", "keepsprint", "criticals", "reach",
                    "hitbox", "velocity", "prestige", "vape",
                    "shieldbreaker", "shield breaker", "autoshield",
                    "cobweb", "autoweb", "auto web", "autodrain", "auto drain",
                    "waterplace", "webbreaker",
                    "fastplace", "fast place", "silentplace", "silent place", "scaffold");
        }
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

    public boolean isInvalidInputEnabled() {
        return invalidInputEnabled;
    }

    public int getInvalidInputWeight() {
        return invalidInputWeight;
    }

    public int getInvalidInputMaxVl() {
        return invalidInputMaxVl;
    }

    public int getInvalidInputComboStreak() {
        return invalidInputComboStreak;
    }

    public int getInvalidInputMinSwapMs() {
        return invalidInputMinSwapMs;
    }

    public boolean isInvalidActionEnabled() {
        return invalidActionEnabled;
    }

    public int getInvalidActionWeight() {
        return invalidActionWeight;
    }

    public int getInvalidActionMaxVl() {
        return invalidActionMaxVl;
    }

    public double getInvalidActionReachBuffer() {
        return invalidActionReachBuffer;
    }

    public double getInvalidActionMinAttackDot() {
        return invalidActionMinAttackDot;
    }

    public int getInvalidActionMinDropMs() {
        return invalidActionMinDropMs;
    }

    public boolean isIllegalPlaceEnabled() {
        return illegalPlaceEnabled;
    }

    public int getIllegalPlaceWeight() {
        return illegalPlaceWeight;
    }

    public int getIllegalPlaceMaxVl() {
        return illegalPlaceMaxVl;
    }

    public int getIllegalPlaceMaxPingExempt() {
        return illegalPlaceMaxPingExempt;
    }

    public int getIllegalPlaceMinGapMs() {
        return illegalPlaceMinGapMs;
    }

    public int getIllegalPlaceFastStreak() {
        return illegalPlaceFastStreak;
    }

    public int getIllegalPlaceSamples() {
        return illegalPlaceSamples;
    }

    public double getIllegalPlaceMaxMeanMs() {
        return illegalPlaceMaxMeanMs;
    }

    public double getIllegalPlaceMaxStdDev() {
        return illegalPlaceMaxStdDev;
    }

    public int getIllegalPlaceRegularStreak() {
        return illegalPlaceRegularStreak;
    }

    public double getIllegalPlaceSilentMinDot() {
        return illegalPlaceSilentMinDot;
    }

    public double getIllegalPlaceSilentMaxRayMiss() {
        return illegalPlaceSilentMaxRayMiss;
    }

    public int getIllegalPlaceSilentStreak() {
        return illegalPlaceSilentStreak;
    }

    public boolean isCombatUtilityEnabled() {
        return combatUtilityEnabled;
    }

    public int getCombatUtilityWeight() {
        return combatUtilityWeight;
    }

    public int getCombatUtilityMaxVl() {
        return combatUtilityMaxVl;
    }

    public int getCombatUtilityShieldSwapMs() {
        return combatUtilityShieldSwapMs;
    }

    public int getCombatUtilityShieldHitGapMs() {
        return combatUtilityShieldHitGapMs;
    }

    public int getCombatUtilityShieldStreak() {
        return combatUtilityShieldStreak;
    }

    public int getCombatUtilityWebSwapMs() {
        return combatUtilityWebSwapMs;
    }

    public int getCombatUtilityWebPlaceStreak() {
        return combatUtilityWebPlaceStreak;
    }

    public double getCombatUtilityWebEnemyRange() {
        return combatUtilityWebEnemyRange;
    }

    public int getCombatUtilityCombatWindowMs() {
        return combatUtilityCombatWindowMs;
    }

    public int getCombatUtilityWebWaterMs() {
        return combatUtilityWebWaterMs;
    }

    public int getCombatUtilityWebWaterStreak() {
        return combatUtilityWebWaterStreak;
    }

    public int getCombatUtilityBucketSwapMs() {
        return combatUtilityBucketSwapMs;
    }

    public int getCombatUtilityDrainMs() {
        return combatUtilityDrainMs;
    }

    public int getCombatUtilityDrainStreak() {
        return combatUtilityDrainStreak;
    }

    public boolean isPrestigeCombatEnabled() {
        return prestigeCombatEnabled;
    }

    public int getPrestigeCombatWeight() {
        return prestigeCombatWeight;
    }

    public int getPrestigeCombatMaxVl() {
        return prestigeCombatMaxVl;
    }

    public int getPrestigeCombatMaxPingExempt() {
        return prestigeCombatMaxPingExempt;
    }

    public int getPrestigeCombatSwingGraceMs() {
        return prestigeCombatSwingGraceMs;
    }

    public int getPrestigeCombatNoSwingStreak() {
        return prestigeCombatNoSwingStreak;
    }

    public double getPrestigeCombatSilentAimDot() {
        return prestigeCombatSilentAimDot;
    }

    public double getPrestigeCombatSilentAimMinDistance() {
        return prestigeCombatSilentAimMinDistance;
    }

    public int getPrestigeCombatSilentAimStreak() {
        return prestigeCombatSilentAimStreak;
    }

    public double getPrestigeCombatSnapYaw() {
        return prestigeCombatSnapYaw;
    }

    public double getPrestigeCombatSnapMaxPitch() {
        return prestigeCombatSnapMaxPitch;
    }

    public int getPrestigeCombatSnapStreak() {
        return prestigeCombatSnapStreak;
    }

    public int getPrestigeCombatMultiTargetMs() {
        return prestigeCombatMultiTargetMs;
    }

    public double getPrestigeCombatMultiTargetMaxDot() {
        return prestigeCombatMultiTargetMaxDot;
    }

    public int getPrestigeCombatMultiTargetStreak() {
        return prestigeCombatMultiTargetStreak;
    }

    public int getPrestigeCombatClickSamples() {
        return prestigeCombatClickSamples;
    }

    public double getPrestigeCombatClickMaxStdDev() {
        return prestigeCombatClickMaxStdDev;
    }

    public int getPrestigeCombatClickerStreak() {
        return prestigeCombatClickerStreak;
    }

    public List<String> getPrestigeCombatPayloadKeywords() {
        return prestigeCombatPayloadKeywords;
    }

    public int getMaxStaffLogs() {
        return maxStaffLogs;
    }

    public String message(String path, String def) {
        return plugin.getConfig().getString("messages." + path, def);
    }
}
