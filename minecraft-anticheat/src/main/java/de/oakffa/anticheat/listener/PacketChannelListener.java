package de.oakffa.anticheat.listener;

import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerDataManager;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerRegisterChannelEvent;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.nio.charset.StandardCharsets;

public final class PacketChannelListener implements Listener, PluginMessageListener {

    private final CheckManager checkManager;

    public PacketChannelListener(CheckManager checkManager, PlayerDataManager ignored) {
        this.checkManager = checkManager;

    }

    public void register(org.bukkit.plugin.java.JavaPlugin plugin) {
        plugin.getServer().getMessenger().registerIncomingPluginChannel(plugin, "minecraft:brand", this);
        plugin.getServer().getMessenger().registerIncomingPluginChannel(plugin, "MC|Brand", this);
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if ("minecraft:brand".equalsIgnoreCase(channel) || "MC|Brand".equals(channel)) {
            String brand = readBrand(message);
            checkManager.handleBrand(player, brand);
            return;
        }
        checkManager.handlePluginMessage(player, channel, message);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRegisterChannel(PlayerRegisterChannelEvent event) {
        checkManager.handlePluginMessage(event.getPlayer(), event.getChannel(), new byte[0]);
    }

    private static String readBrand(byte[] message) {
        if (message == null || message.length == 0) {
            return "unknown";
        }

        int index = 0;
        int length = 0;
        int shift = 0;
        while (index < message.length) {
            byte b = message[index++];
            length |= (b & 0x7F) << shift;
            if ((b & 0x80) == 0) {
                break;
            }
            shift += 7;
            if (shift > 21) {
                length = -1;
                break;
            }
        }
        if (length >= 0 && index + length <= message.length) {
            return new String(message, index, length, StandardCharsets.UTF_8).trim();
        }
        int start = 0;
        if (message.length > 1 && (message[0] & 0xFF) == message.length - 1) {
            start = 1;
        }
        return new String(message, start, message.length - start, StandardCharsets.UTF_8).trim();
    }
}
