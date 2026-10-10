package de.helix.anticheat.listener;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.data.PlayerDataManager;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;

public final class ConnectionListener implements Listener {

    private final PlayerDataManager playerDataManager;
    private final CheckManager checkManager;

    public ConnectionListener(PlayerDataManager playerDataManager, CheckManager checkManager) {
        this.playerDataManager = playerDataManager;
        this.checkManager = checkManager;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        checkManager.handleJoin(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        playerDataManager.remove(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        playerDataManager.get(event.getPlayer()).setExemptNextMove(true);
    }
}
