package de.helix.anticheat.check.impl;

import de.helix.anticheat.check.Check;
import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Vector;

/**
 * Detects invalid action packets: dig sequence spoof, impossible place/interact/attack reach,
 * abort without start, air place, etc.
 */
public final class InvalidActionCheck extends Check {

    public InvalidActionCheck(CheckManager manager) {
        super(manager, "InvalidAction");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isInvalidActionEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getInvalidActionWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getInvalidActionMaxVl();
    }

    public void onDigStart(Player player, PlayerData data, Block block) {
        if (!isEnabled() || block == null) {
            return;
        }
        if (isTooFar(player, block.getLocation().add(0.5, 0.5, 0.5), true)) {
            flag(player, data, "dig start out of reach");
        }
        if (block.getType().isAir()) {
            flag(player, data, "dig start on air");
        }
        data.setDigging(true);
        data.setDigBlock(block.getLocation());
        data.setDigStartMs(System.currentTimeMillis());
    }

    public void onDigAbort(Player player, PlayerData data, Block block) {
        if (!isEnabled()) {
            return;
        }
        if (!data.isDigging()) {
            flag(player, data, "dig abort without start");
            return;
        }
        data.setDigging(false);
        data.setDigBlock(null);
    }

    public void onDigBreak(Player player, PlayerData data, Block block) {
        if (!isEnabled() || block == null) {
            return;
        }
        if (isTooFar(player, block.getLocation().add(0.5, 0.5, 0.5), true)) {
            flag(player, data, "dig break out of reach");
        }
        // Instant break of hard blocks without dig start is suspicious in survival
        if (!data.isDigging()
                && player.getGameMode() == GameMode.SURVIVAL
                && block.getType().getHardness() > 0.5f
                && !isFastBreakTool(player, block)) {
            flag(player, data, "break without dig-start (" + block.getType() + ")");
        }
        data.setDigging(false);
        data.setDigBlock(null);
    }

    public void onPlace(Player player, PlayerData data, Block placedAgainst, BlockFace face, Block placed) {
        if (!isEnabled()) {
            return;
        }
        if (face == null || face == BlockFace.SELF) {
            flag(player, data, "place with invalid face");
        }
        if (placed != null && isTooFar(player, placed.getLocation().add(0.5, 0.5, 0.5), true)) {
            flag(player, data, "place out of reach");
        }
        if (placedAgainst != null && placedAgainst.getType().isAir()) {
            flag(player, data, "place against air");
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "place while dead/sleeping");
        }
    }

    public void onInteract(Player player, PlayerData data, Block block, Entity entity, boolean leftClick) {
        if (!isEnabled()) {
            return;
        }
        if (block != null) {
            if (isTooFar(player, block.getLocation().add(0.5, 0.5, 0.5), true)) {
                flag(player, data, (leftClick ? "left" : "right") + "-click block out of reach");
            }
        }
        if (entity != null && !(entity instanceof Player && entity.equals(player))) {
            // interact-entity path; attack handled separately
            if (isTooFar(player, entity.getLocation().add(0, entity.getHeight() * 0.5, 0), false)) {
                flag(player, data, "interact entity out of reach");
            }
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "interact while dead/sleeping");
        }
    }

    public void onAttack(Player player, PlayerData data, Entity target) {
        if (!isEnabled() || target == null) {
            return;
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "attack while dead/sleeping");
            return;
        }
        Location aimPoint = target.getLocation().clone().add(0, Math.min(target.getHeight() * 0.9, 1.6), 0);
        if (isTooFar(player, aimPoint, false)) {
            flag(player, data, String.format("attack out of reach (%.2f)",
                    player.getEyeLocation().distance(aimPoint)));
        }
        // Attack through walls-ish: target far behind look direction
        Vector look = player.getEyeLocation().getDirection().normalize();
        Vector toTarget = aimPoint.toVector().subtract(player.getEyeLocation().toVector());
        if (toTarget.lengthSquared() > 0.01) {
            double dot = look.dot(toTarget.normalize());
            if (dot < manager.getConfig().getInvalidActionMinAttackDot()
                    && player.getEyeLocation().distanceSquared(aimPoint) > 2.25) {
                flag(player, data, String.format("attack off-angle dot=%.2f", dot));
            }
        }
    }

    public void onDrop(Player player, PlayerData data) {
        if (!isEnabled()) {
            return;
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "drop while dead/sleeping");
        }
        long now = System.currentTimeMillis();
        if (now - data.getLastDropMs() < manager.getConfig().getInvalidActionMinDropMs()) {
            data.addDropStreak(1);
            if (data.getDropStreak() >= 6) {
                data.setDropStreak(0);
                flag(player, data, "drop packet flood");
            }
        } else {
            data.setDropStreak(0);
        }
        data.setLastDropMs(now);
    }

    private boolean isTooFar(Player player, Location target, boolean blockAction) {
        double dist = player.getEyeLocation().distance(target);
        double max = blockAction
                ? (player.getGameMode() == GameMode.CREATIVE ? 6.0 : 5.2)
                : (player.getGameMode() == GameMode.CREATIVE ? 6.0 : 3.2);
        // Ping compensation (generous — avoid false flags)
        max += Math.min(1.25, Math.max(0, player.getPing()) / 150.0);
        max += manager.getConfig().getInvalidActionReachBuffer();
        return dist > max;
    }

    private static boolean isFastBreakTool(Player player, Block block) {
        ItemStack hand = player.getInventory().getItemInMainHand();
        if (hand == null || hand.getType() == Material.AIR) {
            return false;
        }
        // Efficiency enchanted tools / creative-like instant breaks — be lenient
        return hand.getType().name().contains("PICKAXE")
                || hand.getType().name().contains("AXE")
                || hand.getType().name().contains("SHOVEL")
                || hand.getType().name().contains("SHEARS");
    }
}
