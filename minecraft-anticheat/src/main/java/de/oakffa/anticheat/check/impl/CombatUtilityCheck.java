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
        if (!isAxe(weapon)) {
            return;
        }

        long delay = -1;
        String kind;
        if (data.getLastAxeSwitchMs() > 0 && now - data.getLastAxeSwitchMs() <= 1000L) {
            delay = now - data.getLastAxeSwitchMs();
            kind = "swap→hit";
        } else if (data.getLastShieldHitMs() > 0) {
            delay = now - data.getLastShieldHitMs();
            kind = "hit→hit";
        } else {
            data.setLastShieldHitMs(now);
            return;
        }
        data.setLastShieldHitMs(now);

        if (hasInvalidInput(player, data)) {
            flag(player, data, "shield-break with invalid input (" + kind + " " + delay + "ms, " + weapon.name() + ")");
            data.setShieldIdenticalStreak(0);
            return;
        }

        if (delay > 0 && delay == data.getLastShieldBreakDelayMs()) {
            data.addShieldIdenticalStreak(1);
            if (data.getShieldIdenticalStreak() >= manager.getConfig().getCombatUtilityIdenticalStreak()) {
                flag(player, data, String.format(
                        "shield-break identical %s delay=%dms x%d",
                        kind, delay, data.getShieldIdenticalStreak() + 1));
                data.setShieldIdenticalStreak(0);
            }
        } else {
            data.setShieldIdenticalStreak(0);
        }
        data.setLastShieldBreakDelayMs(delay);
    }

    public void onPlace(Player player, PlayerData data, Block placed) {
        if (!isEnabled() || placed == null) {
            return;
        }
        long now = System.currentTimeMillis();
        if (placed.getType() == Material.COBWEB) {
            handleCobwebPlace(player, data, now);
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
        long sinceWeb = data.getLastCobwebPlaceMs() > 0 ? now - data.getLastCobwebPlaceMs() : -1;
        int webWaterWindow = manager.getConfig().getCombatUtilityWebWaterMs();

        boolean webBreakContext = nearWeb || (sinceWeb >= 0 && sinceWeb <= webWaterWindow);
        if (webBreakContext) {

            long delay;
            String kind;
            if (data.getLastBucketSwitchMs() > 0 && now - data.getLastBucketSwitchMs() <= 1000L) {
                delay = now - data.getLastBucketSwitchMs();
                kind = "swap→water";
            } else if (sinceWeb >= 0) {
                delay = sinceWeb;
                kind = "web→water";
            } else {
                delay = -1;
                kind = "water";
            }

            if (hasInvalidInput(player, data)) {
                flag(player, data, "cobweb-break water with invalid input (" + kind + " " + delay + "ms)");
                data.setWebWaterIdenticalStreak(0);
            } else if (delay > 0 && delay == data.getLastWebWaterDelayMs()) {
                data.addWebWaterIdenticalStreak(1);
                if (data.getWebWaterIdenticalStreak() >= manager.getConfig().getCombatUtilityIdenticalStreak()) {
                    flag(player, data, String.format(
                            "cobweb-break water identical %s delay=%dms x%d",
                            kind, delay, data.getWebWaterIdenticalStreak() + 1));
                    data.setWebWaterIdenticalStreak(0);
                }
            } else {
                data.setWebWaterIdenticalStreak(0);
            }
            if (delay > 0) {
                data.setLastWebWaterDelayMs(delay);
            }
        }

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
        if (data.getLastWaterPlaceMs() <= 0) {
            return;
        }
        long now = System.currentTimeMillis();
        long sincePlace = now - data.getLastWaterPlaceMs();

        boolean sameSpot = Math.abs(block.getX() - data.getLastWaterBlockX()) <= 1
                && Math.abs(block.getY() - data.getLastWaterBlockY()) <= 1
                && Math.abs(block.getZ() - data.getLastWaterBlockZ()) <= 1;
        if (!sameSpot && sincePlace > 2000L) {
            data.setDrainIdenticalStreak(0);
            return;
        }

        if (hasInvalidInput(player, data)) {
            flag(player, data, "drain with invalid input (place→fill " + sincePlace + "ms)");
            data.setDrainIdenticalStreak(0);
            data.setLastDrainDelayMs(sincePlace);
            return;
        }

        if (sincePlace > 0 && sincePlace == data.getLastDrainDelayMs()) {
            data.addDrainIdenticalStreak(1);
            if (data.getDrainIdenticalStreak() >= manager.getConfig().getCombatUtilityIdenticalStreak()) {
                flag(player, data, String.format(
                        "drain identical place→fill delay=%dms x%d",
                        sincePlace, data.getDrainIdenticalStreak() + 1));
                data.setDrainIdenticalStreak(0);
            }
        } else {
            data.setDrainIdenticalStreak(0);
        }
        data.setLastDrainDelayMs(sincePlace);
    }

    private void handleCobwebPlace(Player player, PlayerData data, long now) {
        data.setLastCobwebPlaceMs(now);
        long sinceSwitch = data.getLastCobwebSwitchMs() > 0 ? now - data.getLastCobwebSwitchMs() : -1;
        long sinceCombat = data.getLastCombatMs() > 0 ? now - data.getLastCombatMs() : Long.MAX_VALUE;
        long sinceAttack = data.getLastAttackMs() > 0 ? now - data.getLastAttackMs() : Long.MAX_VALUE;
        int combatWindow = manager.getConfig().getCombatUtilityCombatWindowMs();

        boolean inFight = sinceCombat <= combatWindow || sinceAttack <= combatWindow;
        boolean nearEnemy = false;
        double nearRange = manager.getConfig().getCombatUtilityWebEnemyRange();
        for (Entity entity : player.getNearbyEntities(nearRange, nearRange, nearRange)) {
            if (entity instanceof Player other && !other.equals(player) && !other.isDead()) {
                nearEnemy = true;
                break;
            }
        }

        if (!(inFight || nearEnemy)) {
            data.setCobwebPlaceIdenticalStreak(0);
            return;
        }

        if (hasInvalidInput(player, data)) {
            flag(player, data, "cobweb place with invalid input");
            data.setCobwebPlaceIdenticalStreak(0);
            return;
        }

        if (sinceSwitch > 0 && sinceSwitch == data.getLastCobwebPlaceDelayMs()) {
            data.addCobwebPlaceIdenticalStreak(1);
            if (data.getCobwebPlaceIdenticalStreak() >= manager.getConfig().getCombatUtilityIdenticalStreak()) {
                flag(player, data, String.format(
                        "cobweb place identical swap→place delay=%dms x%d",
                        sinceSwitch, data.getCobwebPlaceIdenticalStreak() + 1));
                data.setCobwebPlaceIdenticalStreak(0);
            }
        } else {
            data.setCobwebPlaceIdenticalStreak(0);
        }
        if (sinceSwitch > 0) {
            data.setLastCobwebPlaceDelayMs(sinceSwitch);
        }
    }

    private boolean hasInvalidInput(Player player, PlayerData data) {
        if (player.isDead() || player.isSleeping()) {
            return true;
        }
        if (player.isSprinting() && player.isSneaking()) {
            return true;
        }
        if (player.isSprinting() && player.isHandRaised()) {
            return true;
        }
        if (data.getInputStreak() >= manager.getConfig().getInvalidInputComboStreak()) {
            return true;
        }
        if (data.getSwapStreak() >= 4) {
            return true;
        }

        if (data.getVl("InvalidInput") >= 2) {
            return true;
        }
        return false;
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
        return type != null && type.name().endsWith("_AXE");
    }
}
