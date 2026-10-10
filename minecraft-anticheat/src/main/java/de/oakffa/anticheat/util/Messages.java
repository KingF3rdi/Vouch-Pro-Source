package de.oakffa.anticheat.util;

import de.oakffa.anticheat.config.PluginConfig;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.command.CommandSender;

import java.util.Map;

public final class Messages {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private final PluginConfig config;

    public Messages(PluginConfig config) {
        this.config = config;
    }

    public void reload() {

    }

    public Component component(String legacy) {
        return LEGACY.deserialize(legacy == null ? "" : legacy);
    }

    public String color(String legacy) {
        return legacy == null ? "" : legacy.replace('&', '§');
    }

    public void send(CommandSender sender, String template, Map<String, String> placeholders) {
        sender.sendMessage(component(apply(template, placeholders)));
    }

    public String apply(String template, Map<String, String> placeholders) {
        String out = template == null ? "" : template;
        out = out.replace("%prefix%", config.getPrefix());
        if (placeholders != null) {
            for (Map.Entry<String, String> e : placeholders.entrySet()) {
                out = out.replace("%" + e.getKey() + "%", e.getValue() == null ? "" : e.getValue());
            }
        }
        return out;
    }

    public String get(String path, String def) {
        return config.message(path, def);
    }
}
