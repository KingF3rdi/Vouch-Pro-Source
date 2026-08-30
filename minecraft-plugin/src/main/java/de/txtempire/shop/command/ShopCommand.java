package de.txtempire.shop.command;

import de.txtempire.shop.TxTShopPlugin;
import de.txtempire.shop.api.ShopApiClient;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

public final class ShopCommand implements CommandExecutor {

    private final TxTShopPlugin plugin;

    public ShopCommand(TxTShopPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage(color("&bTxT Shop &7— &f/shop link <code> &7| &f/shop status"));
            return true;
        }

        String sub = args[0].equalsIgnoreCase("reload")
                ? "reload"
                : args[0].equalsIgnoreCase("status")
                ? "status"
                : args[0].equalsIgnoreCase("link")
                ? "link"
                : "";

        if ("reload".equals(sub)) {
            if (!sender.hasPermission("txtshop.admin")) {
                sender.sendMessage(color("&cKeine Berechtigung."));
                return true;
            }
            plugin.reloadLocalConfig();
            sender.sendMessage(color("&aTxTShop Config neu geladen."));
            return true;
        }

        if ("status".equals(sub)) {
            ShopApiClient api = plugin.getApiClient();
            sender.sendMessage(color(
                    "&bTxT Shop &7— API: "
                            + (api.isConfigured() ? "&averbunden" : "&cnicht konfiguriert")
                            + " &7| Empfänger: &f" + plugin.getPaymentRecipient()
            ));
            return true;
        }

        if ("link".equals(sub)) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage(color("&cNur ingame als Spieler nutzbar."));
                return true;
            }
            if (args.length < 2) {
                player.sendMessage(color("&cNutze: /shop link <code>"));
                return true;
            }
            if (!plugin.getApiClient().isConfigured()) {
                player.sendMessage(color("&cShop-API ist nicht konfiguriert."));
                return true;
            }

            String code = args[1].trim().toUpperCase();
            player.sendMessage(color("&7Code wird eingelöst…"));

            plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
                ShopApiClient.LinkRedeemResult result =
                        plugin.getApiClient().redeemLink(player.getName(), code);

                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (result.success()) {
                        String typeLabel = "both".equals(result.connectionType())
                                ? "Discord + Minecraft"
                                : "Minecraft";
                        player.sendMessage(color(
                                "&aVerknüpfung erfolgreich! &7"
                                        + typeLabel + " (&f" + result.displayName() + "&7) ist mit dem Shop verbunden."
                        ));
                    } else {
                        player.sendMessage(color("&c" + result.message()));
                    }
                });
            });
            return true;
        }

        sender.sendMessage(color("&cUnbekannter Befehl. &7/shop link <code> | /shop status"));
        return true;
    }

    private static String color(String text) {
        return ChatColor.translateAlternateColorCodes('&', text);
    }
}
