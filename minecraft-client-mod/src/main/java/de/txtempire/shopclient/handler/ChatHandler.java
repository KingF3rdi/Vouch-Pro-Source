package de.txtempire.shopclient.handler;

import de.txtempire.shopclient.api.ShopApi;
import de.txtempire.shopclient.config.ShopConfig;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.message.v1.ClientSendMessageEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ChatHandler {

    private static final long COOLDOWN_MS = 4000L;
    private static final Map<UUID, Long> COOLDOWNS = new ConcurrentHashMap<>();

    private ChatHandler() {}

    public static void register() {
        ClientSendMessageEvents.CHAT.register(ChatHandler::onOutgoingChat);
        ClientReceiveMessageEvents.GAME.register(ChatHandler::onIncomingChat);
    }

    private static void onOutgoingChat(String message) {
        if (!ShopConfig.isConfigured() || message == null) {
            return;
        }

        String trimmed = stripColors(message).trim();
        if (!trimmed.toLowerCase(Locale.ROOT).startsWith("/pay ")) {
            return;
        }

        String[] parts = trimmed.substring(1).split("\\s+");
        if (parts.length < 3 || !"pay".equalsIgnoreCase(parts[0])) {
            return;
        }

        String recipient = parts[1];
        if (!recipient.equalsIgnoreCase(ShopConfig.getPaymentRecipient())) {
            return;
        }

        Double amount = parseAmount(parts[2]);
        if (amount == null || amount <= 0) {
            return;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) {
            return;
        }

        scheduleConfirm(client, client.player.getName().getString(), amount);
    }

    private static void onIncomingChat(Text message, boolean overlay) {
        if (overlay || !ShopConfig.isConfigured() || message == null) {
            return;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) {
            return;
        }

        String text = stripColors(message.getString());
        String recipient = Pattern.quote(ShopConfig.getPaymentRecipient());

        Pattern[] patterns = new Pattern[] {
                Pattern.compile("you\\s+paid\\s+" + recipient + "\\s+\\$?(\\d+(?:\\.\\d{1,2})?)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("du\\s+hast\\s+" + recipient + "\\s+\\$?(\\d+(?:\\.\\d{1,2})?)\\s+gezahlt", Pattern.CASE_INSENSITIVE),
                Pattern.compile("^(\\w+)\\s+paid\\s+" + recipient + "\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$", Pattern.CASE_INSENSITIVE),
        };

        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                Double amount = parseAmount(matcher.group(matcher.groupCount()));
                if (amount != null) {
                    scheduleConfirm(client, client.player.getName().getString(), amount);
                }
                return;
            }
        }
    }

    private static void scheduleConfirm(MinecraftClient client, String ign, double amount) {
        if (client.player == null) {
            return;
        }

        UUID id = client.player.getUuid();
        long now = System.currentTimeMillis();
        Long last = COOLDOWNS.get(id);
        if (last != null && now - last < COOLDOWN_MS) {
            return;
        }
        COOLDOWNS.put(id, now);

        String apiUrl = ShopConfig.getApiUrl();
        client.execute(() -> client.player.sendMessage(
                Text.literal("§7[TxT Shop] Zahlung wird an Website gemeldet…"),
                false
        ));

        new Thread(() -> {
            ShopApi.PendingPayment pending = ShopApi.fetchPendingPayment(apiUrl, ign);
            String paymentCode = pending.hasCode() ? pending.paymentCode() : null;
            ShopApi.PaymentResult result = ShopApi.confirmPayment(apiUrl, ign, amount, paymentCode);
            client.execute(() -> {
                if (client.player == null) {
                    return;
                }
                if (result.success()) {
                    String msg = result.ordersConfirmed() > 1
                            ? "§a[TxT Shop] Zahlung bestätigt! " + result.ordersConfirmed() + " Bestellungen"
                            : "§a[TxT Shop] Zahlung bestätigt! Bestellung #" + result.orderId();
                    client.player.sendMessage(Text.literal(msg), false);
                } else {
                    client.player.sendMessage(
                            Text.literal("§e[TxT Shop] Keine passende Bestellung — erst auf Website checkouten."),
                            false
                    );
                }
            });
        }, "txtshop-payment").start();
    }

    private static Double parseAmount(String token) {
        if (token == null) {
            return null;
        }
        String value = token.trim().toLowerCase(Locale.ROOT).replace(",", ".");
        try {
            if (value.endsWith("k")) {
                return Double.parseDouble(value.substring(0, value.length() - 1)) * 1000.0;
            }
            if (value.endsWith("m")) {
                return Double.parseDouble(value.substring(0, value.length() - 1)) * 1_000_000.0;
            }
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String stripColors(String text) {
        return text.replaceAll("\u00a7.", "").trim();
    }
}
