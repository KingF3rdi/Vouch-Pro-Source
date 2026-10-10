package de.oakffa.anticheat.command;

import de.oakffa.anticheat.OakFFAPlugin;
import de.oakffa.anticheat.data.StaffLogEntry;
import de.oakffa.anticheat.util.DurationParser;
import de.oakffa.anticheat.util.Messages;
import de.oakffa.anticheat.util.Permissions;
import de.oakffa.anticheat.util.PlayerSanitizer;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public final class AcCommand implements CommandExecutor, TabCompleter {

    private static final SimpleDateFormat TIME = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private final OakFFAPlugin plugin;
    private final Messages messages;
    private final LogPresenter logPresenter;

    public AcCommand(OakFFAPlugin plugin, LogPresenter logPresenter) {
        this.plugin = plugin;
        this.messages = plugin.getMessages();
        this.logPresenter = logPresenter;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            if (!sender.hasPermission(Permissions.ADMIN) && !Permissions.canBan(sender)
                    && !Permissions.canViewAnyLogs(sender)
                    && !Permissions.canClear(sender) && !Permissions.canWipe(sender)) {
                messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
                return true;
            }
            sendHelp(sender, label);
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "logs" -> {
                if (!Permissions.canViewLogs(sender)) {
                    messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
                    return true;
                }
                logPresenter.show(sender, args.length >= 2 ? args[1] : null);
            }
            case "staff" -> handleStaff(sender, args);
            case "stafflogs" -> showStaffLogs(sender);
            case "ban" -> handleBan(sender, args, false);
            case "ip" -> {
                if (args.length >= 2 && args[1].equalsIgnoreCase("ban")) {
                    // /ac ip ban <player> <duration> <reason...>
                    handleBan(sender, shiftIpBanArgs(args), true);
                } else {
                    sender.sendMessage(messages.component("&e/ac ip ban <player> <duration> <reason>"));
                }
            }
            case "ipban" -> handleBan(sender, args, true);
            case "clear" -> handleClear(sender, args);
            case "wipe" -> handleWipe(sender, args);
            case "whitelist", "wl" -> {
                if (!sender.hasPermission(Permissions.ADMIN)) {
                    messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
                    return true;
                }
                handleWhitelist(sender, args);
            }
            case "reload" -> {
                if (!sender.hasPermission(Permissions.ADMIN)) {
                    messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
                    return true;
                }
                plugin.reloadPlugin();
                messages.send(sender, messages.get("reload", "%prefix%&aConfiguration reloaded."), Map.of());
            }
            case "info" -> {
                if (!sender.hasPermission(Permissions.ADMIN)) {
                    messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
                    return true;
                }
                showInfo(sender);
            }
            default -> sendHelp(sender, label);
        }
        return true;
    }

    /**
     * Converts {@code /ac ip ban <player> <dur> <reason...>} args into the same shape as
     * {@code /ac ban <player> <dur> <reason...>} (keeps a dummy index-0 token).
     */
    private static String[] shiftIpBanArgs(String[] args) {
        // args: [ip, ban, player, duration, reason...]
        if (args.length < 3) {
            return new String[]{"ban"};
        }
        String[] out = new String[args.length - 1];
        out[0] = "ban";
        System.arraycopy(args, 2, out, 1, args.length - 2);
        return out;
    }

    private void handleBan(CommandSender sender, String[] args, boolean ipBan) {
        if (!Permissions.canBan(sender)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return;
        }
        // args: [ban|ipban, player, duration, reason...]
        if (args.length < 4) {
            if (ipBan) {
                sender.sendMessage(messages.component("&e/ac ip ban <player> <duration> <reason>"));
                sender.sendMessage(messages.component("&7Duration examples: &f7d&7, &f12h&7, &f30m&7, &f1w&7, &fpermanent"));
            } else {
                sender.sendMessage(messages.component("&e/ac ban <player> <duration> <reason>"));
                sender.sendMessage(messages.component("&7Duration examples: &f7d&7, &f12h&7, &f30m&7, &f1w&7, &fpermanent"));
            }
            return;
        }

        String playerName = args[1];
        Long durationMs = DurationParser.parseToMillis(args[2]);
        if (durationMs == null) {
            sender.sendMessage(messages.component("&cInvalid duration: &f" + args[2]
                    + " &7(use 7d, 12h, 30m, 1w, permanent)"));
            return;
        }

        String reason = String.join(" ", Arrays.copyOfRange(args, 3, args.length));
        if (reason.isBlank()) {
            sender.sendMessage(messages.component("&cPlease provide a ban reason."));
            return;
        }

        OfflinePlayer target = resolvePlayer(playerName);
        if (target == null || target.getUniqueId() == null) {
            messages.send(sender, messages.get("player-not-found", "%prefix%&cPlayer not found: &f%player%"),
                    Map.of("player", playerName));
            return;
        }

        String error = ipBan
                ? plugin.getPunishmentManager().manualIpBan(sender, target, durationMs, reason)
                : plugin.getPunishmentManager().manualBan(sender, target, durationMs, reason);

        if (error != null) {
            sender.sendMessage(messages.component("&c" + error));
            return;
        }

        String name = target.getName() != null ? target.getName() : playerName;
        String dur = DurationParser.format(durationMs);
        if (ipBan) {
            messages.send(sender, messages.get("ban-success-ip",
                            "%prefix%&aIP-banned &f%player% &afor &f%duration%&a. Reason: &f%reason%"),
                    Map.of("player", name, "duration", dur, "reason", reason));
        } else {
            messages.send(sender, messages.get("ban-success",
                            "%prefix%&aBanned &f%player% &afor &f%duration%&a. Reason: &f%reason%"),
                    Map.of("player", name, "duration", dur, "reason", reason));
        }
    }

    private void handleStaff(CommandSender sender, String[] args) {
        if (args.length < 2 || !args[1].equalsIgnoreCase("logs")) {
            sender.sendMessage(messages.component("&e/ac staff logs &7— latest staff commands"));
            return;
        }
        showStaffLogs(sender);
    }

    private void showStaffLogs(CommandSender sender) {
        if (!Permissions.canViewStaffLogs(sender)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return;
        }
        List<StaffLogEntry> entries = plugin.getStaffLogStore().latest(25);
        sender.sendMessage(messages.component("&8[&aOakFFA AC&8] &eStaff command logs:"));
        if (entries.isEmpty()) {
            sender.sendMessage(messages.component("&7  (none)"));
            return;
        }
        for (StaffLogEntry e : entries) {
            sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                    + " &e" + e.getPlayerName()
                    + " &f" + e.getCommand()));
        }
    }

    private void handleClear(CommandSender sender, String[] args) {
        if (!Permissions.canClear(sender)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return;
        }
        if (args.length < 2) {
            sender.sendMessage(messages.component("&e/ac clear <player>"));
            return;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null || !target.isOnline()) {
            messages.send(sender, messages.get("player-not-found", "%prefix%&cPlayer not found: &f%player%"),
                    Map.of("player", args[1]));
            return;
        }
        PlayerSanitizer.clearInventory(target);
        messages.send(sender, messages.get("clear-success",
                        "%prefix%&aCleared inventory of &f%player%&a."),
                Map.of("player", target.getName()));
        target.sendMessage(messages.component(messages.apply(
                messages.get("clear-notify", "%prefix%&cYour inventory was cleared by staff."),
                Map.of())));
    }

    private void handleWipe(CommandSender sender, String[] args) {
        if (!Permissions.canWipe(sender)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return;
        }
        if (args.length < 2) {
            sender.sendMessage(messages.component("&e/ac wipe <player>"));
            sender.sendMessage(messages.component("&7Wipes inventory, ender chest, XP, effects, and stats."));
            return;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null || !target.isOnline()) {
            messages.send(sender, messages.get("player-not-found", "%prefix%&cPlayer not found: &f%player%"),
                    Map.of("player", args[1]));
            return;
        }
        PlayerSanitizer.wipePlayer(target);
        messages.send(sender, messages.get("wipe-success",
                        "%prefix%&aWiped &f%player% &a(inventory, EC, XP, stats)."),
                Map.of("player", target.getName()));
        target.sendMessage(messages.component(messages.apply(
                messages.get("wipe-notify", "%prefix%&cYour inventory, ender chest, and stats were wiped by staff."),
                Map.of())));
        plugin.getLogger().info(sender.getName() + " wiped " + target.getName()
                + " (inventory + enderchest + stats)");
    }

    private void sendHelp(CommandSender sender, String label) {
        sender.sendMessage(messages.component("&8[&aOakFFA AC&8] — commands:"));
        sender.sendMessage(messages.component("&e/" + label + " logs [player] &8- &7latest flags and bans"));
        sender.sendMessage(messages.component("&e/ban logs [player] &8- &7same as /ac logs"));
        sender.sendMessage(messages.component("&e/" + label + " staff logs &8- &7staff commands (name + command)"));
        sender.sendMessage(messages.component("&e/" + label + " ban <player> <duration> <reason>"));
        sender.sendMessage(messages.component("&e/" + label + " ip ban <player> <duration> <reason>"));
        sender.sendMessage(messages.component("&e/" + label + " clear <player> &8- &7clear inventory"));
        sender.sendMessage(messages.component("&e/" + label + " wipe <player> &8- &7inventory + EC + stats"));
        sender.sendMessage(messages.component("&e/" + label + " whitelist <add|remove|list> [player]"));
        sender.sendMessage(messages.component("&e/" + label + " reload &8| &e/" + label + " info"));
        sender.sendMessage(messages.component("&7LuckPerms: &fac.admin &7includes all &fac.* &7perms (&fac.flags&7, &fac.logs&7, &fac.ban&7, …)"));
    }

    private void showInfo(CommandSender sender) {
        boolean lp = Bukkit.getPluginManager().getPlugin("LuckPerms") != null;
        sender.sendMessage(messages.component("&8[&aOakFFA AC&8] &fOakFFA Anti Cheat &7v" + plugin.getDescription().getVersion()));
        sender.sendMessage(messages.component("&7LuckPerms: " + (lp ? "&aDetected" : "&eNot installed (Bukkit perms still work)")));
        sender.sendMessage(messages.component("&7Checks: &f"
                + plugin.getCheckManager().getChecks().stream()
                .map(c -> c.getName() + (c.isEnabled() ? "" : "*"))
                .collect(Collectors.joining(", "))));
        sender.sendMessage(messages.component("&7Ban threshold: &f" + plugin.getPluginConfig().getFlagThreshold()
                + " &7flags / &f" + plugin.getPluginConfig().getFlagDecaySeconds() + "s"
                + " &7→ &f" + plugin.getPluginConfig().getBanDurationDays() + "d"));
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
                if (target == null || target.getUniqueId() == null) {
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
        return Bukkit.getOfflinePlayer(name);
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            List<String> opts = new ArrayList<>();
            if (Permissions.canViewLogs(sender)) {
                opts.add("logs");
            }
            if (Permissions.canViewStaffLogs(sender)) {
                opts.add("staff");
                opts.add("stafflogs");
            }
            if (Permissions.canBan(sender)) {
                opts.add("ban");
                opts.add("ip");
                opts.add("ipban");
            }
            if (Permissions.canClear(sender)) {
                opts.add("clear");
            }
            if (Permissions.canWipe(sender)) {
                opts.add("wipe");
            }
            if (sender.hasPermission(Permissions.ADMIN)) {
                opts.add("whitelist");
                opts.add("reload");
                opts.add("info");
            }
            return filter(opts, args[0]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("staff") && Permissions.canViewStaffLogs(sender)) {
            return filter(List.of("logs"), args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("logs") && Permissions.canViewLogs(sender)) {
            return onlineNames(args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("clear") && Permissions.canClear(sender)) {
            return onlineNames(args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("wipe") && Permissions.canWipe(sender)) {
            return onlineNames(args[1]);
        }
        if (args.length == 2 && (args[0].equalsIgnoreCase("ban") || args[0].equalsIgnoreCase("ipban"))
                && Permissions.canBan(sender)) {
            return onlineNames(args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("ip") && Permissions.canBan(sender)) {
            return filter(List.of("ban"), args[1]);
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("ip") && args[1].equalsIgnoreCase("ban")
                && Permissions.canBan(sender)) {
            return onlineNames(args[2]);
        }
        if (args.length == 3 && (args[0].equalsIgnoreCase("ban") || args[0].equalsIgnoreCase("ipban"))
                && Permissions.canBan(sender)) {
            return filter(List.of("7d", "1d", "12h", "30m", "1w", "permanent"), args[2]);
        }
        if (args.length == 4 && args[0].equalsIgnoreCase("ip") && args[1].equalsIgnoreCase("ban")
                && Permissions.canBan(sender)) {
            return filter(List.of("7d", "1d", "12h", "30m", "1w", "permanent"), args[3]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("whitelist") && sender.hasPermission(Permissions.ADMIN)) {
            return filter(List.of("add", "remove", "list"), args[1]);
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("whitelist")
                && (args[1].equalsIgnoreCase("add") || args[1].equalsIgnoreCase("remove"))
                && sender.hasPermission(Permissions.ADMIN)) {
            return onlineNames(args[2]);
        }
        return List.of();
    }

    private static List<String> onlineNames(String token) {
        return filter(Bukkit.getOnlinePlayers().stream().map(Player::getName).collect(Collectors.toList()), token);
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
