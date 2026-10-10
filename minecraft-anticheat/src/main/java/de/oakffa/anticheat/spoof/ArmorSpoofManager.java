package de.oakffa.anticheat.spoof;

import de.oakffa.anticheat.OakFFAPlugin;
import de.oakffa.anticheat.config.PluginConfig;
import de.oakffa.anticheat.util.Permissions;
import io.netty.channel.Channel;
import io.netty.channel.ChannelDuplexHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;
import org.bukkit.Bukkit;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class ArmorSpoofManager implements Listener {

    private static final String HANDLER_NAME = "oakffa_armor_spoof";

    private final OakFFAPlugin plugin;
    private final PluginConfig config;
    private final Map<UUID, Channel> channels = new ConcurrentHashMap<>();
    private volatile boolean available = true;

    public ArmorSpoofManager(OakFFAPlugin plugin, PluginConfig config) {
        this.plugin = plugin;
        this.config = config;
    }

    public void start() {
        if (!config.isAntiArmorIndicatorEnabled()) {
            return;
        }
        Bukkit.getPluginManager().registerEvents(this, plugin);
        for (Player player : Bukkit.getOnlinePlayers()) {
            inject(player);
        }
        plugin.getLogger().info("Anti-armor-indicator active.");
    }

    public void shutdown() {
        for (UUID uuid : new ArrayList<>(channels.keySet())) {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                uninject(player);
            }
        }
        channels.clear();
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        if (!config.isAntiArmorIndicatorEnabled() || !available) {
            return;
        }
        Player player = event.getPlayer();
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (player.isOnline()) {
                inject(player);
            }
        }, 2L);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        uninject(event.getPlayer());
    }

    private void inject(Player player) {
        try {
            Channel channel = resolveChannel(player);
            if (channel == null) {
                return;
            }
            channels.put(player.getUniqueId(), channel);
            channel.eventLoop().execute(() -> {
                try {
                    if (channel.pipeline().get(HANDLER_NAME) != null) {
                        channel.pipeline().remove(HANDLER_NAME);
                    }
                    channel.pipeline().addBefore("packet_handler", HANDLER_NAME,
                            new SpoofHandler(player.getUniqueId()));
                } catch (Exception ex) {
                    plugin.getLogger().warning("Armor spoof inject failed for "
                            + player.getName() + ": " + ex.getMessage());
                }
            });
        } catch (Exception ex) {
            available = false;
            plugin.getLogger().warning("Anti-armor-indicator unavailable: " + ex.getMessage());
        }
    }

    private void uninject(Player player) {
        Channel channel = channels.remove(player.getUniqueId());
        if (channel == null) {
            return;
        }
        channel.eventLoop().execute(() -> {
            try {
                if (channel.pipeline().get(HANDLER_NAME) != null) {
                    channel.pipeline().remove(HANDLER_NAME);
                }
            } catch (Exception ignored) {
            }
        });
    }

    private final class SpoofHandler extends ChannelDuplexHandler {
        private final UUID viewerId;

        private SpoofHandler(UUID viewerId) {
            this.viewerId = viewerId;
        }

        @Override
        public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
            if (!config.isAntiArmorIndicatorEnabled()) {
                super.write(ctx, msg, promise);
                return;
            }
            Player viewer = Bukkit.getPlayer(viewerId);
            if (viewer == null || !viewer.isOnline() || Permissions.canSeeArmorIndicators(viewer)) {
                super.write(ctx, msg, promise);
                return;
            }
            try {
                String name = msg.getClass().getSimpleName();
                if ("PacketPlayOutUpdateAttributes".equals(name)
                        || "ClientboundUpdateAttributesPacket".equals(name)) {
                    msg = spoofArmorAttributes(msg, viewer);
                }
            } catch (Exception ignored) {
            }
            super.write(ctx, msg, promise);
        }
    }

    private Object spoofArmorAttributes(Object packet, Player viewer) throws Exception {
        Integer entityId = readEntityId(packet);
        if (entityId == null || entityId == viewer.getEntityId()) {
            return packet;
        }
        Entity entity = findEntity(viewer, entityId);
        if (entity != null && viewer.getVehicle() != null && viewer.getVehicle().equals(entity)) {
            return packet;
        }

        Collection<?> snapshots = readAttributeSnapshots(packet);
        if (snapshots == null || snapshots.isEmpty()) {
            return packet;
        }

        List<Object> kept = new ArrayList<>();
        boolean changed = false;
        for (Object snap : snapshots) {
            String key = readAttributeKey(snap);
            if (key == null) {
                kept.add(snap);
                continue;
            }
            String normalized = key.toLowerCase(Locale.ROOT);
            boolean armor = normalized.endsWith("armor")
                    || normalized.endsWith("armor_toughness")
                    || normalized.contains("generic.armor");
            if (armor) {
                kept.add(recreateAttributeSnapshot(snap, 0.0D));
                changed = true;
            } else {
                kept.add(snap);
            }
        }
        if (changed) {
            writeAttributeSnapshots(packet, kept);
        }
        return packet;
    }

    private static Entity findEntity(Player viewer, int entityId) {
        if (viewer.getEntityId() == entityId) {
            return viewer;
        }
        for (Entity entity : viewer.getWorld().getEntities()) {
            if (entity.getEntityId() == entityId) {
                return entity;
            }
        }
        return null;
    }

    private static Channel resolveChannel(Player player) throws Exception {
        Object handle = player.getClass().getMethod("getHandle").invoke(player);
        Object connection = findFieldValueByTypeName(handle, "PlayerConnection", "ServerGamePacketListenerImpl");
        if (connection == null) {
            throw new IllegalStateException("PlayerConnection not found");
        }
        Object network = findFieldValueByTypeName(connection, "NetworkManager", "Connection");
        if (network == null) {
            throw new IllegalStateException("NetworkManager not found");
        }
        Object channel = findFieldValueByTypeName(network, "Channel");
        if (!(channel instanceof Channel ch)) {
            throw new IllegalStateException("Netty Channel not found");
        }
        return ch;
    }

    private static Object findFieldValueByTypeName(Object owner, String... typeSimpleNames) throws Exception {
        Class<?> c = owner.getClass();
        while (c != null) {
            for (Field field : c.getDeclaredFields()) {
                String simple = field.getType().getSimpleName();
                for (String want : typeSimpleNames) {
                    if (want.equals(simple) || field.getType().getName().endsWith("." + want)) {
                        field.setAccessible(true);
                        return field.get(owner);
                    }
                }
            }
            c = c.getSuperclass();
        }
        return null;
    }

    private static Integer readEntityId(Object packet) throws Exception {
        for (Field field : packet.getClass().getDeclaredFields()) {
            if (field.getType() == int.class || field.getType() == Integer.class) {
                field.setAccessible(true);
                return (Integer) field.get(packet);
            }
        }
        return null;
    }

    private static Collection<?> readAttributeSnapshots(Object packet) throws Exception {
        for (Field field : packet.getClass().getDeclaredFields()) {
            if (Collection.class.isAssignableFrom(field.getType()) || List.class.isAssignableFrom(field.getType())) {
                field.setAccessible(true);
                Object value = field.get(packet);
                if (value instanceof Collection<?> col) {
                    return col;
                }
            }
        }
        return null;
    }

    private static void writeAttributeSnapshots(Object packet, List<?> snapshots) throws Exception {
        for (Field field : packet.getClass().getDeclaredFields()) {
            if (Collection.class.isAssignableFrom(field.getType()) || List.class.isAssignableFrom(field.getType())) {
                field.setAccessible(true);
                field.set(packet, snapshots);
                return;
            }
        }
    }

    private static String readAttributeKey(Object snapshot) throws Exception {
        for (Method method : snapshot.getClass().getMethods()) {
            if (method.getParameterCount() != 0) {
                continue;
            }
            Object result = method.invoke(snapshot);
            if (result == null) {
                continue;
            }
            String asString = result.toString();
            if (asString.contains("armor") || asString.contains("generic.") || asString.contains("minecraft:")) {
                return asString;
            }
            for (Method nested : result.getClass().getMethods()) {
                if (nested.getParameterCount() == 0 && nested.getReturnType() == String.class
                        && (nested.getName().contains("Key") || nested.getName().equals("a")
                        || nested.getName().equals("getName") || nested.getName().equals("toString"))) {
                    try {
                        Object key = nested.invoke(result);
                        if (key != null) {
                            return key.toString();
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        }
        return snapshot.toString();
    }

    private static Object recreateAttributeSnapshot(Object original, double baseValue) throws Exception {
        for (Field field : original.getClass().getDeclaredFields()) {
            if (field.getType() == double.class || field.getType() == Double.class) {
                field.setAccessible(true);
                try {
                    field.set(original, baseValue);
                    return original;
                } catch (Exception ignored) {
                }
            }
        }
        Constructor<?>[] ctors = original.getClass().getDeclaredConstructors();
        for (Constructor<?> ctor : ctors) {
            Class<?>[] params = ctor.getParameterTypes();
            if (params.length < 2) {
                continue;
            }
            ctor.setAccessible(true);
            Object[] current = unpackSnapshotArgs(original, params.length);
            if (current == null) {
                continue;
            }
            Object[] args = new Object[params.length];
            System.arraycopy(current, 0, args, 0, params.length);
            for (int i = 0; i < params.length; i++) {
                if (params[i] == double.class || params[i] == Double.class) {
                    args[i] = baseValue;
                }
            }
            try {
                return ctor.newInstance(args);
            } catch (Exception ignored) {
            }
        }
        return original;
    }

    private static Object[] unpackSnapshotArgs(Object snapshot, int count) throws Exception {
        List<Object> values = new ArrayList<>();
        for (Field field : snapshot.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) {
                continue;
            }
            field.setAccessible(true);
            values.add(field.get(snapshot));
            if (values.size() >= count) {
                break;
            }
        }
        if (values.size() < count) {
            return null;
        }
        return values.toArray();
    }
}
