package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

public final class InvalidPacketCheck extends Check {

    public InvalidPacketCheck(CheckManager manager) {
        super(manager, "InvalidPacket");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isInvalidPacketEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getInvalidPacketWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getInvalidPacketMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location to = event.getTo();
        if (to == null) {
            return;
        }

        double x = to.getX();
        double y = to.getY();
        double z = to.getZ();
        float yaw = to.getYaw();
        float pitch = to.getPitch();

        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)
                || !Float.isFinite(yaw) || !Float.isFinite(pitch)) {
            flag(player, data, "non-finite position/rotation");
            event.setCancelled(true);
            return;
        }

        if (pitch > 90.0f || pitch < -90.0f) {
            flag(player, data, "pitch out of range (" + pitch + ")");
            event.setCancelled(true);
            return;
        }

        if (Math.abs(x) > 3.0E7 || Math.abs(z) > 3.0E7 || y < -2048 || y > 4096) {
            flag(player, data, "position outside world bounds");
            event.setCancelled(true);
        }
    }
}
