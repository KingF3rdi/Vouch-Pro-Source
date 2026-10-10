package de.oakffa.anticheat.data;

import de.oakffa.anticheat.OakFFAPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public final class WhitelistStore {

    private final OakFFAPlugin plugin;
    private final File file;
    private final Map<UUID, String> whitelist = new LinkedHashMap<>();

    public WhitelistStore(OakFFAPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "whitelist.yml");
    }

    public void load() {
        whitelist.clear();
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
                String name = yaml.getString("players." + key, "unknown");
                whitelist.put(uuid, name);
            } catch (IllegalArgumentException ignored) {
                plugin.getLogger().warning("Invalid whitelist UUID: " + key);
            }
        }
    }

    public void save() {
        FileConfiguration yaml = new YamlConfiguration();
        for (Map.Entry<UUID, String> e : whitelist.entrySet()) {
            yaml.set("players." + e.getKey(), e.getValue());
        }
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Could not create data folder for whitelist.");
            }
            yaml.save(file);
        } catch (IOException ex) {
            plugin.getLogger().severe("Failed to save whitelist.yml: " + ex.getMessage());
        }
    }

    public boolean add(UUID uuid, String name) {
        whitelist.put(uuid, name);
        save();
        return true;
    }

    public boolean remove(UUID uuid) {
        boolean removed = whitelist.remove(uuid) != null;
        if (removed) {
            save();
        }
        return removed;
    }

    public boolean contains(UUID uuid) {
        return whitelist.containsKey(uuid);
    }

    public Map<UUID, String> all() {
        return Collections.unmodifiableMap(whitelist);
    }

    public UUID findByName(String name) {
        String needle = name.toLowerCase(Locale.ROOT);
        for (Map.Entry<UUID, String> e : whitelist.entrySet()) {
            if (e.getValue() != null && e.getValue().toLowerCase(Locale.ROOT).equals(needle)) {
                return e.getKey();
            }
        }
        return null;
    }
}
