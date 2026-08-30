package de.txtempire.shop.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.logging.Logger;

public final class ShopApiClient {

    private final String apiUrl;
    private final String apiKey;
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ShopApiClient(String apiUrl, String apiKey, Logger logger) {
        this.apiUrl = apiUrl == null ? "" : apiUrl.replaceAll("/+$", "");
        this.apiKey = apiKey == null ? "" : apiKey;
        this.logger = logger;
    }

    public boolean isConfigured() {
        return !apiUrl.isBlank() && !apiKey.isBlank();
    }

    public LinkRedeemResult redeemLink(String ign, String code) {
        JsonObject body = new JsonObject();
        body.addProperty("code", code.toUpperCase());
        body.addProperty("ign", ign);

        try {
            HttpResponse<String> response = post("/api/bot/link/redeem", body.toString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            if (response.statusCode() >= 400) {
                String detail = json.has("detail")
                        ? json.get("detail").getAsString()
                        : "Code konnte nicht eingelöst werden.";
                return LinkRedeemResult.fail(detail);
            }
            if (!json.has("success") || !json.get("success").getAsBoolean()) {
                return LinkRedeemResult.fail("Ungültiger oder abgelaufener Code.");
            }
            String display = json.has("display_name")
                    ? json.get("display_name").getAsString()
                    : ign;
            String type = json.has("connection_type")
                    ? json.get("connection_type").getAsString()
                    : "minecraft";
            return LinkRedeemResult.ok(display, type);
        } catch (Exception e) {
            logger.warning("[Shop API] Link redeem: " + e.getMessage());
            return LinkRedeemResult.fail("Shop-API nicht erreichbar.");
        }
    }

    public PaymentConfirmResult confirmPayment(String ign, double amount, String reference) {
        JsonObject body = new JsonObject();
        body.addProperty("ign", ign);
        body.addProperty("amount", amount);
        if (reference != null && !reference.isBlank()) {
            body.addProperty("payment_reference", reference);
        }

        try {
            HttpResponse<String> response = post("/api/bot/payments/confirm", body.toString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            if (response.statusCode() >= 400) {
                return PaymentConfirmResult.fail();
            }
            if (!json.has("success") || !json.get("success").getAsBoolean()) {
                return PaymentConfirmResult.fail();
            }
            int orderId = json.has("order_id") ? json.get("order_id").getAsInt() : 0;
            int count = json.has("orders_confirmed") ? json.get("orders_confirmed").getAsInt() : 1;
            return PaymentConfirmResult.ok(orderId, count);
        } catch (Exception e) {
            logger.warning("[Shop API] Payment confirm: " + e.getMessage());
            return PaymentConfirmResult.fail();
        }
    }

    private HttpResponse<String> post(String path, String jsonBody) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl + path))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("X-Bot-Api-Key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    public record LinkRedeemResult(boolean success, String message, String displayName, String connectionType) {
        static LinkRedeemResult ok(String displayName, String connectionType) {
            return new LinkRedeemResult(true, null, displayName, connectionType);
        }

        static LinkRedeemResult fail(String message) {
            return new LinkRedeemResult(false, message, null, null);
        }
    }

    public record PaymentConfirmResult(boolean success, int orderId, int ordersConfirmed) {
        static PaymentConfirmResult ok(int orderId, int ordersConfirmed) {
            return new PaymentConfirmResult(true, orderId, ordersConfirmed);
        }

        static PaymentConfirmResult fail() {
            return new PaymentConfirmResult(false, 0, 0);
        }
    }
}
