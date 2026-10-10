package de.oakffa.anticheat.listener;

import de.oakffa.anticheat.data.PlayerDataManager;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerVelocityEvent;

/** Marks knockback/explosion ticks so prediction forgives them (Grim-style). */
public final class VelocityListener implements Listener {

    private final PlayerDataManager playerDataManager;

    public VelocityListener(PlayerDataManager playerDataManager) {
        this.playerDataManager = playerDataManager;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onVelocity(PlayerVelocityEvent event) {
        if (event.getVelocity().lengthSquared() < 0.0001) {
            return;
        }
        var data = playerDataManager.get(event.getPlayer());
        data.setVelocityTicks(Math.max(data.getVelocityTicks(), 12));
        data.setUncertaintyTicks(Math.max(data.getUncertaintyTicks(), 6));
        data.setLastVelocity(event.getVelocity());
    }
}
