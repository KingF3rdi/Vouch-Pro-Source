package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.EquipmentSlot;

public final class InvalidInputCheck extends Check {

    public InvalidInputCheck(CheckManager manager) {
        super(manager, "InvalidInput");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isInvalidInputEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getInvalidInputWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getInvalidInputMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location to = event.getTo();
        if (to == null) {
            return;
        }

        if (player.isSprinting() && player.isSneaking() && !player.isInsideVehicle()
                && player.getGameMode() != GameMode.SPECTATOR) {
            data.addInputStreak(1);
            if (data.getInputStreak() >= manager.getConfig().getInvalidInputComboStreak()) {
                data.setInputStreak(0);
                flag(player, data, "sprint+sneak input");
            }
        } else {
            data.setInputStreak(Math.max(0, data.getInputStreak() - 1));
        }

        if (player.isSprinting() && player.isHandRaised() && !player.isInsideVehicle()) {
            flag(player, data, "sprint while using item");
        }

        if ((player.isDead() || player.isSleeping()) && event.hasExplicitlyChangedPosition()) {
            flag(player, data, "move input while dead/sleeping");
        }
    }

    public void onHotbarSwitch(Player player, PlayerData data, int newSlot) {
        if (!isEnabled()) {
            return;
        }
        if (newSlot < 0 || newSlot > 8) {
            flag(player, data, "hotbar slot out of range: " + newSlot);
        }
    }

    public void onSwapHands(Player player, PlayerData data) {
        if (!isEnabled()) {
            return;
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "swap hands while dead/sleeping");
        }

        long now = System.currentTimeMillis();
        if (now - data.getLastSwapHandsMs() < manager.getConfig().getInvalidInputMinSwapMs()) {
            data.addSwapStreak(1);
            if (data.getSwapStreak() >= 4) {
                data.setSwapStreak(0);
                flag(player, data, "swap-hands packet flood");
            }
        } else {
            data.setSwapStreak(0);
        }
        data.setLastSwapHandsMs(now);
    }

    public void onToggleSprint(Player player, PlayerData data, boolean sprinting) {
        if (!isEnabled()) {
            return;
        }
        if (sprinting && player.isSneaking() && !player.isInsideVehicle()) {
            flag(player, data, "sprint toggle while sneaking");
        }
        if (sprinting && player.getFoodLevel() <= 6 && player.getGameMode() == GameMode.SURVIVAL) {

            flag(player, data, "sprint with hunger " + player.getFoodLevel());
        }
    }

    public void onInteractWhileInvalid(Player player, PlayerData data, EquipmentSlot hand) {
        if (!isEnabled()) {
            return;
        }
        if (hand == null) {
            flag(player, data, "interact with null hand");
        }
        if (player.isDead() || player.isSleeping()) {
            flag(player, data, "interact while dead/sleeping");
        }
    }
}
