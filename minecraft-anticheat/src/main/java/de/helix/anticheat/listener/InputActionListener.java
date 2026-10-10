package de.helix.anticheat.listener;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.check.impl.InvalidActionCheck;
import de.helix.anticheat.check.impl.InvalidInputCheck;
import de.helix.anticheat.data.PlayerData;
import de.helix.anticheat.data.PlayerDataManager;
import de.helix.anticheat.util.Permissions;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockDamageAbortEvent;
import org.bukkit.event.block.BlockDamageEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.event.player.PlayerSwapHandItemsEvent;
import org.bukkit.event.player.PlayerToggleSprintEvent;
import org.bukkit.inventory.EquipmentSlot;

/**
 * Feeds Bukkit action/input events into InvalidInput / InvalidAction checks
 * (Paper-side view of client action & input packets).
 */
public final class InputActionListener implements Listener {

    private final CheckManager checkManager;
    private final PlayerDataManager playerDataManager;

    public InputActionListener(CheckManager checkManager, PlayerDataManager playerDataManager) {
        this.checkManager = checkManager;
        this.playerDataManager = playerDataManager;
    }

    private PlayerData data(Player player) {
        return playerDataManager.get(player);
    }

    private boolean bypass(Player player) {
        return Permissions.hasBypass(player);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onItemHeld(PlayerItemHeldEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidInputCheck input && input.isEnabled()) {
                input.onHotbarSwitch(player, data(player), event.getNewSlot());
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onSwap(PlayerSwapHandItemsEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidInputCheck input && input.isEnabled()) {
                input.onSwapHands(player, data(player));
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onSprint(PlayerToggleSprintEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidInputCheck input && input.isEnabled()) {
                input.onToggleSprint(player, data(player), event.isSprinting());
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDigStart(BlockDamageEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onDigStart(player, data(player), event.getBlock());
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDigAbort(BlockDamageAbortEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onDigAbort(player, data(player), event.getBlock());
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onDigBreak(player, data(player), event.getBlock());
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                var against = event.getBlockAgainst();
                var placed = event.getBlockPlaced();
                var face = against == null || placed == null ? null : against.getFace(placed);
                action.onPlace(player, data(player), against, face, placed);
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = false)
    public void onInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        PlayerData pd = data(player);
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidInputCheck input && input.isEnabled()) {
                EquipmentSlot hand = event.getHand();
                input.onInteractWhileInvalid(player, pd, hand);
            }
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                boolean left = event.getAction() != null && event.getAction().name().contains("LEFT");
                action.onInteract(player, pd, event.getClickedBlock(), null, left);
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteractEntity(PlayerInteractEntityEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onInteract(player, data(player), null, event.getRightClicked(), false);
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onAttack(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player)) {
            return;
        }
        if (bypass(player)) {
            return;
        }
        Entity target = event.getEntity();
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onAttack(player, data(player), target);
            }
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent event) {
        Player player = event.getPlayer();
        if (bypass(player)) {
            return;
        }
        for (var check : checkManager.getChecks()) {
            if (check instanceof InvalidActionCheck action && action.isEnabled()) {
                action.onDrop(player, data(player));
            }
        }
    }
}
