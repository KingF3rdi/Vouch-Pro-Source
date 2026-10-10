package de.helix.anticheat.listener;

import de.helix.anticheat.data.StaffLogEntry;
import de.helix.anticheat.data.StaffLogStore;
import de.helix.anticheat.util.Permissions;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.server.ServerCommandEvent;

/**
 * Logs every command executed by staff (and console) for {@code /ac staff logs}.
 */
public final class StaffCommandListener implements Listener {

    private final StaffLogStore staffLogStore;

    public StaffCommandListener(StaffLogStore staffLogStore) {
        this.staffLogStore = staffLogStore;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        if (!Permissions.isStaff(player)) {
            return;
        }
        String command = event.getMessage();
        if (command == null || command.isBlank()) {
            return;
        }
        staffLogStore.add(new StaffLogEntry(
                System.currentTimeMillis(),
                player.getUniqueId(),
                player.getName(),
                command.startsWith("/") ? command : "/" + command
        ));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onServerCommand(ServerCommandEvent event) {
        String command = event.getCommand();
        if (command == null || command.isBlank()) {
            return;
        }
        // Always log console commands that look staff-related (/ac, ban, kick, op, lp, …)
        String lower = command.toLowerCase();
        if (!(lower.startsWith("ac") || lower.startsWith("helixac") || lower.startsWith("anticheat")
                || lower.startsWith("ban") || lower.startsWith("kick") || lower.startsWith("op ")
                || lower.startsWith("deop") || lower.startsWith("lp ") || lower.startsWith("luckperms")
                || lower.startsWith("pardon") || lower.startsWith("whitelist"))) {
            return;
        }
        staffLogStore.add(new StaffLogEntry(
                System.currentTimeMillis(),
                null,
                "CONSOLE",
                command.startsWith("/") ? command : "/" + command
        ));
    }
}
