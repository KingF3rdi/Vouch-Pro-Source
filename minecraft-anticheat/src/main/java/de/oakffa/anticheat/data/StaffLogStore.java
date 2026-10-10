package de.oakffa.anticheat.data;

import de.oakffa.anticheat.OakFFAPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;

public final class StaffLogStore {

    private final OakFFAPlugin plugin;
    private final File file;
    private final Deque<StaffLogEntry> logs = new ArrayDeque<>();
    private int maxLogs = 300;

    public StaffLogStore(OakFFAPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "staff-logs.yml");
    }

    public void setMaxLogs(int maxLogs) {
        this.maxLogs = Math.max(10, maxLogs);
        trim();
    }

    public void load() {
        logs.clear();
        if (!file.exists()) {
            save();
            return;
        }
        FileConfiguration yaml = YamlConfiguration.loadConfiguration(file);
        for (java.util.Map<?, ?> map : yaml.getMapList("commands")) {
            try {
                Object uuidObj = map.get("uuid");
                UUID uuid = uuidObj == null || String.valueOf(uuidObj).equals("null") || String.valueOf(uuidObj).isBlank()
                        ? null
                        : UUID.fromString(String.valueOf(uuidObj));
                Object ts = map.get("timestamp");
                long timestamp = ts instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(ts));
                logs.addLast(new StaffLogEntry(
                        timestamp,
                        uuid,
                        String.valueOf(map.get("player")),
                        String.valueOf(map.get("command"))
                ));
            } catch (Exception ignored) {
            }
        }
        trim();
    }

    public void save() {
        FileConfiguration yaml = new YamlConfiguration();
        List<java.util.Map<String, Object>> rows = new ArrayList<>();
        for (StaffLogEntry e : logs) {
            java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("timestamp", e.getTimestamp());
            map.put("uuid", e.getUuid() == null ? null : e.getUuid().toString());
            map.put("player", e.getPlayerName());
            map.put("command", e.getCommand());
            rows.add(map);
        }
        yaml.set("commands", rows);
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Could not create data folder for staff-logs.yml");
            }
            yaml.save(file);
        } catch (IOException ex) {
            plugin.getLogger().severe("Failed to save staff-logs.yml: " + ex.getMessage());
        }
    }

    public void add(StaffLogEntry entry) {
        logs.addLast(entry);
        trim();
        save();
    }

    public List<StaffLogEntry> latest(int limit) {
        List<StaffLogEntry> list = new ArrayList<>(logs);
        if (list.isEmpty() || limit <= 0) {
            return List.of();
        }
        int from = Math.max(0, list.size() - limit);
        List<StaffLogEntry> slice = new ArrayList<>(list.subList(from, list.size()));
        java.util.Collections.reverse(slice);
        return slice;
    }

    private void trim() {
        while (logs.size() > maxLogs) {
            logs.removeFirst();
        }
    }
}
