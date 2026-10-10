package de.helix.anticheat.command;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.data.BanLogEntry;
import de.helix.anticheat.data.FlagLogEntry;
import de.helix.anticheat.util.Messages;
import de.helix.anticheat.util.Permissions;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public final class AcCommand implements CommandExecutor, TabCompleter {

    private static final SimpleDateFormat TIME = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private final HelixACPlugin plugin;
    private final Messages messages;
    private final BanLogsCommand banLogsCommand;

    public AcCommand(HelixACPlugin plugin, BanLogsCommand banLogsCommand) {
        this.plugin = plugin;
        this.messages = plugin.getMessages();
        this.banLogsCommand = banLogsCommand;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission(Permissions.ADMIN)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return true;
        }
        if (args.length == 0) {
            sendHelp(sender, label);
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "logs" -> showLogs(sender);
            case "whitelist", "wl" -> handleWhitelist(sender, args);
            case "banlogs" -> {
                if (args.length < 2) {
                    sender.sendMessage(messages.component("&e/ac banlogs <player> &7(or /ban logs <player>)"));
                    return true;
                }
                banLogsCommand.onCommand(sender, null, "ban", new String[]{"logs", args[1]});
            }
            case "reload" -> {
                plugin.reloadPlugin();
                messages.send(sender, messages.get("reload", "%prefix%&aConfiguration reloaded."), Map.of());
            }
            case "info" -> showInfo(sender);
            default -> sendHelp(sender, label);
        }
        return true;
    }

    private void sendHelp(CommandSender sender, String label) {
        sender.sendMessage(messages.component("&8[&cHelixAC&8] &7Commands:"));
        sender.sendMessage(messages.component("&e/" + label + " logs &8- &7latest flags and bans"));
        sender.sendMessage(messages.component("&e/" + label + " whitelist <add|remove|list> [player]"));
        sender.sendMessage(messages.component("&e/" + label + " banlogs <player> &8- &7same as /ban logs"));
        sender.sendMessage(messages.component("&e/ban logs <player> &8- &7latest bans + flags for a player"));
        sender.sendMessage(messages.component("&e/" + label + " reload"));
        sender.sendMessage(messages.component("&e/" + label + " info"));
        sender.sendMessage(messages.component("&7LuckPerms: &fac.bypass&7, &fac.whitelist&7, &fac.admin&7, &fac.banlogs&7, &fac.notify"));
    }

    private void showInfo(CommandSender sender) {
        boolean lp = Bukkit.getPluginManager().getPlugin("LuckPerms") != null;
        sender.sendMessage(messages.component("&8[&cHelixAC&8] &fHelixAC &7v" + plugin.getDescription().getVersion()));
        sender.sendMessage(messages.component("&7LuckPerms: " + (lp ? "&aDetected" : "&eNot installed (Bukkit perms still work)")));
        sender.sendMessage(messages.component("&7Checks: &f"
                + plugin.getCheckManager().getChecks().stream()
                .map(c -> c.getName() + (c.isEnabled() ? "" : "*"))
                .collect(Collectors.joining(", "))));
        sender.sendMessage(messages.component("&7Ban threshold: &f" + plugin.getPluginConfig().getFlagThreshold()
                + " &7flags / &f" + plugin.getPluginConfig().getFlagDecaySeconds() + "s"
                + " &7→ &f" + plugin.getPluginConfig().getBanDurationDays() + "d"));
    }

    private void showLogs(CommandSender sender) {
        List<FlagLogEntry> flags = plugin.getLogStore().latestFlags(15);
        List<BanLogEntry> bans = plugin.getLogStore().latestBans(10);

        sender.sendMessage(messages.component("&8[&cHelixAC&8] &eLatest flags:"));
        if (flags.isEmpty()) {
            sender.sendMessage(messages.component("&7  (none)"));
        } else {
            for (FlagLogEntry e : flags) {
                String banNote = e.isWouldBan()
                        ? (e.isSuppressedBan() ? " &8[&eWHITELIST — ban blocked&8]" : " &8[&cBAN THRESHOLD&8]")
                        : "";
                sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                        + " &e" + e.getPlayerName()
                        + " &c" + e.getCheck()
                        + " &8vl&7" + e.getVl()
                        + " &7" + e.getDetail()
                        + banNote));
            }
        }

        sender.sendMessage(messages.component("&8[&cHelixAC&8] &eLatest bans:"));
        if (bans.isEmpty()) {
            sender.sendMessage(messages.component("&7  (none)"));
        } else {
            for (BanLogEntry e : bans) {
                sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                        + " &c" + e.getPlayerName()
                        + " &7reason: &f" + e.getReason()
                        + " &8(&7flags: &f" + e.getChecks()
                        + " &8x" + e.getFlagCount() + "&8)"));
            }
        }
    }

    private void handleWhitelist(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(messages.component("&e/ac whitelist <add|remove|list> [player]"));
            return;
        }
        String action = args[1].toLowerCase(Locale.ROOT);
        switch (action) {
            case "list" -> {
                messages.send(sender, messages.get("whitelist-list-header", "%prefix%&7Whitelisted players:"), Map.of());
                var all = plugin.getWhitelistStore().all();
                if (all.isEmpty()) {
                    sender.sendMessage(messages.component("&7  (empty) — also grant &fac.whitelist &7via LuckPerms for permission whitelist"));
                } else {
                    all.forEach((uuid, name) ->
                            sender.sendMessage(messages.component("&8- &f" + name + " &8(" + uuid + ")")));
                }
            }
            case "add" -> {
                if (args.length < 3) {
                    sender.sendMessage(messages.component("&e/ac whitelist add <player>"));
                    return;
                }
                OfflinePlayer target = resolvePlayer(args[2]);
                if (target == null || (target.getName() == null && !target.hasPlayedBefore() && !target.isOnline())) {
                    messages.send(sender, messages.get("player-not-found", "%prefix%&cPlayer not found: &f%player%"),
                            Map.of("player", args[2]));
                    return;
                }
                String name = target.getName() != null ? target.getName() : args[2];
                plugin.getWhitelistStore().add(target.getUniqueId(), name);
                messages.send(sender, messages.get("whitelist-added",
                                "%prefix%&aAdded &f%player% &ato the AC whitelist (flags only, no ban)."),
                        Map.of("player", name));
            }
            case "remove" -> {
                if (args.length < 3) {
                    sender.sendMessage(messages.component("&e/ac whitelist remove <player>"));
                    return;
                }
                OfflinePlayer target = resolvePlayer(args[2]);
                UUID uuid = null;
                String name = args[2];
                if (target != null) {
                    uuid = target.getUniqueId();
                    if (target.getName() != null) {
                        name = target.getName();
                    }
                }
                if (uuid == null) {
                    uuid = plugin.getWhitelistStore().findByName(args[2]);
                }
                if (uuid == null || !plugin.getWhitelistStore().remove(uuid)) {
                    messages.send(sender, messages.get("player-not-found", "%prefix%&cPlayer not found: &f%player%"),
                            Map.of("player", args[2]));
                    return;
                }
                messages.send(sender, messages.get("whitelist-removed",
                                "%prefix%&cRemoved &f%player% &cfrom the AC whitelist."),
                        Map.of("player", name));
            }
            default -> sender.sendMessage(messages.component("&e/ac whitelist <add|remove|list> [player]"));
        }
    }

    private OfflinePlayer resolvePlayer(String name) {
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) {
            return online;
        }
        OfflinePlayer offline = Bukkit.getOfflinePlayer(name);
        if (offline.hasPlayedBefore() || offline.isOnline()) {
            return offline;
        }
        // Still allow UUID-based adds for never-seen names (Paper resolves offline UUID in offline mode)
        return offline;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission(Permissions.ADMIN)) {
            return List.of();
        }
        if (args.length == 1) {
            return filter(List.of("logs", "whitelist", "banlogs", "reload", "info"), args[0]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("whitelist")) {
            return filter(List.of("add", "remove", "list"), args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("banlogs")) {
            return filter(Bukkit.getOnlinePlayers().stream().map(Player::getName).collect(Collectors.toList()), args[1]);
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("whitelist")
                && (args[1].equalsIgnoreCase("add") || args[1].equalsIgnoreCase("remove"))) {
            return filter(Bukkit.getOnlinePlayers().stream().map(Player::getName).collect(Collectors.toList()), args[2]);
        }
        return List.of();
    }

    private static List<String> filter(List<String> options, String token) {
        String t = token.toLowerCase(Locale.ROOT);
        List<String> out = new ArrayList<>();
        for (String o : options) {
            if (o.toLowerCase(Locale.ROOT).startsWith(t)) {
                out.add(o);
            }
        }
        return out;
    }
}
