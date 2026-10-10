package de.helix.anticheat.command;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.data.BanLogEntry;
import de.helix.anticheat.data.FlagLogEntry;
import de.helix.anticheat.util.Messages;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

/** Shared `/ac logs` and `/ban logs` output. */
public final class LogPresenter {

    private static final SimpleDateFormat TIME = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private final HelixACPlugin plugin;
    private final Messages messages;

    public LogPresenter(HelixACPlugin plugin) {
        this.plugin = plugin;
        this.messages = plugin.getMessages();
    }

    public void show(CommandSender sender, String playerOrNull) {
        if (playerOrNull == null || playerOrNull.isBlank()) {
            showGlobal(sender);
        } else {
            showPlayer(sender, playerOrNull);
        }
    }

    public void showGlobal(CommandSender sender) {
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
                        + " &8(&7" + e.getChecks()
                        + " &8x" + e.getFlagCount() + "&8)"
                        + " &8| &7expires &f" + formatExpiry(e.getExpiresAt())));
            }
        }
    }

    public void showPlayer(CommandSender sender, String targetName) {
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
        sender.sendMessage(messages.component("&8[&cHelixAC&8] &eLogs for &f" + display + "&e:"));

        sender.sendMessage(messages.component("&7Bans:"));
        if (bans.isEmpty()) {
            sender.sendMessage(messages.component("&7  (no bans)"));
        } else {
            for (BanLogEntry e : bans) {
                sender.sendMessage(messages.component("&8- &7" + TIME.format(new Date(e.getTimestamp()))
                        + " &cBAN &7reason: &f" + e.getReason()
                        + " &8| &7" + e.getChecks()
                        + " &8(&7count &f" + e.getFlagCount() + "&8)"
                        + " &8| &7expires &f" + formatExpiry(e.getExpiresAt())));
            }
        }

        sender.sendMessage(messages.component("&7Flags:"));
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
    }

    private static String formatExpiry(long expiresAt) {
        if (expiresAt <= 0L || expiresAt >= Long.MAX_VALUE / 2) {
            return "never";
        }
        return TIME.format(new Date(expiresAt));
    }
}
