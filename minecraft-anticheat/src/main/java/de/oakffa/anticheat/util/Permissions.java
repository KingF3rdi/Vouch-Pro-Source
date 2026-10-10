package de.oakffa.anticheat.util;

import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

/**
 * LuckPerms-compatible Bukkit permissions.
 * LuckPerms bridges these automatically when installed.
 */
public final class Permissions {

    public static final String BYPASS = "ac.bypass";
    public static final String WHITELIST = "ac.whitelist";
    public static final String ADMIN = "ac.admin";
    public static final String BAN = "ac.ban";
    /** Access to every OakFFA log view (/ac logs, /ban logs, /ac staff logs). */
    public static final String LOGS = "ac.logs";
    public static final String BAN_LOGS = "ac.banlogs";
    public static final String STAFF_LOGS = "ac.stafflogs";
    /** See live flag alerts and flag entries in logs. */
    public static final String FLAGS = "ac.flags";
    public static final String CLEAR = "ac.clear";
    public static final String WIPE = "ac.wipe";
    public static final String NOTIFY = "ac.notify";
    public static final String STAFF = "ac.staff";

    private Permissions() {
    }

    public static boolean hasBypass(Player player) {
        return player != null && player.hasPermission(BYPASS);
    }

    public static boolean hasWhitelist(Player player) {
        return player != null && player.hasPermission(WHITELIST);
    }

    public static boolean canBan(CommandSender sender) {
        return sender.hasPermission(BAN) || sender.hasPermission(ADMIN);
    }

    public static boolean canClear(CommandSender sender) {
        return sender.hasPermission(CLEAR) || sender.hasPermission(ADMIN);
    }

    public static boolean canWipe(CommandSender sender) {
        return sender.hasPermission(WIPE) || sender.hasPermission(ADMIN);
    }

    /** /ac logs and /ban logs (ban history; flags need {@link #canViewFlags}) */
    public static boolean canViewLogs(CommandSender sender) {
        return sender.hasPermission(LOGS)
                || sender.hasPermission(BAN_LOGS)
                || sender.hasPermission(ADMIN);
    }

    /** /ac staff logs */
    public static boolean canViewStaffLogs(CommandSender sender) {
        return sender.hasPermission(LOGS)
                || sender.hasPermission(STAFF_LOGS)
                || sender.hasPermission(ADMIN);
    }

    /** Live flag alerts + flag lines in log commands. */
    public static boolean canViewFlags(CommandSender sender) {
        return sender.hasPermission(FLAGS) || sender.hasPermission(ADMIN);
    }

    /** Any log command access. */
    public static boolean canViewAnyLogs(CommandSender sender) {
        return canViewLogs(sender) || canViewStaffLogs(sender);
    }

    /** Players whose commands are recorded in /ac staff logs. */
    public static boolean isStaff(Player player) {
        if (player == null) {
            return false;
        }
        return player.hasPermission(STAFF)
                || player.hasPermission(ADMIN)
                || player.hasPermission(BAN)
                || player.hasPermission(LOGS)
                || player.hasPermission(BAN_LOGS)
                || player.hasPermission(STAFF_LOGS)
                || player.hasPermission(FLAGS)
                || player.hasPermission(CLEAR)
                || player.hasPermission(WIPE)
                || player.hasPermission(NOTIFY)
                || player.isOp();
    }
}
