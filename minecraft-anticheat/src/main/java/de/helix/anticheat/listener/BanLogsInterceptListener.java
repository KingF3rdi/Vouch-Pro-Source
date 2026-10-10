package de.helix.anticheat.listener;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.command.BanLogsCommand;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.server.ServerCommandEvent;

/**
 * Intercepts {@code /ban logs <player>} without claiming the entire /ban command,
 * so Essentials/LiteBans/etc. keep working for normal bans.
 */
public final class BanLogsInterceptListener implements Listener {

    private final BanLogsCommand banLogsCommand;

    public BanLogsInterceptListener(HelixACPlugin plugin) {
        this.banLogsCommand = new BanLogsCommand(plugin);
    }

    public BanLogsCommand getBanLogsCommand() {
        return banLogsCommand;
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
        String msg = event.getMessage();
        if (msg == null) {
            return;
        }
        String[] parts = msg.trim().split("\\s+");
        if (parts.length >= 2 && isBan(parts[0]) && parts[1].equalsIgnoreCase("logs")) {
            event.setCancelled(true);
            String[] args = shift(parts);
            banLogsCommand.onCommand(event.getPlayer(), null, "ban", args);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onServerCommand(ServerCommandEvent event) {
        String msg = event.getCommand();
        if (msg == null) {
            return;
        }
        String[] parts = msg.trim().split("\\s+");
        if (parts.length >= 2 && isBanLabel(parts[0]) && parts[1].equalsIgnoreCase("logs")) {
            event.setCancelled(true);
            String[] args = shift(parts);
            banLogsCommand.onCommand(event.getSender(), null, "ban", args);
        }
    }

    private static boolean isBan(String token) {
        // token includes leading slash for player commands
        return token.equalsIgnoreCase("/ban") || token.equalsIgnoreCase("/minecraft:ban");
    }

    private static boolean isBanLabel(String token) {
        return token.equalsIgnoreCase("ban") || token.equalsIgnoreCase("minecraft:ban");
    }

    private static String[] shift(String[] parts) {
        // drop command label → ["logs", player...]
        String[] args = new String[parts.length - 1];
        System.arraycopy(parts, 1, args, 0, args.length);
        return args;
    }
}
