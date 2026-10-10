package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.entity.Player;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Heuristic ghost-client detection for clients commonly used for cheating
 * (e.g. Vape / Prestige-style brands and plugin channels).
 *
 * This is intentionally signature-light: commercial clients change payloads often.
 * We flag known-suspicious brands/channels and payload keywords without claiming
 * a perfect private fingerprint.
 */
public final class GhostClientCheck extends Check {

    public GhostClientCheck(CheckManager manager) {
        super(manager, "GhostClient");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isGhostClientEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getGhostClientWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getGhostClientMaxVl();
    }

    @Override
    public void onBrand(Player player, PlayerData data, String brand) {
        if (brand == null || brand.isBlank()) {
            return;
        }
        String normalized = brand.toLowerCase(Locale.ROOT);
        for (String needle : manager.getConfig().getSuspiciousBrands()) {
            if (normalized.contains(needle)) {
                // Skip vanilla / paper brands even if listed by mistake
                if (normalized.contains("vanilla") || normalized.contains("paper")
                        || normalized.contains("purpur") || normalized.contains("fabric")) {
                    continue;
                }
                flag(player, data, "suspicious client brand: " + brand);
                return;
            }
        }
        // Explicit high-signal names
        if (normalized.contains("vape") || normalized.contains("prestige")) {
            flag(player, data, "ghost-client brand indicator: " + brand);
        }
    }

    @Override
    public void onPluginMessage(Player player, PlayerData data, String channel, byte[] payload) {
        if (channel == null) {
            return;
        }
        String ch = channel.toLowerCase(Locale.ROOT);
        // Ignore standard brand / register traffic handled elsewhere
        if (ch.equals("minecraft:brand") || ch.equals("mc|brand")
                || ch.equals("minecraft:register") || ch.equals("register")
                || ch.startsWith("bungeecord:") || ch.startsWith("legacy:")) {
            return;
        }

        for (String needle : manager.getConfig().getSuspiciousChannels()) {
            if (ch.contains(needle)) {
                flag(player, data, "suspicious plugin channel: " + channel);
                return;
            }
        }

        if (payload != null && payload.length > 0 && payload.length < 2048) {
            String asText = new String(payload, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            if (asText.contains("vape") || asText.contains("prestige")
                    || asText.contains("ghostclient") || asText.contains("selfdestruct")) {
                flag(player, data, "suspicious payload on " + channel);
            }
        }
    }
}
