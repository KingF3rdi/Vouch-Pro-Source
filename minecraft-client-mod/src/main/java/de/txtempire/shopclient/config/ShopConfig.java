package de.txtempire.shopclient.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import de.txtempire.shopclient.TxTShopClientMod;
import de.txtempire.shopclient.api.ShopApi;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ShopConfig {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static Path configPath;
    private static String apiUrl = "";
    private static String paymentRecipient = "TxtEmpire";

    private ShopConfig() {}

    public static void load() {
        configPath = net.fabricmc.loader.api.FabricLoader.getInstance()
                .getConfigDir()
                .resolve("txtshop.json");

        if (!Files.exists(configPath)) {
            writeDefault();
        }

        try (Reader reader = Files.newBufferedReader(configPath)) {
            JsonObject json = JsonParser.parseReader(reader).getAsJsonObject();
            apiUrl = json.has("shop-api-url") ? json.get("shop-api-url").getAsString().trim() : "";
            if (json.has("payment-recipient")) {
                paymentRecipient = json.get("payment-recipient").getAsString().trim();
            }
        } catch (Exception e) {
            TxTShopClientMod.LOGGER.error("Config laden fehlgeschlagen", e);
        }

        if (isConfigured()) {
            ShopApi.fetchPaymentConfig(apiUrl, ign -> {
                if (ign != null && !ign.isBlank()) {
                    paymentRecipient = ign;
                    TxTShopClientMod.LOGGER.info("Zahlungsempfänger von API: {}", ign);
                }
            });
        }
    }

    private static void writeDefault() {
        JsonObject json = new JsonObject();
        json.addProperty("shop-api-url", "https://shop.deinedomain.de");
        json.addProperty("payment-recipient", "TxtEmpire");
        json.addProperty("_hint", "Kein API-Key nötig — Mod spricht /api/client/*");
        try {
            Files.createDirectories(configPath.getParent());
            try (Writer writer = Files.newBufferedWriter(configPath)) {
                GSON.toJson(json, writer);
            }
        } catch (IOException e) {
            TxTShopClientMod.LOGGER.error("Default-Config schreiben fehlgeschlagen", e);
        }
    }

    public static boolean isConfigured() {
        return apiUrl != null && !apiUrl.isBlank();
    }

    public static String getApiUrl() {
        return apiUrl == null ? "" : apiUrl.replaceAll("/+$", "");
    }

    public static String getPaymentRecipient() {
        return paymentRecipient == null || paymentRecipient.isBlank()
                ? "TxtEmpire"
                : paymentRecipient;
    }
}
