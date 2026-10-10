package de.oakffa.anticheat.check;

import de.oakffa.anticheat.OakFFAPlugin;
import de.oakffa.anticheat.config.PluginConfig;
import de.oakffa.anticheat.data.FlagLogEntry;
import de.oakffa.anticheat.data.PlayerData;
import de.oakffa.anticheat.data.PlayerDataManager;
import de.oakffa.anticheat.punishment.PunishmentManager;
import de.oakffa.anticheat.util.Messages;
import de.oakffa.anticheat.util.Permissions;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.BlockState;
import org.bukkit.block.Sign;
import org.bukkit.block.sign.Side;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.SignChangeEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public final class MeteorSignProbe implements Listener {

    public static final String PROBE_KEY = "key.meteor-client.open-gui";

    private static final Set<String> METEOR_RESOLVED = Set.of(
            "open gui",
            "open commands",
            "meteor client"
    );

    private final OakFFAPlugin plugin;
    private final PluginConfig config;
    private final PlayerDataManager playerDataManager;
    private final PunishmentManager punishmentManager;
    private final Messages messages;

    private final Map<UUID, ProbeSession> sessions = new ConcurrentHashMap<>();

    public MeteorSignProbe(OakFFAPlugin plugin, PluginConfig config, PlayerDataManager playerDataManager,
                           PunishmentManager punishmentManager, Messages messages) {
        this.plugin = plugin;
        this.config = config;
        this.playerDataManager = playerDataManager;
        this.punishmentManager = punishmentManager;
        this.messages = messages;
    }

    public void scheduleProbe(Player player) {
        if (!config.isMeteorSignEnabled()) {
            return;
        }
        if (Permissions.hasBypass(player)) {
            return;
        }
        int delay = config.getMeteorSignDelayTicks();
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (player.isOnline()) {
                beginProbe(player);
            }
        }, Math.max(1, delay));
    }

    private void beginProbe(Player player) {
        if (!player.isOnline() || sessions.containsKey(player.getUniqueId())) {
            return;
        }

        Location signLoc = player.getLocation().clone().add(0, 5, 0);
        Block block = signLoc.getBlock();
        BlockState previous = block.getState();

        try {
            block.setType(Material.OAK_SIGN, false);
            BlockState state = block.getState();
            if (!(state instanceof Sign sign)) {
                previous.update(true, false);
                return;
            }

            sign.getSide(Side.FRONT).line(0, Component.translatable(PROBE_KEY));
            sign.getSide(Side.FRONT).line(1, Component.empty());
            sign.getSide(Side.FRONT).line(2, Component.empty());
            sign.getSide(Side.FRONT).line(3, Component.empty());
            sign.update(true, false);

            sessions.put(player.getUniqueId(), new ProbeSession(signLoc.clone(), previous));
            player.openSign(sign, Side.FRONT);

            Bukkit.getScheduler().runTaskLater(plugin, () -> cleanup(player.getUniqueId()),
                    config.getMeteorSignTimeoutTicks());
        } catch (Exception ex) {
            plugin.getLogger().warning("Meteor sign probe failed for " + player.getName() + ": " + ex.getMessage());
            try {
                previous.update(true, false);
            } catch (Exception ignored) {
                block.setType(Material.AIR, false);
            }
            sessions.remove(player.getUniqueId());
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = false)
    public void onSignChange(SignChangeEvent event) {
        Player player = event.getPlayer();
        if (!sessions.containsKey(player.getUniqueId())) {
            return;
        }

        event.setCancelled(true);

        String line0 = event.getLine(0);
        if (line0 == null) {
            line0 = "";
        }
        String normalized = line0.toLowerCase(Locale.ROOT).trim();
        boolean meteor = isMeteorResolved(normalized, line0);
        cleanup(player.getUniqueId());

        if (meteor) {
            handleDetection(player, line0);
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        cleanup(event.getPlayer().getUniqueId());
    }

    private void handleDetection(Player player, String returnedText) {
        if (Permissions.hasBypass(player)) {
            return;
        }

        PlayerData data = playerDataManager.get(player);
        String detail = "sign probe resolved meteor key → \"" + returnedText + "\"";

        FlagLogEntry flag = new FlagLogEntry(
                System.currentTimeMillis(),
                player.getUniqueId(),
                player.getName(),
                "MeteorSign",
                data.addVl("MeteorSign", 5),
                detail,
                true,
                false
        );
        plugin.getLogStore().addFlag(flag);

        String notify = messages.get("meteor-detected",
                "%prefix%&c%player% &7blocked — &cMeteor Client &7(sign technique)");
        String rendered = messages.apply(notify, Map.of("player", player.getName()));
        Bukkit.getOnlinePlayers().stream()
                .filter(Permissions::canViewFlags)
                .forEach(p -> p.sendMessage(messages.component(rendered)));
        plugin.getLogger().warning(player.getName() + " detected as Meteor Client via sign probe: " + returnedText);

        String kick = messages.color(messages.get("meteor-kick",
                "&cConnection blocked.\n&7Meteor Client is not allowed on this server."));

        if (config.isMeteorSignBan()) {
            long daysMs = TimeUnit.DAYS.toMillis(config.getBanDurationDays());
            punishmentManager.manualBan(Bukkit.getConsoleSender(), player,
                    daysMs, "Meteor Client (sign technique)");
        } else {
            Bukkit.getScheduler().runTask(plugin, () -> {
                if (player.isOnline()) {
                    player.kickPlayer(kick);
                }
            });
        }
    }

    private static boolean isMeteorResolved(String normalized, String raw) {
        if (normalized.isEmpty()) {
            return false;
        }

        if (normalized.equalsIgnoreCase(PROBE_KEY) || raw.equalsIgnoreCase(PROBE_KEY)) {
            return false;
        }
        if (normalized.startsWith("key.meteor-client")) {
            return false;
        }
        if (METEOR_RESOLVED.contains(normalized)) {
            return true;
        }
        return normalized.contains("meteor");
    }

    private void cleanup(UUID uuid) {
        ProbeSession session = sessions.remove(uuid);
        if (session == null) {
            return;
        }
        try {
            session.previous.update(true, false);
        } catch (Exception ex) {
            try {
                session.location.getBlock().setType(Material.AIR, false);
            } catch (Exception ignored) {

            }
        }
    }

    private static final class ProbeSession {
        private final Location location;
        private final BlockState previous;

        private ProbeSession(Location location, BlockState previous) {
            this.location = location;
            this.previous = previous;
        }
    }
}
