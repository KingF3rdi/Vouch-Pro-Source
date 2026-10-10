package de.oakffa.anticheat.listener;

import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.check.MeteorSignProbe;
import de.oakffa.anticheat.data.IpStore;
import de.oakffa.anticheat.data.PlayerDataManager;
import de.oakffa.anticheat.punishment.PunishmentManager;
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
