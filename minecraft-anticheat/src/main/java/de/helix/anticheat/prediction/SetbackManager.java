package de.helix.anticheat.prediction;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.data.PlayerData;
import de.helix.anticheat.data.PlayerDataManager;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.util.Vector;

/**
 * Grim-style setbacks: resync cheaters to the last valid position instead of
 * instantly banning on a single bad move.
 */
public final class SetbackManager {

    private final HelixACPlugin plugin;
    private final PlayerDataManager playerDataManager;

    public SetbackManager(HelixACPlugin plugin, PlayerDataManager playerDataManager) {
        this.plugin = plugin;
        this.playerDataManager = playerDataManager;
    }

    public void rememberValid(Player player, Location location) {
        if (location == null || location.getWorld() == null) {
            return;
        }
        PlayerData data = playerDataManager.get(player);
        data.setLastValidLocation(location);
    }

    public boolean setback(Player player, String reason) {
        PlayerData data = playerDataManager.get(player);
        Location target = data.getLastValidLocation();
        if (target == null || target.getWorld() == null) {
            target = player.getLocation();
        }
        final Location dest = target.clone();
        data.setExemptNextMove(true);
        data.setUncertaintyTicks(Math.max(data.getUncertaintyTicks(), 8));
        data.resetTickTracking();

        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!player.isOnline()) {
                return;
            }
            player.setVelocity(new Vector(0, 0, 0));
            player.teleport(dest, PlayerTeleportEvent.TeleportCause.PLUGIN);
            player.setVelocity(new Vector(0, 0, 0));
            plugin.getLogger().fine("Setback " + player.getName() + " — " + reason);
        });
        return true;
    }
}
