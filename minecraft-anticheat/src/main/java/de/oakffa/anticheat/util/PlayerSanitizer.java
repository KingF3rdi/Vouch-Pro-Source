package de.oakffa.anticheat.util;

import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.Statistic;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;

public final class PlayerSanitizer {

    private PlayerSanitizer() {
    }

    public static void clearInventory(Player player) {
        player.getInventory().clear();
        player.getInventory().setArmorContents(null);
        player.getInventory().setExtraContents(null);
        player.getInventory().setItemInOffHand(new ItemStack(Material.AIR));
        player.setItemOnCursor(null);
        player.updateInventory();
    }

    public static void wipePlayer(Player player) {
        clearInventory(player);
        player.getEnderChest().clear();

        player.setLevel(0);
        player.setExp(0f);
        player.setTotalExperience(0);

        for (PotionEffect effect : player.getActivePotionEffects()) {
            player.removePotionEffect(effect.getType());
        }

        player.setFireTicks(0);
        player.setFoodLevel(20);
        player.setSaturation(5f);
        player.setExhaustion(0f);
        if (player.getAttribute(Attribute.GENERIC_MAX_HEALTH) != null) {
            player.setHealth(player.getAttribute(Attribute.GENERIC_MAX_HEALTH).getValue());
        }
        if (player.getGameMode() != GameMode.SPECTATOR) {
            player.setRemainingAir(player.getMaximumAir());
        }

        wipeStatistics(player);
        player.updateInventory();
    }

    private static void wipeStatistics(Player player) {
        for (Statistic statistic : Statistic.values()) {
            try {
                switch (statistic.getType()) {
                    case UNTYPED -> player.setStatistic(statistic, 0);
                    case ENTITY -> {
                        for (EntityType type : EntityType.values()) {
                            if (type == EntityType.UNKNOWN) {
                                continue;
                            }
                            try {
                                player.setStatistic(statistic, type, 0);
                            } catch (IllegalArgumentException ignored) {
                            }
                        }
                    }
                    case BLOCK, ITEM -> {
                        for (Material material : Material.values()) {
                            if (material.isLegacy()) {
                                continue;
                            }
                            try {
                                player.setStatistic(statistic, material, 0);
                            } catch (IllegalArgumentException ignored) {
                            }
                        }
                    }
                    default -> {
                    }
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
    }
}
