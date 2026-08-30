package de.txtempire.shop.listener;

import de.txtempire.shop.TxTShopPlugin;
import de.txtempire.shop.api.ShopApiClient;
import de.txtempire.shop.util.PaymentParser;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class PaymentListener implements Listener {

    private final TxTShopPlugin plugin;
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();
    private static final long COOLDOWN_MS = 3000L;

    public PaymentListener(TxTShopPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPayCommand(PlayerCommandPreprocessEvent event) {
        if (!plugin.isDetectPayCommands()) {
            return;
        }

        String raw = event.getMessage().substring(1).trim();
        String lower = raw.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("pay ") && !lower.startsWith("epay ") && !lower.startsWith("money pay ")) {
            return;
        }

        String[] parts = raw.split("\\s+");
        String recipient;
        String amountToken;

        if (lower.startsWith("money pay ") && parts.length >= 4) {
            recipient = parts[2];
            amountToken = parts[3];
        } else if (parts.length >= 3) {
            recipient = parts[1];
            amountToken = parts[2];
        } else {
            return;
        }

        if (!recipient.equalsIgnoreCase(plugin.getPaymentRecipient())) {
            return;
        }

        Double amount = PaymentParser.parseAmount(amountToken);
        if (amount == null || amount <= 0) {
            return;
        }

        confirmAsync(event.getPlayer().getName(), amount, raw);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent event) {
        if (!plugin.isDetectChatPayments()) {
            return;
        }

        PaymentParser.ParsedPayment payment =
                PaymentParser.parseChatMessage(event.getMessage(), plugin.getPaymentRecipient());
        if (payment == null) {
            return;
        }

        confirmAsync(payment.payer(), payment.amount(), event.getMessage());
    }

    private void confirmAsync(String ign, double amount, String reference) {
        if (!plugin.getApiClient().isConfigured() || ign == null || ign.isBlank()) {
            return;
        }

        Player online = plugin.getServer().getPlayerExact(ign);
        UUID id = online != null ? online.getUniqueId() : UUID.nameUUIDFromBytes(("offline:" + ign).getBytes());
        long now = System.currentTimeMillis();
        Long last = cooldowns.get(id);
        if (last != null && now - last < COOLDOWN_MS) {
            return;
        }
        cooldowns.put(id, now);

        plugin.getLogger().info("[Payment] " + ign + " -> " + plugin.getPaymentRecipient() + ": " + amount);

        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            ShopApiClient.PaymentConfirmResult result =
                    plugin.getApiClient().confirmPayment(ign, amount, reference);

            plugin.getServer().getScheduler().runTask(plugin, () -> {
                if (result.success()) {
                    String msg = result.ordersConfirmed() > 1
                            ? "Zahlung bestätigt! " + result.ordersConfirmed()
                            + " Bestellungen — Danke für deinen Kauf!"
                            : "Zahlung bestätigt! Bestellung #" + result.orderId()
                            + " — Danke für deinen Kauf!";
                    if (online != null && online.isOnline()) {
                        online.sendMessage("§a[Shop] " + msg);
                    }
                    plugin.getLogger().info("[Payment] Bestätigt für " + ign + " (" + amount + ")");
                } else {
                    plugin.getLogger().info("[Payment] Keine passende Bestellung für " + ign + " (" + amount + ")");
                }
            });
        });
    }
}
