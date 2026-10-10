package de.oakffa.anticheat.data;

import de.oakffa.anticheat.OakFFAPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class IpStore {

    private final OakFFAPlugin plugin;
    private final File file;
    private final Map<UUID, String> ips = new ConcurrentHashMap<>();
    private final Map<String, UUID> nameIndex = new ConcurrentHashMap<>();

    public IpStore(OakFFAPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "ips.yml");
    }

    public void load() {
        ips.clear();
        nameIndex.clear();
        if (!file.exists()) {
            save();
            return;
        }
        FileConfiguration yaml = YamlConfiguration.loadConfiguration(file);
        if (yaml.getConfigurationSection("players") == null) {
            return;
        }
        for (String key : yaml.getConfigurationSection("players").getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                String ip = yaml.getString("players." + key + ".ip");
                String name = yaml.getString("players." + key + ".name");
                if (ip != null && !ip.isBlank()) {
                    ips.put(uuid, ip);
                }
                if (name != null && !name.isBlank()) {
                    nameIndex.put(name.toLowerCase(Locale.ROOT), uuid);
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
    }

    public void save() {
        FileConfiguration yaml = new YamlConfiguration();
        for (Map.Entry<UUID, String> e : ips.entrySet()) {
            yaml.set("players." + e.getKey() + ".ip", e.getValue());

        }
        for (Map.Entry<String, UUID> e : nameIndex.entrySet()) {
            yaml.set("players." + e.getValue() + ".name", e.getKey());
            if (ips.containsKey(e.getValue())) {
                yaml.set("players." + e.getValue() + ".ip", ips.get(e.getValue()));
            }
        }
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Could not create data folder for ips.yml");
            }
            yaml.save(file);
        } catch (IOException ex) {
            plugin.getLogger().severe("Failed to save ips.yml: " + ex.getMessage());
        }
    }

    public void record(UUID uuid, String name, String ip) {
        if (uuid == null || ip == null || ip.isBlank()) {
            return;
        }
        ips.put(uuid, ip);
        if (name != null && !name.isBlank()) {
            nameIndex.put(name.toLowerCase(Locale.ROOT), uuid);
        }
        save();
    }

    public String getIp(UUID uuid) {
        return ips.get(uuid);
    }

    public String getIpByName(String name) {
        UUID uuid = nameIndex.get(name.toLowerCase(Locale.ROOT));
        return uuid == null ? null : ips.get(uuid);
    }
}
