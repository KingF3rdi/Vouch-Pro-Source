package de.helix.anticheat.util;

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
    public static final String BAN_LOGS = "ac.banlogs";
    public static final String STAFF_LOGS = "ac.stafflogs";
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

    public static boolean canViewLogs(CommandSender sender) {
        return sender.hasPermission(BAN_LOGS) || sender.hasPermission(ADMIN);
    }

    public static boolean canViewStaffLogs(CommandSender sender) {
        return sender.hasPermission(STAFF_LOGS) || sender.hasPermission(ADMIN);
    }

    /** Players whose commands are recorded in /ac staff logs. */
    public static boolean isStaff(Player player) {
        if (player == null) {
            return false;
        }
        return player.hasPermission(STAFF)
                || player.hasPermission(ADMIN)
                || player.hasPermission(BAN)
                || player.hasPermission(BAN_LOGS)
                || player.hasPermission(STAFF_LOGS)
                || player.hasPermission(NOTIFY)
                || player.isOp();
    }
}
