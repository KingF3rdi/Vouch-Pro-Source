package de.helix.anticheat.util;

import org.bukkit.entity.Player;

/**
 * LuckPerms-compatible Bukkit permissions.
 * LuckPerms bridges these automatically when installed.
 */
public final class Permissions {

    public static final String BYPASS = "ac.bypass";
    public static final String WHITELIST = "ac.whitelist";
    public static final String ADMIN = "ac.admin";
    public static final String BAN_LOGS = "ac.banlogs";
    public static final String NOTIFY = "ac.notify";

    private Permissions() {
    }

    public static boolean hasBypass(Player player) {
        return player != null && player.hasPermission(BYPASS);
    }

    public static boolean hasWhitelist(Player player) {
        return player != null && player.hasPermission(WHITELIST);
    }
}
