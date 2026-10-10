package de.helix.anticheat.listener;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.check.MeteorSignProbe;
import de.helix.anticheat.data.IpStore;
import de.helix.anticheat.data.PlayerDataManager;
import de.helix.anticheat.punishment.PunishmentManager;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;

public final class ConnectionListener implements Listener {

    private final PlayerDataManager playerDataManager;
    private final CheckManager checkManager;
    private final IpStore ipStore;
    private final MeteorSignProbe meteorSignProbe;

    public ConnectionListener(PlayerDataManager playerDataManager, CheckManager checkManager,
                              IpStore ipStore, MeteorSignProbe meteorSignProbe) {
        this.playerDataManager = playerDataManager;
        this.checkManager = checkManager;
        this.ipStore = ipStore;
        this.meteorSignProbe = meteorSignProbe;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String ip = PunishmentManager.extractIp(player);
        if (ip != null) {
            ipStore.record(player.getUniqueId(), player.getName(), ip);
        }
        checkManager.handleJoin(player);
        meteorSignProbe.scheduleProbe(player);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        playerDataManager.remove(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        checkManager.resetTickTracking(event.getPlayer());
    }
}
