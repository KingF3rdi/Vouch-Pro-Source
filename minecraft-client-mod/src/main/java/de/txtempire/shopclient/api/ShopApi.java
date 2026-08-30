package de.txtempire.shopclient.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import de.txtempire.shopclient.TxTShopClientMod;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.function.Consumer;

public final class ShopApi {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private ShopApi() {}

    public static void fetchPaymentConfig(String apiUrl, Consumer<String> onRecipient) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + "/api/config/payment"))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                return;
            }
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            String ign = json.has("shop_bot_ign")
                    ? json.get("shop_bot_ign").getAsString()
                    : json.has("shop_owner_ign")
                    ? json.get("shop_owner_ign").getAsString()
                    : null;
            if (ign != null) {
                onRecipient.accept(ign);
            }
        } catch (Exception e) {
            TxTShopClientMod.LOGGER.debug("Payment config fetch: {}", e.getMessage());
        }
    }

    public static LinkResult redeemLink(String apiUrl, String ign, String code) {
        JsonObject body = new JsonObject();
        body.addProperty("code", code.toUpperCase());
        body.addProperty("ign", ign);
        try {
            HttpResponse<String> response = post(apiUrl, "/api/client/link/redeem", body.toString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            if (response.statusCode() >= 400) {
                String detail = json.has("detail")
                        ? json.get("detail").getAsString()
                        : "Fehler";
                return LinkResult.fail(detail);
            }
            if (json.has("success") && json.get("success").getAsBoolean()) {
                String name = json.has("display_name")
                        ? json.get("display_name").getAsString()
                        : ign;
                return LinkResult.ok(name);
            }
            return LinkResult.fail("Ungültiger Code");
        } catch (Exception e) {
            TxTShopClientMod.LOGGER.warn("Link redeem: {}", e.getMessage());
            return LinkResult.fail("Shop nicht erreichbar");
        }
    }

    public static PendingPayment fetchPendingPayment(String apiUrl, String ign) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + "/api/client/payment/pending?ign=" + ign))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                return PendingPayment.none();
            }
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            if (!json.has("pending") || !json.get("pending").getAsBoolean()) {
                return PendingPayment.none();
            }
            return new PendingPayment(
                    json.get("payment_code").getAsString(),
                    json.get("amount").getAsDouble()
            );
        } catch (Exception e) {
            return PendingPayment.none();
        }
    }

    public static PaymentResult confirmPayment(String apiUrl, String ign, double amount, String paymentCode) {
        JsonObject body = new JsonObject();
        body.addProperty("ign", ign);
        body.addProperty("amount", amount);
        if (paymentCode != null && !paymentCode.isBlank()) {
            body.addProperty("payment_code", paymentCode.toUpperCase());
        }
        try {
            HttpResponse<String> response = post(apiUrl, "/api/client/payment/confirm", body.toString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            if (response.statusCode() >= 400) {
                return PaymentResult.fail();
            }
            if (json.has("success") && json.get("success").getAsBoolean()) {
                int orderId = json.has("order_id") ? json.get("order_id").getAsInt() : 0;
                int count = json.has("orders_confirmed") ? json.get("orders_confirmed").getAsInt() : 1;
                return PaymentResult.ok(orderId, count);
            }
            return PaymentResult.fail();
        } catch (Exception e) {
            TxTShopClientMod.LOGGER.warn("Payment confirm: {}", e.getMessage());
            return PaymentResult.fail();
        }
    }

    private static HttpResponse<String> post(String apiUrl, String path, String jsonBody)
            throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl + path))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();
        return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    }

    public record LinkResult(boolean success, String message, String displayName) {
        static LinkResult ok(String displayName) {
            return new LinkResult(true, null, displayName);
        }

        static LinkResult fail(String message) {
            return new LinkResult(false, message, null);
        }
    }

    public record PaymentResult(boolean success, int orderId, int ordersConfirmed) {
        static PaymentResult ok(int orderId, int ordersConfirmed) {
            return new PaymentResult(true, orderId, ordersConfirmed);
        }

        static PaymentResult fail() {
            return new PaymentResult(false, 0, 0);
        }
    }

    public record PendingPayment(String paymentCode, double amount) {
        static PendingPayment none() {
            return new PendingPayment(null, 0);
        }

        public boolean hasCode() {
            return paymentCode != null && !paymentCode.isBlank();
        }
    }
}
