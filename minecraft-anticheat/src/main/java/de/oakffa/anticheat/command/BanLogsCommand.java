package de.oakffa.anticheat.command;

import de.oakffa.anticheat.util.Messages;
import de.oakffa.anticheat.util.Permissions;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Handles {@code /ban logs [player]} — identical to {@code /ac logs [player]}.
 */
public final class BanLogsCommand implements CommandExecutor, TabCompleter {

    private final LogPresenter logPresenter;
    private final Messages messages;

    public BanLogsCommand(LogPresenter logPresenter, Messages messages) {
        this.logPresenter = logPresenter;
        this.messages = messages;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0 || !args[0].equalsIgnoreCase("logs")) {
            sender.sendMessage(messages.component("&8[&aOakFFA&8] &7Usage: &e/ban logs [player] &8(= /ac logs)"));
            return true;
        }
        if (!Permissions.canViewLogs(sender)) {
            messages.send(sender, messages.get("no-permission", "%prefix%&cYou do not have permission."), Map.of());
            return true;
        }
        String player = args.length >= 2 ? args[1] : null;
        logPresenter.show(sender, player);
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!Permissions.canViewLogs(sender)) {
            return List.of();
        }
        if (args.length == 1) {
            return "logs".startsWith(args[0].toLowerCase(Locale.ROOT)) ? List.of("logs") : List.of();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("logs")) {
            String t = args[1].toLowerCase(Locale.ROOT);
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase(Locale.ROOT).startsWith(t))
                    .collect(Collectors.toCollection(ArrayList::new));
        }
        return List.of();
    }
}
