package de.oakffa.anticheat.listener;

import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerDataManager;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerMoveEvent;

public final class MovementListener implements Listener {

    private final CheckManager checkManager;

    public MovementListener(CheckManager checkManager, PlayerDataManager ignored) {
        this.checkManager = checkManager;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        // Skip pure head-rotation-less identical positions? Checks still want rotations.
        if (event.getTo() == null) {
            return;
        }
        checkManager.handleMove(event.getPlayer(), event);
    }
}
