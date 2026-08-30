package de.txtempire.shopclient.screen;

import de.txtempire.shopclient.api.ShopApi;
import de.txtempire.shopclient.config.ShopConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

public class LinkCodeScreen extends Screen {

    private TextFieldWidget codeField;

    public LinkCodeScreen() {
        super(Text.translatable("txtshop.link.title"));
    }

    @Override
    protected void init() {
        int cx = this.width / 2;
        int cy = this.height / 2;

        codeField = new TextFieldWidget(
                this.textRenderer,
                cx - 100,
                cy - 10,
                200,
                20,
                Text.translatable("txtshop.link.hint")
        );
        codeField.setMaxLength(12);
        codeField.setPlaceholder(Text.translatable("txtshop.link.hint"));
        this.addSelectableChild(codeField);
        this.setInitialFocus(codeField);

        this.addDrawableChild(ButtonWidget.builder(
                Text.translatable("txtshop.link.submit"),
                btn -> submit()
        ).dimensions(cx - 100, cy + 20, 200, 20).build());

        this.addDrawableChild(ButtonWidget.builder(
                Text.translatable("txtshop.link.cancel"),
                btn -> close()
        ).dimensions(cx - 100, cy + 48, 200, 20).build());
    }

    private void submit() {
        if (this.client == null || this.client.player == null) {
            return;
        }
        String code = codeField.getText().trim();
        if (code.length() < 4) {
            return;
        }

        String ign = this.client.player.getName().getString();
        String apiUrl = ShopConfig.getApiUrl();

        this.client.player.sendMessage(Text.literal("§7[TxT Shop] Code wird eingelöst…"), false);

        new Thread(() -> {
            ShopApi.LinkResult result = ShopApi.redeemLink(apiUrl, ign, code);
            this.client.execute(() -> {
                if (this.client.player == null) {
                    return;
                }
                if (result.success()) {
                    this.client.player.sendMessage(
                            Text.literal("§a[TxT Shop] Verknüpft: " + result.displayName()),
                            false
                    );
                    close();
                } else {
                    this.client.player.sendMessage(
                            Text.literal("§c[TxT Shop] " + result.message()),
                            false
                    );
                }
            });
        }, "txtshop-link").start();
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context);
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(
                this.textRenderer,
                this.title,
                this.width / 2,
                this.height / 2 - 40,
                0xFFFFFF
        );
        codeField.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
