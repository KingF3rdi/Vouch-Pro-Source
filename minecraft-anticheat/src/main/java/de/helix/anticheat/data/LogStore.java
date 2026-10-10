package de.helix.anticheat.data;

import de.helix.anticheat.HelixACPlugin;
import de.helix.anticheat.config.PluginConfig;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

public final class LogStore {

    private final HelixACPlugin plugin;
    private final PluginConfig config;
    private final File file;
    private final Deque<FlagLogEntry> flagLogs = new ArrayDeque<>();
    private final Deque<BanLogEntry> banLogs = new ArrayDeque<>();

    public LogStore(HelixACPlugin plugin, PluginConfig config) {
        this.plugin = plugin;
        this.config = config;
        this.file = new File(plugin.getDataFolder(), "logs.yml");
    }

    public void load() {
        flagLogs.clear();
        banLogs.clear();
        if (!file.exists()) {
            save();
            return;
        }
        FileConfiguration yaml = YamlConfiguration.loadConfiguration(file);
        List<java.util.Map<?, ?>> flagMaps = castMapList(yaml.getMapList("flags"));
        for (java.util.Map<?, ?> map : flagMaps) {
            try {
                FlagLogEntry entry = new FlagLogEntry(
                        longVal(map.get("timestamp")),
                        UUID.fromString(String.valueOf(map.get("uuid"))),
                        String.valueOf(map.get("player")),
                        String.valueOf(map.get("check")),
                        intVal(map.get("vl")),
                        String.valueOf(map.get("detail")),
                        boolVal(map.get("wouldBan")),
                        boolVal(map.get("suppressedBan"))
                );
                flagLogs.addLast(entry);
            } catch (Exception ignored) {
                // skip corrupt row
            }
        }
        List<java.util.Map<?, ?>> banMaps = castMapList(yaml.getMapList("bans"));
        for (java.util.Map<?, ?> map : banMaps) {
            try {
                BanLogEntry entry = new BanLogEntry(
                        longVal(map.get("timestamp")),
                        UUID.fromString(String.valueOf(map.get("uuid"))),
                        String.valueOf(map.get("player")),
                        String.valueOf(map.get("reason")),
                        String.valueOf(map.get("checks")),
                        intVal(map.get("flagCount")),
                        longVal(map.get("expiresAt"))
                );
                banLogs.addLast(entry);
            } catch (Exception ignored) {
                // skip corrupt row
            }
        }
        trim();
    }

    public void save() {
        FileConfiguration yaml = new YamlConfiguration();
        List<java.util.Map<String, Object>> flags = new ArrayList<>();
        for (FlagLogEntry e : flagLogs) {
            java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("timestamp", e.getTimestamp());
            map.put("uuid", e.getUuid().toString());
            map.put("player", e.getPlayerName());
            map.put("check", e.getCheck());
            map.put("vl", e.getVl());
            map.put("detail", e.getDetail());
            map.put("wouldBan", e.isWouldBan());
            map.put("suppressedBan", e.isSuppressedBan());
            flags.add(map);
        }
        List<java.util.Map<String, Object>> bans = new ArrayList<>();
        for (BanLogEntry e : banLogs) {
            java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("timestamp", e.getTimestamp());
            map.put("uuid", e.getUuid().toString());
            map.put("player", e.getPlayerName());
            map.put("reason", e.getReason());
            map.put("checks", e.getChecks());
            map.put("flagCount", e.getFlagCount());
            map.put("expiresAt", e.getExpiresAt());
            bans.add(map);
        }
        yaml.set("flags", flags);
        yaml.set("bans", bans);
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Could not create data folder for logs.");
            }
            yaml.save(file);
        } catch (IOException ex) {
            plugin.getLogger().severe("Failed to save logs.yml: " + ex.getMessage());
        }
    }

    public void reloadLimits() {
        trim();
        save();
    }

    public void addFlag(FlagLogEntry entry) {
        flagLogs.addLast(entry);
        trim();
        save();
    }

    public void addBan(BanLogEntry entry) {
        banLogs.addLast(entry);
        trim();
        save();
    }

    public List<FlagLogEntry> latestFlags(int limit) {
        return newest(flagLogs, limit);
    }

    public List<BanLogEntry> latestBans(int limit) {
        return newest(banLogs, limit);
    }

    public List<FlagLogEntry> flagsForPlayer(String playerName, int limit) {
        String needle = playerName.toLowerCase(Locale.ROOT);
        List<FlagLogEntry> all = flagLogs.stream()
                .filter(e -> e.getPlayerName().equalsIgnoreCase(needle) || e.getPlayerName().toLowerCase(Locale.ROOT).equals(needle))
                .collect(Collectors.toList());
        return newestList(all, limit);
    }

    public List<FlagLogEntry> flagsForPlayer(UUID uuid, int limit) {
        List<FlagLogEntry> all = flagLogs.stream()
                .filter(e -> e.getUuid().equals(uuid))
                .collect(Collectors.toList());
        return newestList(all, limit);
    }

    public List<BanLogEntry> bansForPlayer(String playerName, int limit) {
        String needle = playerName.toLowerCase(Locale.ROOT);
        List<BanLogEntry> all = banLogs.stream()
                .filter(e -> e.getPlayerName().equalsIgnoreCase(needle) || e.getPlayerName().toLowerCase(Locale.ROOT).equals(needle))
                .collect(Collectors.toList());
        return newestList(all, limit);
    }

    public List<BanLogEntry> bansForPlayer(UUID uuid, int limit) {
        List<BanLogEntry> all = banLogs.stream()
                .filter(e -> e.getUuid().equals(uuid))
                .collect(Collectors.toList());
        return newestList(all, limit);
    }

    private void trim() {
        while (flagLogs.size() > config.getMaxFlagLogs()) {
            flagLogs.removeFirst();
        }
        while (banLogs.size() > config.getMaxBanLogs()) {
            banLogs.removeFirst();
        }
    }

    private static <T> List<T> newest(Deque<T> deque, int limit) {
        List<T> list = new ArrayList<>(deque);
        return newestList(list, limit);
    }

    private static <T> List<T> newestList(List<T> list, int limit) {
        if (list.isEmpty() || limit <= 0) {
            return List.of();
        }
        int from = Math.max(0, list.size() - limit);
        List<T> slice = new ArrayList<>(list.subList(from, list.size()));
        java.util.Collections.reverse(slice);
        return slice;
    }

    private static List<java.util.Map<?, ?>> castMapList(List<java.util.Map<?, ?>> maps) {
        return maps == null ? List.of() : maps;
    }

    private static long longVal(Object o) {
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(String.valueOf(o));
    }

    private static int intVal(Object o) {
        if (o instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(String.valueOf(o));
    }

    private static boolean boolVal(Object o) {
        if (o instanceof Boolean b) {
            return b;
        }
        return Boolean.parseBoolean(String.valueOf(o));
    }
}
