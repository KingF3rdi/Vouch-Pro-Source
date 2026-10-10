package de.helix.anticheat.punishment;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.config.PluginConfig;
import de.helix.anticheat.data.BanLogEntry;
import de.helix.anticheat.data.FlagLogEntry;
import de.helix.anticheat.data.IpStore;
import de.helix.anticheat.data.LogStore;
import de.helix.anticheat.data.PlayerData;
import de.helix.anticheat.data.WhitelistStore;
import de.helix.anticheat.util.DurationParser;
import de.helix.anticheat.util.Messages;
import de.helix.anticheat.util.Permissions;
import org.bukkit.BanList;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.net.InetSocketAddress;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class PunishmentManager {

    private final HelixACPlugin plugin;
    private final PluginConfig config;
    private final Messages messages;
    private final LogStore logStore;
    private final WhitelistStore whitelistStore;
    private final IpStore ipStore;

    public PunishmentManager(HelixACPlugin plugin, PluginConfig config, Messages messages,
                             LogStore logStore, WhitelistStore whitelistStore, IpStore ipStore) {
        this.plugin = plugin;
        this.config = config;
        this.messages = messages;
        this.logStore = logStore;
        this.whitelistStore = whitelistStore;
        this.ipStore = ipStore;
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
                .filter(Permissions::canViewFlags)
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
        long durationMs = TimeUnit.DAYS.toMillis(config.getBanDurationDays());
        applyNameBan(player.getUniqueId(), player.getName(), reason, "auto:" + checks, flagCount, durationMs, "HelixAC");
        kickPlayer(player, reason, checks);
        broadcastBan(player.getName(), reason, DurationParser.format(durationMs), false);
    }

    /**
     * Staff name-ban: {@code /ac ban <player> <duration> <reason>}.
     *
     * @return error message, or null on success
     */
    public String manualBan(CommandSender staff, OfflinePlayer target, long durationMs, String reason) {
        String name = target.getName() != null ? target.getName() : "unknown";
        String source = staff.getName();
        applyNameBan(target.getUniqueId(), name, reason, "manual", 0, durationMs, source);

        Player online = target.getPlayer();
        if (online != null && online.isOnline()) {
            kickPlayer(online, reason, "manual");
        }

        broadcastBan(name, reason, DurationParser.format(durationMs), false);
        return null;
    }

    /**
     * Staff IP-ban: {@code /ac ip ban <player> <duration> <reason>}.
     *
     * @return error message, or null on success
     */
    public String manualIpBan(CommandSender staff, OfflinePlayer target, long durationMs, String reason) {
        String name = target.getName() != null ? target.getName() : "unknown";
        String ip = resolveIp(target);
        if (ip == null || ip.isBlank()) {
            return "No IP on record for " + name + ". They must join once first.";
        }

        String source = staff.getName();
        long now = System.currentTimeMillis();
        Date expires = durationMs < 0 ? null : new Date(now + durationMs);
        long expiresAt = expires == null ? -1L : expires.getTime();

        Bukkit.getBanList(BanList.Type.IP).addBan(ip, reason, expires, source);
        // Also name-ban so the account itself cannot reconnect from another IP
        Bukkit.getBanList(BanList.Type.NAME).addBan(name, reason + " [IP]", expires, source);

        BanLogEntry banEntry = new BanLogEntry(
                now,
                target.getUniqueId(),
                name,
                reason,
                "ip-ban:" + ip,
                0,
                expiresAt
        );
        logStore.addBan(banEntry);

        for (Player online : Bukkit.getOnlinePlayers()) {
            String onlineIp = extractIp(online);
            if (ip.equals(onlineIp) || online.getUniqueId().equals(target.getUniqueId())) {
                kickPlayer(online, reason, "ip-ban");
            }
        }

        broadcastBan(name + " &8(&7IP " + ip + "&8)", reason, DurationParser.format(durationMs), true);
        return null;
    }

    private void applyNameBan(java.util.UUID uuid, String name, String reason, String checks,
                              int flagCount, long durationMs, String source) {
        long now = System.currentTimeMillis();
        Date expires = durationMs < 0 ? null : new Date(now + durationMs);
        long expiresAt = expires == null ? -1L : expires.getTime();

        BanLogEntry banEntry = new BanLogEntry(
                now,
                uuid,
                name,
                reason,
                checks,
                flagCount,
                expiresAt
        );
        logStore.addBan(banEntry);
        Bukkit.getBanList(BanList.Type.NAME).addBan(name, reason, expires, source);
    }

    private void kickPlayer(Player player, String reason, String checks) {
        String kickTemplate = config.getBanKickMessage().replace("%checks%", checks);
        String kick = messages.color(messages.apply(kickTemplate, Map.of(
                "player", player.getName(),
                "reason", reason,
                "checks", checks
        )));
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (player.isOnline()) {
                player.kickPlayer(kick);
            }
        });
    }

    private void broadcastBan(String playerLabel, String reason, String durationLabel, boolean ipBan) {
        String key = ipBan ? "ip-banned-broadcast" : "manual-banned-broadcast";
        String def = ipBan
                ? "%prefix%&c%player% &7was &cIP-banned &7for &f%duration% &7— &f%reason%"
                : "%prefix%&c%player% &7was banned for &f%duration% &7— &f%reason%";
        String rendered = messages.apply(messages.get(key, def), Map.of(
                "player", playerLabel,
                "reason", reason,
                "duration", durationLabel
        ));
        Bukkit.getOnlinePlayers().stream()
                .filter(p -> p.hasPermission(Permissions.NOTIFY) || p.hasPermission(Permissions.ADMIN)
                        || p.hasPermission(Permissions.BAN))
                .forEach(p -> p.sendMessage(messages.component(rendered)));
        plugin.getLogger().info((ipBan ? "IP-banned " : "Banned ") + playerLabel + " for " + durationLabel + ": " + reason);
    }

    private String resolveIp(OfflinePlayer target) {
        Player online = target.getPlayer();
        if (online != null && online.isOnline()) {
            String ip = extractIp(online);
            if (ip != null) {
                ipStore.record(online.getUniqueId(), online.getName(), ip);
                return ip;
            }
        }
        String cached = ipStore.getIp(target.getUniqueId());
        if (cached != null) {
            return cached;
        }
        if (target.getName() != null) {
            return ipStore.getIpByName(target.getName());
        }
        return null;
    }

    public static String extractIp(Player player) {
        InetSocketAddress address = player.getAddress();
        if (address == null || address.getAddress() == null) {
            return null;
        }
        return address.getAddress().getHostAddress();
    }
}
