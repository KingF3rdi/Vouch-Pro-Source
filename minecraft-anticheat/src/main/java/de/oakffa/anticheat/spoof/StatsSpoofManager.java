package de.oakffa.anticheat.spoof;

import de.oakffa.anticheat.OakFFAPlugin;
import de.oakffa.anticheat.config.PluginConfig;
import de.oakffa.anticheat.util.Permissions;
import io.netty.channel.Channel;
import io.netty.channel.ChannelDuplexHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;
import org.bukkit.Bukkit;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;

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

/**
 * Spoofs outbound entity health metadata and armor/max-health attributes so
 * client-side health indicators and armor-stat mods cannot read real values.
 */
public final class StatsSpoofManager implements Listener {

    private static final String HANDLER_NAME = "oakffa_stats_spoof";
    private static final int LIVING_HEALTH_INDEX = 9;

    private final OakFFAPlugin plugin;
    private final PluginConfig config;
    private final Map<UUID, Channel> channels = new ConcurrentHashMap<>();

    private volatile boolean available = true;

    public StatsSpoofManager(OakFFAPlugin plugin, PluginConfig config) {
        this.plugin = plugin;
        this.config = config;
    }

    public void start() {
        if (!config.isAntiIndicatorsEnabled()) {
            plugin.getLogger().info("Anti-indicators disabled in config.");
            return;
        }
        stripHealthScoreboards();
        Bukkit.getPluginManager().registerEvents(this, plugin);
        for (Player player : Bukkit.getOnlinePlayers()) {
            inject(player);
        }
        plugin.getLogger().info("Anti-indicators active (health + armor attribute spoof).");
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
        if (!config.isAntiIndicatorsEnabled() || !available) {
            return;
        }
        Player player = event.getPlayer();
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (player.isOnline()) {
                inject(player);
                stripHealthScoreboard(player.getScoreboard());
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
                    plugin.getLogger().warning("Failed to inject stats spoof for "
                            + player.getName() + ": " + ex.getMessage());
                }
            });
        } catch (Exception ex) {
            available = false;
            plugin.getLogger().warning("Anti-indicators unavailable on this server: " + ex.getMessage());
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

    private void stripHealthScoreboards() {
        stripHealthScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
        for (Player player : Bukkit.getOnlinePlayers()) {
            stripHealthScoreboard(player.getScoreboard());
        }
    }

    private void stripHealthScoreboard(Scoreboard board) {
        if (board == null) {
            return;
        }
        for (Objective objective : board.getObjectives()) {
            try {
                if (objective.getDisplaySlot() != DisplaySlot.BELOW_NAME) {
                    continue;
                }
                if (Criteria.HEALTH.equals(objective.getTrackedCriteria())
                        || "health".equalsIgnoreCase(objective.getName())) {
                    objective.setDisplaySlot(null);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private final class SpoofHandler extends ChannelDuplexHandler {
        private final UUID viewerId;

        private SpoofHandler(UUID viewerId) {
            this.viewerId = viewerId;
        }

        @Override
        public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
            if (!config.isAntiIndicatorsEnabled()) {
                super.write(ctx, msg, promise);
                return;
            }
            Player viewer = Bukkit.getPlayer(viewerId);
            if (viewer == null || !viewer.isOnline() || Permissions.canSeeIndicators(viewer)) {
                super.write(ctx, msg, promise);
                return;
            }
            try {
                String name = msg.getClass().getSimpleName();
                if (isEntityMetadataPacket(name)) {
                    msg = spoofMetadata(msg, viewer);
                } else if (isUpdateAttributesPacket(name)) {
                    msg = spoofAttributes(msg, viewer);
                }
            } catch (Exception ignored) {
            }
            super.write(ctx, msg, promise);
        }
    }

    private Object spoofMetadata(Object packet, Player viewer) throws Exception {
        if (!config.isAntiIndicatorsSpoofHealth()) {
            return packet;
        }
        Integer entityId = readEntityId(packet);
        if (entityId == null || entityId == viewer.getEntityId()) {
            return packet;
        }
        Entity entity = findEntity(viewer, entityId);
        if (entity instanceof Player target && target.getUniqueId().equals(viewer.getUniqueId())) {
            return packet;
        }
        if (entity != null && viewer.getVehicle() != null && viewer.getVehicle().equals(entity)) {
            return packet;
        }

        List<?> packed = readPackedItems(packet);
        if (packed == null || packed.isEmpty()) {
            return packet;
        }

        float fake = (float) config.getAntiIndicatorsFakeHealth();
        if (entity instanceof LivingEntity living) {
            var maxAttr = living.getAttribute(Attribute.GENERIC_MAX_HEALTH);
            if (maxAttr != null && config.isAntiIndicatorsUseMaxAsFake()) {
                fake = (float) maxAttr.getValue();
            }
            if (living instanceof org.bukkit.entity.IronGolem) {
                fake = ironGolemFakeHealth(living.getHealth());
            }
        }

        boolean changed = false;
        List<Object> replacement = new ArrayList<>(packed.size());
        for (Object item : packed) {
            Integer index = readDataIndex(item);
            Object value = readDataValue(item);
            if (index != null && index == LIVING_HEALTH_INDEX && value instanceof Float) {
                replacement.add(recreateDataValue(item, fake));
                changed = true;
            } else {
                replacement.add(item);
            }
        }
        if (changed) {
            writePackedItems(packet, replacement);
        }
        return packet;
    }

    private Object spoofAttributes(Object packet, Player viewer) throws Exception {
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
            boolean armor = config.isAntiIndicatorsSpoofArmor()
                    && (normalized.endsWith("armor") || normalized.endsWith("armor_toughness")
                    || normalized.contains("generic.armor"));
            boolean healthAttr = config.isAntiIndicatorsSpoofHealth()
                    && (normalized.endsWith("max_health") || normalized.endsWith("absorption")
                    || normalized.contains("generic.max_health") || normalized.contains("generic.absorption"));
            if (armor) {
                kept.add(recreateAttributeSnapshot(snap, 0.0D));
                changed = true;
            } else if (healthAttr) {
                double fake = normalized.contains("absorption") ? 0.0D : config.getAntiIndicatorsFakeHealth();
                kept.add(recreateAttributeSnapshot(snap, fake));
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

    private static float ironGolemFakeHealth(double real) {
        if (real > 74) {
            return 75f;
        }
        if (real > 49) {
            return 50f;
        }
        if (real > 24) {
            return 25f;
        }
        return 1f;
    }

    private static boolean isEntityMetadataPacket(String simpleName) {
        return "PacketPlayOutEntityMetadata".equals(simpleName)
                || "ClientboundSetEntityDataPacket".equals(simpleName);
    }

    private static boolean isUpdateAttributesPacket(String simpleName) {
        return "PacketPlayOutUpdateAttributes".equals(simpleName)
                || "ClientboundUpdateAttributesPacket".equals(simpleName);
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

    @SuppressWarnings("unchecked")
    private static List<?> readPackedItems(Object packet) throws Exception {
        for (Field field : packet.getClass().getDeclaredFields()) {
            if (List.class.isAssignableFrom(field.getType())) {
                field.setAccessible(true);
                Object value = field.get(packet);
                if (value instanceof List<?> list) {
                    return list;
                }
            }
        }
        return null;
    }

    private static void writePackedItems(Object packet, List<?> items) throws Exception {
        for (Field field : packet.getClass().getDeclaredFields()) {
            if (List.class.isAssignableFrom(field.getType())) {
                field.setAccessible(true);
                if (Modifier.isFinal(field.getModifiers())) {
                    field.set(packet, items);
                } else {
                    field.set(packet, items);
                }
                return;
            }
        }
    }

    private static Integer readDataIndex(Object dataValue) throws Exception {
        for (Field field : dataValue.getClass().getDeclaredFields()) {
            if (field.getType() == int.class || field.getType() == Integer.class) {
                field.setAccessible(true);
                return (Integer) field.get(dataValue);
            }
        }
        for (Method method : dataValue.getClass().getMethods()) {
            if (method.getParameterCount() == 0
                    && (method.getName().equals("a") || method.getName().equals("id") || method.getName().equals("getId"))
                    && (method.getReturnType() == int.class || method.getReturnType() == Integer.class)) {
                return (Integer) method.invoke(dataValue);
            }
        }
        return null;
    }

    private static Object readDataValue(Object dataValue) throws Exception {
        for (Method method : dataValue.getClass().getMethods()) {
            if (method.getParameterCount() == 0
                    && (method.getName().equals("c") || method.getName().equals("value") || method.getName().equals("b"))) {
                Class<?> rt = method.getReturnType();
                if (rt == Float.class || rt == float.class || rt == Object.class || !rt.isPrimitive()) {
                    Object v = method.invoke(dataValue);
                    if (v instanceof Float) {
                        return v;
                    }
                }
            }
        }
        Object last = null;
        for (Field field : dataValue.getClass().getDeclaredFields()) {
            field.setAccessible(true);
            Object v = field.get(dataValue);
            if (v instanceof Float) {
                return v;
            }
            last = v;
        }
        return last;
    }

    private static Object recreateDataValue(Object original, float newValue) throws Exception {
        Constructor<?>[] ctors = original.getClass().getDeclaredConstructors();
        for (Constructor<?> ctor : ctors) {
            Class<?>[] params = ctor.getParameterTypes();
            if (params.length == 3 && (params[0] == int.class || params[0] == Integer.class)) {
                ctor.setAccessible(true);
                Object serializer = null;
                for (Field field : original.getClass().getDeclaredFields()) {
                    field.setAccessible(true);
                    Object v = field.get(original);
                    if (v != null && v.getClass().getSimpleName().contains("Serializer")) {
                        serializer = v;
                        break;
                    }
                    if (v != null && !(v instanceof Number) && !(v instanceof Float)
                            && field.getType() != int.class && field.getType() != Integer.class) {
                        serializer = v;
                    }
                }
                Integer id = readDataIndex(original);
                if (id == null || serializer == null) {
                    continue;
                }
                return ctor.newInstance(id, serializer, newValue);
            }
        }
        for (Field field : original.getClass().getDeclaredFields()) {
            if (field.getType() == Float.class || field.getType() == float.class || field.getType() == Object.class) {
                field.setAccessible(true);
                Object current = field.get(original);
                if (current instanceof Float || field.getType() == float.class || field.getType() == Float.class) {
                    try {
                        field.set(original, newValue);
                        return original;
                    } catch (Exception ignored) {
                    }
                }
            }
        }
        return original;
    }

    @SuppressWarnings("unchecked")
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
            if (asString.contains("armor") || asString.contains("health") || asString.contains("absorption")
                    || asString.contains("generic.") || asString.contains("minecraft:")) {
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
            if (params.length >= 2) {
                ctor.setAccessible(true);
                Object[] args = new Object[params.length];
                Object[] current = unpackSnapshotArgs(original, params.length);
                if (current == null) {
                    continue;
                }
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
