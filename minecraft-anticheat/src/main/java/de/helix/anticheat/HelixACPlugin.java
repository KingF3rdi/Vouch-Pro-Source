package de.helix.anticheat;

import de.helix.anticheat.check.CheckManager;
import de.helix.anticheat.check.MeteorSignProbe;
import de.helix.anticheat.command.AcCommand;
import de.helix.anticheat.command.BanLogsCommand;
import de.helix.anticheat.command.LogPresenter;
import de.helix.anticheat.config.PluginConfig;
import de.helix.anticheat.data.IpStore;
import de.helix.anticheat.data.LogStore;
import de.helix.anticheat.data.PlayerDataManager;
import de.helix.anticheat.data.StaffLogStore;
import de.helix.anticheat.data.WhitelistStore;
import de.helix.anticheat.listener.BanLogsInterceptListener;
import de.helix.anticheat.listener.ConnectionListener;
import de.helix.anticheat.listener.MovementListener;
import de.helix.anticheat.listener.PacketChannelListener;
import de.helix.anticheat.listener.StaffCommandListener;
import de.helix.anticheat.listener.TickActionListener;
import de.helix.anticheat.punishment.PunishmentManager;
import de.helix.anticheat.util.Messages;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

public final class HelixACPlugin extends JavaPlugin {

    private PluginConfig pluginConfig;
    private Messages messages;
    private PlayerDataManager playerDataManager;
    private WhitelistStore whitelistStore;
    private IpStore ipStore;
    private LogStore logStore;
    private StaffLogStore staffLogStore;
    private PunishmentManager punishmentManager;
    private CheckManager checkManager;
    private MeteorSignProbe meteorSignProbe;
    private PacketChannelListener packetChannelListener;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.pluginConfig = new PluginConfig(this);
        this.messages = new Messages(pluginConfig);
        this.playerDataManager = new PlayerDataManager();
        this.whitelistStore = new WhitelistStore(this);
        this.ipStore = new IpStore(this);
        this.logStore = new LogStore(this, pluginConfig);
        this.staffLogStore = new StaffLogStore(this);
        this.staffLogStore.setMaxLogs(pluginConfig.getMaxStaffLogs());
        this.punishmentManager = new PunishmentManager(this, pluginConfig, messages, logStore, whitelistStore, ipStore);
        this.checkManager = new CheckManager(this, pluginConfig, playerDataManager, punishmentManager, messages);
        this.meteorSignProbe = new MeteorSignProbe(this, pluginConfig, playerDataManager, punishmentManager, messages);

        whitelistStore.load();
        ipStore.load();
        logStore.load();
        staffLogStore.load();

        packetChannelListener = new PacketChannelListener(checkManager, playerDataManager);
        packetChannelListener.register(this);

        Bukkit.getPluginManager().registerEvents(
                new ConnectionListener(playerDataManager, checkManager, ipStore, meteorSignProbe), this);
        Bukkit.getPluginManager().registerEvents(new MovementListener(checkManager, playerDataManager), this);
        Bukkit.getPluginManager().registerEvents(new TickActionListener(checkManager, playerDataManager), this);
        Bukkit.getPluginManager().registerEvents(packetChannelListener, this);
        Bukkit.getPluginManager().registerEvents(meteorSignProbe, this);
        Bukkit.getPluginManager().registerEvents(new StaffCommandListener(staffLogStore), this);

        LogPresenter logPresenter = new LogPresenter(this);
        BanLogsCommand banLogsCommand = new BanLogsCommand(logPresenter, messages);
        Bukkit.getPluginManager().registerEvents(new BanLogsInterceptListener(banLogsCommand), this);

        AcCommand acCommand = new AcCommand(this, logPresenter);
        getCommand("ac").setExecutor(acCommand);
        getCommand("ac").setTabCompleter(acCommand);

        getLogger().info("HelixAC enabled — Meteor sign probe + staff command logging active.");
        if (Bukkit.getPluginManager().getPlugin("LuckPerms") != null) {
            getLogger().info("LuckPerms detected. Permissions: ac.flags, ac.logs, ac.ban, ac.clear, ac.wipe, ac.admin, …");
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
        if (ipStore != null) {
            ipStore.save();
        }
        if (logStore != null) {
            logStore.save();
        }
        if (staffLogStore != null) {
            staffLogStore.save();
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
        ipStore.load();
        logStore.reloadLimits();
        staffLogStore.setMaxLogs(pluginConfig.getMaxStaffLogs());
        staffLogStore.load();
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

    public IpStore getIpStore() {
        return ipStore;
    }

    public LogStore getLogStore() {
        return logStore;
    }

    public StaffLogStore getStaffLogStore() {
        return staffLogStore;
    }

    public PunishmentManager getPunishmentManager() {
        return punishmentManager;
    }

    public CheckManager getCheckManager() {
        return checkManager;
    }
}
