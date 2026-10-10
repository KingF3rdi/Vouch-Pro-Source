package de.helix.anticheat.listener;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.check.impl.TickAbuseCheck;
import de.helix.anticheat.data.PlayerDataManager;
import de.helix.anticheat.util.Permissions;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;

public final class TickActionListener implements Listener {

    private final CheckManager checkManager;
    private final PlayerDataManager playerDataManager;

    public TickActionListener(CheckManager checkManager, PlayerDataManager playerDataManager) {
        this.checkManager = checkManager;
        this.playerDataManager = playerDataManager;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAttack(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player)) {
            return;
        }
        if (Permissions.hasBypass(player)) {
            return;
        }
        checkManager.handleTickAction(player, playerDataManager.get(player), TickAbuseCheck.ActionType.ATTACK);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        if (Permissions.hasBypass(player)) {
            return;
        }
        if (event.getAction() == null) {
            return;
        }
        checkManager.handleTickAction(player, playerDataManager.get(player), TickAbuseCheck.ActionType.INTERACT);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        if (Permissions.hasBypass(player)) {
            return;
        }
        checkManager.handleTickAction(player, playerDataManager.get(player), TickAbuseCheck.ActionType.DIG);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        if (Permissions.hasBypass(player)) {
            return;
        }
        checkManager.handleTickAction(player, playerDataManager.get(player), TickAbuseCheck.ActionType.PLACE);
    }
}
