package de.oakffa.anticheat.check;

import de.oakffa.anticheat.OakFFAPlugin;
import de.oakffa.anticheat.check.impl.BadPacketsCheck;
import de.oakffa.anticheat.check.impl.CombatUtilityCheck;
import de.oakffa.anticheat.check.impl.GhostClientCheck;
import de.oakffa.anticheat.check.impl.InvalidActionCheck;
import de.oakffa.anticheat.check.impl.InvalidInputCheck;
import de.oakffa.anticheat.check.impl.InvalidMovementCheck;
import de.oakffa.anticheat.check.impl.InvalidPacketCheck;
import de.oakffa.anticheat.check.impl.PrestigeCombatCheck;
import de.oakffa.anticheat.check.impl.RoboticRotationCheck;
import de.oakffa.anticheat.check.impl.SimulationCheck;
import de.oakffa.anticheat.check.impl.TickAbuseCheck;
import de.oakffa.anticheat.config.PluginConfig;
import de.oakffa.anticheat.data.PlayerData;
import de.oakffa.anticheat.data.PlayerDataManager;
import de.oakffa.anticheat.prediction.SetbackManager;
import de.oakffa.anticheat.punishment.PunishmentManager;
import de.oakffa.anticheat.util.Messages;
import de.oakffa.anticheat.util.Permissions;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

import java.util.ArrayList;
import java.util.List;

public final class CheckManager {

    private final OakFFAPlugin plugin;
    private final PluginConfig config;
    private final PlayerDataManager playerDataManager;
    private final PunishmentManager punishmentManager;
    private final SetbackManager setbackManager;
    private final Messages messages;
    private final List<Check> checks = new ArrayList<>();

    public CheckManager(OakFFAPlugin plugin, PluginConfig config, PlayerDataManager playerDataManager,
                        PunishmentManager punishmentManager, SetbackManager setbackManager, Messages messages) {
        this.plugin = plugin;
        this.config = config;
        this.playerDataManager = playerDataManager;
        this.punishmentManager = punishmentManager;
        this.setbackManager = setbackManager;
        this.messages = messages;

        // Prediction-first (Grim-style), then packet / combat heuristics
        checks.add(new SimulationCheck(this));
        checks.add(new InvalidPacketCheck(this));
        checks.add(new InvalidInputCheck(this));
        checks.add(new InvalidActionCheck(this));
        checks.add(new InvalidMovementCheck(this));
        checks.add(new RoboticRotationCheck(this));
        checks.add(new PrestigeCombatCheck(this));
        checks.add(new CombatUtilityCheck(this));
        checks.add(new BadPacketsCheck(this));
        checks.add(new GhostClientCheck(this));
        checks.add(new TickAbuseCheck(this));
    }

    public OakFFAPlugin getPlugin() {
        return plugin;
    }

    public PluginConfig getConfig() {
        return config;
    }

    public PunishmentManager getPunishmentManager() {
        return punishmentManager;
    }

    public SetbackManager getSetbackManager() {
        return setbackManager;
    }

    public Messages getMessages() {
        return messages;
    }

    public List<Check> getChecks() {
        return checks;
    }

    public void handleJoin(Player player) {
        if (Permissions.hasBypass(player)) {
            return;
        }
        PlayerData data = playerDataManager.get(player);
        data.setExemptNextMove(true);
        data.setUncertaintyTicks(40);
        data.setLastValidLocation(player.getLocation());
        for (Check check : checks) {
            if (check.isEnabled()) {
                check.onJoin(player, data);
            }
        }
    }

    public void handleMove(Player player, PlayerMoveEvent event) {
        if (Permissions.hasBypass(player)) {
            return;
        }
        PlayerData data = playerDataManager.get(player);
        if (data.isExemptNextMove()) {
            data.setExemptNextMove(false);
            data.setLastLocation(event.getTo());
            if (event.getTo() != null) {
                data.setLastRotation(event.getTo().getYaw(), event.getTo().getPitch());
            }
            return;
        }
        // Grace period after join to avoid false teleports
        if (System.currentTimeMillis() - data.getJoinTimeMs() < 2500L) {
            data.setLastLocation(event.getTo());
            if (event.getTo() != null) {
                data.setLastRotation(event.getTo().getYaw(), event.getTo().getPitch());
            }
            return;
        }
        for (Check check : checks) {
            if (check.isEnabled()) {
                check.onMove(player, data, event);
            }
        }
        if (event.getTo() != null) {
            data.setLastLocation(event.getTo());
            data.setLastRotation(event.getTo().getYaw(), event.getTo().getPitch());
        }
    }

    public void handleBrand(Player player, String brand) {
        if (Permissions.hasBypass(player)) {
            return;
        }
        PlayerData data = playerDataManager.get(player);
        data.setClientBrand(brand);
        for (Check check : checks) {
            if (check.isEnabled()) {
                check.onBrand(player, data, brand);
            }
        }
    }

    public void handlePluginMessage(Player player, String channel, byte[] payload) {
        if (Permissions.hasBypass(player)) {
            return;
        }
        PlayerData data = playerDataManager.get(player);
        for (Check check : checks) {
            if (check.isEnabled()) {
                check.onPluginMessage(player, data, channel, payload);
            }
        }
    }

    public void handleTickAction(Player player, PlayerData data, TickAbuseCheck.ActionType type) {
        if (Permissions.hasBypass(player)) {
            return;
        }
        for (Check check : checks) {
            if (check instanceof TickAbuseCheck tickAbuse && tickAbuse.isEnabled()) {
                tickAbuse.onAction(player, data, type);
            }
        }
    }

    public void resetTickTracking(Player player) {
        PlayerData data = playerDataManager.get(player);
        data.resetTickTracking();
        data.setExemptNextMove(true);
        data.setUncertaintyTicks(Math.max(data.getUncertaintyTicks(), 10));
        data.setSimulationStreak(0);
        setbackManager.rememberValid(player, player.getLocation());
    }
}
