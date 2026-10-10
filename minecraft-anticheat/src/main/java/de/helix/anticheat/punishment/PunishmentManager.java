package de.helix.anticheat.punishment;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.config.PluginConfig;
import de.helix.anticheat.data.BanLogEntry;
import de.helix.anticheat.data.FlagLogEntry;
import de.helix.anticheat.data.LogStore;
import de.helix.anticheat.data.PlayerData;
import de.helix.anticheat.data.WhitelistStore;
import de.helix.anticheat.util.Messages;
import de.helix.anticheat.util.Permissions;
import org.bukkit.BanList;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class PunishmentManager {

    private final HelixACPlugin plugin;
    private final PluginConfig config;
    private final Messages messages;
    private final LogStore logStore;
    private final WhitelistStore whitelistStore;

    public PunishmentManager(HelixACPlugin plugin, PluginConfig config, Messages messages,
                             LogStore logStore, WhitelistStore whitelistStore) {
        this.plugin = plugin;
        this.config = config;
        this.messages = messages;
        this.logStore = logStore;
        this.whitelistStore = whitelistStore;
    }

    public void flag(Player player, PlayerData data, String check, int vl, String detail, int weight) {
        if (Permissions.hasBypass(player)) {
            return;
        }

        long now = System.currentTimeMillis();
        int records = Math.max(1, weight);
        for (int i = 0; i < records; i++) {
            data.recordFlag(check, now, config.getFlagThreshold() * 3);
        }

        int recent = data.countRecentFlags(TimeUnit.SECONDS.toMillis(config.getFlagDecaySeconds()));
        boolean thresholdHit = config.isPunishmentEnabled() && recent >= config.getFlagThreshold();
        boolean whitelisted = isWhitelisted(player);

        FlagLogEntry flagEntry = new FlagLogEntry(
                now,
                player.getUniqueId(),
                player.getName(),
                check,
                vl,
                detail,
                thresholdHit,
                thresholdHit && whitelisted
        );
        logStore.addFlag(flagEntry);

        String notify = messages.get("flag-notify",
                "%prefix%&e%player% &7flagged &c%check% &8(&7vl %vl%&8) &7— &f%detail%");
        String rendered = messages.apply(notify, Map.of(
                "player", player.getName(),
                "check", check,
                "vl", String.valueOf(vl),
                "detail", detail == null ? "" : detail
        ));
        Bukkit.getOnlinePlayers().stream()
                .filter(p -> p.hasPermission(Permissions.NOTIFY))
                .forEach(p -> p.sendMessage(messages.component(rendered)));
        plugin.getLogger().info(player.getName() + " flagged " + check + " vl=" + vl + " detail=" + detail
                + (whitelisted ? " [WHITELISTED]" : ""));

        if (thresholdHit) {
            if (whitelisted) {
                plugin.getLogger().info(player.getName() + " hit ban threshold but is whitelisted — ban suppressed.");
                return;
            }
            banForCheating(player, data);
        }
    }

    public boolean isWhitelisted(Player player) {
        return Permissions.hasWhitelist(player) || whitelistStore.contains(player.getUniqueId());
    }

    public void banForCheating(Player player, PlayerData data) {
        String checks = data.summarizeRecentChecks();
        int flagCount = data.countRecentFlags(TimeUnit.SECONDS.toMillis(config.getFlagDecaySeconds()));
        String reason = config.getBanReason().replace("%checks%", checks);
        long now = System.currentTimeMillis();
        long durationMs = TimeUnit.DAYS.toMillis(config.getBanDurationDays());
        Date expires = new Date(now + durationMs);

        BanLogEntry banEntry = new BanLogEntry(
                now,
                player.getUniqueId(),
                player.getName(),
                reason,
                checks,
                flagCount,
                expires.getTime()
        );
        logStore.addBan(banEntry);

        Bukkit.getBanList(BanList.Type.NAME).addBan(player.getName(), reason, expires, "HelixAC");

        String kickTemplate = config.getBanKickMessage().replace("%checks%", checks);
        String kick = messages.color(messages.apply(kickTemplate, Map.of(
                "player", player.getName(),
                "reason", reason,
                "checks", checks
        )));

        String broadcast = messages.get("banned-broadcast",
                "%prefix%&c%player% &7was banned for &c7 days &7— &f%reason%");
        String rendered = messages.apply(broadcast, Map.of(
                "player", player.getName(),
                "reason", reason
        ));
        Bukkit.getOnlinePlayers().stream()
                .filter(p -> p.hasPermission(Permissions.NOTIFY) || p.hasPermission(Permissions.ADMIN))
                .forEach(p -> p.sendMessage(messages.component(rendered)));

        Bukkit.getScheduler().runTask(plugin, () -> {
            if (player.isOnline()) {
                player.kickPlayer(kick);
            }
        });
    }
}
