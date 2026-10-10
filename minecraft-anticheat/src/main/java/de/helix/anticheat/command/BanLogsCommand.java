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
import java.util.stream.Collectors;

/**
 * Handles {@code /ban logs <player>} for HelixAC history.
 * Other /ban subcommands are left alone (returns false so another plugin can handle them).
 */
public final class BanLogsCommand implements CommandExecutor, TabCompleter {

    private static final SimpleDateFormat TIME = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private final HelixACPlugin plugin;
    private final Messages messages;

    public BanLogsCommand(HelixACPlugin plugin) {
        this.plugin = plugin;
        this.messages = plugin.getMessages();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0 || !args[0].equalsIgnoreCase("logs")) {
            sender.sendMessage(messages.component("&8[&cHelixAC&8] &7Usage: &e/ban logs <player>"));
            return true;
        }
        if (!sender.hasPermission(Permissions.BAN_LOGS) && !sender.hasPermission(Permissions.ADMIN)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return true;
        }
        if (args.length < 2) {
            sender.sendMessage(messages.component("&e/ban logs <player>"));
            return true;
        }

        String targetName = args[1];
        OfflinePlayer offline = Bukkit.getOfflinePlayer(targetName);
        List<BanLogEntry> bans;
        List<FlagLogEntry> flags;
        if (offline.getUniqueId() != null && (offline.hasPlayedBefore() || offline.isOnline())) {
            bans = plugin.getLogStore().bansForPlayer(offline.getUniqueId(), 10);
            flags = plugin.getLogStore().flagsForPlayer(offline.getUniqueId(), 15);
            if (bans.isEmpty()) {
                bans = plugin.getLogStore().bansForPlayer(targetName, 10);
            }
            if (flags.isEmpty()) {
                flags = plugin.getLogStore().flagsForPlayer(targetName, 15);
            }
        } else {
            bans = plugin.getLogStore().bansForPlayer(targetName, 10);
            flags = plugin.getLogStore().flagsForPlayer(targetName, 15);
        }

        String display = offline.getName() != null ? offline.getName() : targetName;
        sender.sendMessage(messages.component("&8[&cHelixAC&8] &eBan logs for &f" + display + "&e:"));
        if (bans.isEmpty()) {
            sender.sendMessage(messages.component("&7  (no bans)"));
        } else {
            for (BanLogEntry e : bans) {
                sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                        + " &cBAN &7reason: &f" + e.getReason()
                        + " &8| &7flags: &f" + e.getChecks()
                        + " &8(&7count &f" + e.getFlagCount() + "&8)"
                        + " &8| &7expires &f" + TIME.format(new Date(e.getExpiresAt()))));
            }
        }

        sender.sendMessage(messages.component("&8[&cHelixAC&8] &eLatest flags for &f" + display + "&e:"));
        if (flags.isEmpty()) {
            sender.sendMessage(messages.component("&7  (no flags)"));
        } else {
            for (FlagLogEntry e : flags) {
                String note = e.isSuppressedBan() ? " &8[&ewhitelist&8]" : (e.isWouldBan() ? " &8[&cthreshold&8]" : "");
                sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                        + " &c" + e.getCheck()
                        + " &8vl&7" + e.getVl()
                        + " &7" + e.getDetail()
                        + note));
            }
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission(Permissions.BAN_LOGS) && !sender.hasPermission(Permissions.ADMIN)) {
            return List.of();
        }
        if (args.length == 1) {
            return "logs".startsWith(args[0].toLowerCase(Locale.ROOT)) ? List.of("logs") : List.of();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("logs")) {
            String t = args[1].toLowerCase(Locale.ROOT);
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase(Locale.ROOT).startsWith(t))
                    .collect(Collectors.toCollection(ArrayList::new));
        }
        return List.of();
    }
}
