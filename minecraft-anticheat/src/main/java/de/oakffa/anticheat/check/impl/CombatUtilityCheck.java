package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

/**
 * Detects Prestige/Vape-style combat utility modules:
 * <ul>
 *   <li>Auto shield breaker — axe/hotbar swap + attack while victim is blocking</li>
 *   <li>Auto cobweb placer — combat-timed cobweb place + instant slot swap</li>
 *   <li>Auto cobweb break with water — water bucket emptied onto/next to cobweb</li>
 *   <li>Auto drain — instant water pickup after place (or after web-water cycle)</li>
 * </ul>
 */
public final class CombatUtilityCheck extends Check {

    private static final BlockFace[] ADJACENT = {
            BlockFace.SELF, BlockFace.UP, BlockFace.DOWN,
            BlockFace.NORTH, BlockFace.SOUTH, BlockFace.EAST, BlockFace.WEST
    };

    public CombatUtilityCheck(CheckManager manager) {
        super(manager, "CombatUtility");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isCombatUtilityEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getCombatUtilityWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getCombatUtilityMaxVl();
    }

    public void onHotbarSwitch(Player player, PlayerData data, int newSlot) {
        if (!isEnabled()) {
            return;
        }
        long now = System.currentTimeMillis();
        data.setLastHotbarSwitchMs(now);
        data.setLastHotbarSlot(newSlot);

        ItemStack stack = player.getInventory().getItem(newSlot);
        Material type = stack == null ? Material.AIR : stack.getType();
        if (isAxe(type)) {
            data.setLastAxeSwitchMs(now);
        } else if (type == Material.COBWEB) {
            data.setLastCobwebSwitchMs(now);
        } else if (type == Material.WATER_BUCKET || type == Material.BUCKET) {
            data.setLastBucketSwitchMs(now);
        }
    }

    public void onAttack(Player player, PlayerData data, Entity target) {
        if (!isEnabled() || !(target instanceof Player victim)) {
            return;
        }
        long now = System.currentTimeMillis();
        data.setLastCombatMs(now);

        if (!victim.isBlocking()) {
            return;
        }

        ItemStack hand = player.getInventory().getItemInMainHand();
        Material weapon = hand == null ? Material.AIR : hand.getType();
        boolean axe = isAxe(weapon);
        long sinceAxeSwitch = now - data.getLastAxeSwitchMs();
        int swapWindow = manager.getConfig().getCombatUtilityShieldSwapMs();

        // Classic auto shield breaker: hotbar → axe then attack blocking player in one packet burst
        if (axe && data.getLastAxeSwitchMs() > 0 && sinceAxeSwitch <= swapWindow) {
            data.addShieldBreakStreak(1);
            if (data.getShieldBreakStreak() >= manager.getConfig().getCombatUtilityShieldStreak()) {
                flag(player, data, String.format(
                        "auto shield-break swap+hit %dms (%s)", sinceAxeSwitch, weapon.name()));
                data.setShieldBreakStreak(0);
            }
            return;
        }

        // Repeated axe hits on a blocking target with robotic cadence
        if (axe) {
            long gap = data.getLastShieldHitMs() > 0 ? now - data.getLastShieldHitMs() : -1;
            data.setLastShieldHitMs(now);
            if (gap > 0 && gap <= manager.getConfig().getCombatUtilityShieldHitGapMs()) {
                data.addShieldBreakStreak(1);
                if (data.getShieldBreakStreak() >= manager.getConfig().getCombatUtilityShieldStreak() + 1) {
                    flag(player, data, String.format("auto shield-break cadence %dms", gap));
                    data.setShieldBreakStreak(0);
                }
            }
        }
    }

    public void onPlace(Player player, PlayerData data, Block placed) {
        if (!isEnabled() || placed == null) {
            return;
        }
        long now = System.currentTimeMillis();
        Material type = placed.getType();

        if (type == Material.COBWEB) {
            handleCobwebPlace(player, data, placed, now);
        }
    }

    public void onBucketEmpty(Player player, PlayerData data, Block clicked, BlockFace face) {
        if (!isEnabled()) {
            return;
        }
        long now = System.currentTimeMillis();
        data.setLastWaterPlaceMs(now);

        Block waterBlock = resolveBucketTarget(clicked, face);
        boolean nearWeb = waterTouchesCobweb(waterBlock);
        long sinceWeb = data.getLastCobwebPlaceMs() > 0 ? now - data.getLastCobwebPlaceMs() : Long.MAX_VALUE;
        long sinceBucketSwitch = data.getLastBucketSwitchMs() > 0 ? now - data.getLastBucketSwitchMs() : Long.MAX_VALUE;
        long sinceCombat = data.getLastCombatMs() > 0 ? now - data.getLastCombatMs() : Long.MAX_VALUE;
        long sinceAttack = data.getLastAttackMs() > 0 ? now - data.getLastAttackMs() : Long.MAX_VALUE;
        int webWaterWindow = manager.getConfig().getCombatUtilityWebWaterMs();
        int swapWindow = manager.getConfig().getCombatUtilityBucketSwapMs();
        int combatWindow = manager.getConfig().getCombatUtilityCombatWindowMs();

        // Auto cobweb break with water: dump water on/next to cobweb (own or nearby) in a burst
        if (nearWeb || sinceWeb <= webWaterWindow) {
            boolean swapped = sinceBucketSwitch <= swapWindow;
            boolean inFight = sinceCombat <= combatWindow || sinceAttack <= combatWindow || sinceWeb <= webWaterWindow;
            if (swapped || inFight || nearWeb) {
                data.addWebWaterStreak(1);
                if (data.getWebWaterStreak() >= manager.getConfig().getCombatUtilityWebWaterStreak()) {
                    flag(player, data, String.format(
                            "auto cobweb-break water nearWeb=%s swap=%dms sinceWeb=%dms",
                            nearWeb,
                            sinceBucketSwitch == Long.MAX_VALUE ? -1 : sinceBucketSwitch,
                            sinceWeb == Long.MAX_VALUE ? -1 : sinceWeb));
                    data.setWebWaterStreak(0);
                }
            }
        }

        // Track for auto-drain follow-up
        if (waterBlock != null) {
            data.setLastWaterBlockX(waterBlock.getX());
            data.setLastWaterBlockY(waterBlock.getY());
            data.setLastWaterBlockZ(waterBlock.getZ());
        }
    }

    public void onBucketFill(Player player, PlayerData data, Block block) {
        if (!isEnabled() || block == null) {
            return;
        }
        long now = System.currentTimeMillis();
        long sincePlace = now - data.getLastWaterPlaceMs();
        long sinceBucketSwitch = now - data.getLastBucketSwitchMs();
        int drainWindow = manager.getConfig().getCombatUtilityDrainMs();
        int swapWindow = manager.getConfig().getCombatUtilityBucketSwapMs();

        boolean sameSpot = data.getLastWaterPlaceMs() > 0
                && Math.abs(block.getX() - data.getLastWaterBlockX()) <= 1
                && Math.abs(block.getY() - data.getLastWaterBlockY()) <= 1
                && Math.abs(block.getZ() - data.getLastWaterBlockZ()) <= 1;

        boolean afterWebWater = data.getLastCobwebPlaceMs() > 0
                && now - data.getLastCobwebPlaceMs() <= manager.getConfig().getCombatUtilityWebWaterMs() * 2L;

        // Auto drain: pickup water almost immediately after placing (often after web-water)
        if (data.getLastWaterPlaceMs() > 0 && sincePlace <= drainWindow && (sameSpot || afterWebWater)) {
            boolean swapped = data.getLastBucketSwitchMs() > 0 && sinceBucketSwitch <= swapWindow;
            data.addDrainStreak(1);
            if (data.getDrainStreak() >= manager.getConfig().getCombatUtilityDrainStreak()
                    || (afterWebWater && data.getDrainStreak() >= 1 && swapped)) {
                flag(player, data, String.format(
                        "auto drain pickup %dms sameSpot=%s afterWebWater=%s",
                        sincePlace, sameSpot, afterWebWater));
                data.setDrainStreak(0);
            }
        } else if (sincePlace > drainWindow * 2L) {
            data.setDrainStreak(Math.max(0, data.getDrainStreak() - 1));
        }
    }

    private void handleCobwebPlace(Player player, PlayerData data, Block placed, long now) {
        data.setLastCobwebPlaceMs(now);
        long sinceSwitch = now - data.getLastCobwebSwitchMs();
        long sinceCombat = now - data.getLastCombatMs();
        long sinceAttack = now - data.getLastAttackMs();
        int swapWindow = manager.getConfig().getCombatUtilityWebSwapMs();
        int combatWindow = manager.getConfig().getCombatUtilityCombatWindowMs();

        boolean swapped = data.getLastCobwebSwitchMs() > 0 && sinceSwitch <= swapWindow;
        boolean inFight = (data.getLastCombatMs() > 0 && sinceCombat <= combatWindow)
                || (data.getLastAttackMs() > 0 && sinceAttack <= combatWindow);

        boolean nearEnemy = false;
        double nearRange = manager.getConfig().getCombatUtilityWebEnemyRange();
        for (Entity entity : player.getNearbyEntities(nearRange, nearRange, nearRange)) {
            if (entity instanceof Player other && !other.equals(player) && !other.isDead()) {
                nearEnemy = true;
                break;
            }
        }

        if ((swapped && (inFight || nearEnemy)) || (inFight && nearEnemy && sinceSwitch <= swapWindow * 2L)) {
            data.addCobwebPlaceStreak(1);
            if (data.getCobwebPlaceStreak() >= manager.getConfig().getCombatUtilityWebPlaceStreak()) {
                flag(player, data, String.format(
                        "auto cobweb place swap=%dms fight=%s nearEnemy=%s",
                        sinceSwitch, inFight, nearEnemy));
                data.setCobwebPlaceStreak(0);
            }
        } else if (!inFight) {
            data.setCobwebPlaceStreak(0);
        }
    }

    private static Block resolveBucketTarget(Block clicked, BlockFace face) {
        if (clicked == null) {
            return null;
        }
        if (face == null || face == BlockFace.SELF) {
            return clicked;
        }
        return clicked.getRelative(face);
    }

    private static boolean waterTouchesCobweb(Block waterBlock) {
        if (waterBlock == null) {
            return false;
        }
        for (BlockFace face : ADJACENT) {
            Block rel = face == BlockFace.SELF ? waterBlock : waterBlock.getRelative(face);
            if (rel.getType() == Material.COBWEB) {
                return true;
            }
        }
        return false;
    }

    private static boolean isAxe(Material type) {
        if (type == null) {
            return false;
        }
        String name = type.name();
        return name.endsWith("_AXE");
    }
}
