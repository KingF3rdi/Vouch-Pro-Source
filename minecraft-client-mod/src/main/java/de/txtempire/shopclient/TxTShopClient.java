package de.txtempire.shopclient;

import de.txtempire.shopclient.config.ShopConfig;
import de.txtempire.shopclient.handler.ChatHandler;
import de.txtempire.shopclient.screen.LinkCodeScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class TxTShopClient implements ClientModInitializer {

    private static KeyBinding linkKey;
    private static KeyBinding statusKey;

    @Override
    public void onInitializeClient() {
        ShopConfig.load();
        ChatHandler.register();

        linkKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.txtshop.link",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_L,
                "category.txtshop"
        ));

        statusKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.txtshop.status",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_K,
                "category.txtshop"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player == null) {
                return;
            }
            while (linkKey.wasPressed()) {
                if (!ShopConfig.isConfigured()) {
                    client.player.sendMessage(
                            net.minecraft.text.Text.literal("§c[TxT Shop] config/txtshop.json fehlt (shop-api-url)"),
                            false
                    );
                    continue;
                }
                client.setScreen(new LinkCodeScreen());
            }
            while (statusKey.wasPressed()) {
                String recipient = ShopConfig.getPaymentRecipient();
                String api = ShopConfig.getApiUrl();
                client.player.sendMessage(
                        net.minecraft.text.Text.literal(
                                "§b[TxT Shop]§r API: " + api + " | Zahlung an: §f" + recipient
                        ),
                        false
                );
            }
        });

        TxTShopClientMod.LOGGER.info("TxT Shop Client geladen — Taste L = Link-Code");
    }
}
