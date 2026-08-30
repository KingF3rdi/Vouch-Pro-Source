package de.txtempire.shop;

import de.txtempire.shop.api.ShopApiClient;
import de.txtempire.shop.command.ShopCommand;
import de.txtempire.shop.listener.PaymentListener;
import org.bukkit.plugin.java.JavaPlugin;

public final class TxTShopPlugin extends JavaPlugin {

    private ShopApiClient apiClient;
    private String paymentRecipient;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        reloadLocalConfig();

        getCommand("shop").setExecutor(new ShopCommand(this));
        getServer().getPluginManager().registerEvents(new PaymentListener(this), this);

        getLogger().info("TxTShop aktiv — Empfänger: " + paymentRecipient);
        getLogger().info("Link: /shop link <code> | Zahlung: /pay " + paymentRecipient + " <betrag>");
    }

    public void reloadLocalConfig() {
        reloadConfig();
        String apiUrl = getConfig().getString("shop-api-url", "http://localhost:8000");
        String apiKey = getConfig().getString("bot-api-key", "");
        paymentRecipient = getConfig().getString("payment-recipient", "TxtEmpire");
        apiClient = new ShopApiClient(apiUrl, apiKey, getLogger());
    }

    public ShopApiClient getApiClient() {
        return apiClient;
    }

    public String getPaymentRecipient() {
        return paymentRecipient;
    }

    public boolean isDetectChatPayments() {
        return getConfig().getBoolean("detect-chat-payments", true);
    }

    public boolean isDetectPayCommands() {
        return getConfig().getBoolean("detect-pay-commands", true);
    }
}
