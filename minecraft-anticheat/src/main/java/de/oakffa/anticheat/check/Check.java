package de.oakffa.anticheat.check;

import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

public abstract class Check {

    protected final CheckManager manager;
    private final String name;

    protected Check(CheckManager manager, String name) {
        this.manager = manager;
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public abstract boolean isEnabled();

    public abstract int getWeight();

    public abstract int getMaxVl();

    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
    }

    public void onBrand(Player player, PlayerData data, String brand) {
    }

    public void onPluginMessage(Player player, PlayerData data, String channel, byte[] payload) {
    }

    public void onJoin(Player player, PlayerData data) {
    }

    protected void flag(Player player, PlayerData data, String detail) {
        int vl = data.addVl(name, 1);
        manager.getPunishmentManager().flag(player, data, name, vl, detail, getWeight());
        if (vl >= getMaxVl()) {

            data.decayVl(name, Math.max(1, getMaxVl() / 2));
        }
    }
}
