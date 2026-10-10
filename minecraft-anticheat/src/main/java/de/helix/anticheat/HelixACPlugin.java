package de.helix.anticheat;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.command.AcCommand;
import de.helix.anticheat.config.PluginConfig;
import de.helix.anticheat.data.LogStore;
import de.helix.anticheat.data.PlayerDataManager;
import de.helix.anticheat.data.WhitelistStore;
import de.helix.anticheat.listener.BanLogsInterceptListener;
import de.helix.anticheat.listener.ConnectionListener;
import de.helix.anticheat.listener.MovementListener;
import de.helix.anticheat.listener.PacketChannelListener;
import de.helix.anticheat.punishment.PunishmentManager;
import de.helix.anticheat.util.Messages;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

public final class HelixACPlugin extends JavaPlugin {

    private PluginConfig pluginConfig;
    private Messages messages;
    private PlayerDataManager playerDataManager;
    private WhitelistStore whitelistStore;
    private LogStore logStore;
    private PunishmentManager punishmentManager;
    private CheckManager checkManager;
    private PacketChannelListener packetChannelListener;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.pluginConfig = new PluginConfig(this);
        this.messages = new Messages(pluginConfig);
        this.playerDataManager = new PlayerDataManager();
        this.whitelistStore = new WhitelistStore(this);
        this.logStore = new LogStore(this, pluginConfig);
        this.punishmentManager = new PunishmentManager(this, pluginConfig, messages, logStore, whitelistStore);
        this.checkManager = new CheckManager(this, pluginConfig, playerDataManager, punishmentManager, messages);

        whitelistStore.load();
        logStore.load();

        packetChannelListener = new PacketChannelListener(checkManager, playerDataManager);
        packetChannelListener.register(this);

        Bukkit.getPluginManager().registerEvents(new ConnectionListener(playerDataManager, checkManager), this);
        Bukkit.getPluginManager().registerEvents(new MovementListener(checkManager, playerDataManager), this);
        Bukkit.getPluginManager().registerEvents(packetChannelListener, this);

        BanLogsInterceptListener banLogsIntercept = new BanLogsInterceptListener(this);
        Bukkit.getPluginManager().registerEvents(banLogsIntercept, this);

        AcCommand acCommand = new AcCommand(this, banLogsIntercept.getBanLogsCommand());
        getCommand("ac").setExecutor(acCommand);
        getCommand("ac").setTabCompleter(acCommand);

        getLogger().info("HelixAC enabled — LuckPerms softdepend, packet/movement/ghost checks active.");
        if (Bukkit.getPluginManager().getPlugin("LuckPerms") != null) {
            getLogger().info("LuckPerms detected. Permissions: ac.bypass, ac.whitelist, ac.admin, ac.banlogs, ac.notify");
        } else {
            getLogger().info("LuckPerms not found — using Bukkit permissions (compatible when LuckPerms is installed later).");
        }
    }

    @Override
    public void onDisable() {
        if (packetChannelListener != null) {
            getServer().getMessenger().unregisterIncomingPluginChannel(this);
        }
        if (whitelistStore != null) {
            whitelistStore.save();
        }
        if (logStore != null) {
            logStore.save();
        }
        if (playerDataManager != null) {
            playerDataManager.clear();
        }
    }

    public void reloadPlugin() {
        reloadConfig();
        pluginConfig.reload();
        messages.reload();
        whitelistStore.load();
        logStore.reloadLimits();
    }

    public PluginConfig getPluginConfig() {
        return pluginConfig;
    }

    public Messages getMessages() {
        return messages;
    }

    public PlayerDataManager getPlayerDataManager() {
        return playerDataManager;
    }

    public WhitelistStore getWhitelistStore() {
        return whitelistStore;
    }

    public LogStore getLogStore() {
        return logStore;
    }

    public PunishmentManager getPunishmentManager() {
        return punishmentManager;
    }

    public CheckManager getCheckManager() {
        return checkManager;
    }
}
