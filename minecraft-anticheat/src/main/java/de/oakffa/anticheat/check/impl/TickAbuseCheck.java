package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;

/**
 * Detects timer / wrong-tick usage and impossible action rates.
 * Uses a balance buffer + consecutive-sample streaks so lag spikes rarely ban.
 */
public final class TickAbuseCheck extends Check {

    public enum ActionType {
        ATTACK, INTERACT, DIG, PLACE
    }

    public TickAbuseCheck(CheckManager manager) {
        super(manager, "TickAbuse");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isTickAbuseEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getTickAbuseWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getTickAbuseMaxVl();
    }

    @Override
    public void onJoin(Player player, PlayerData data) {
        data.resetTickTracking();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        if (shouldExempt(player, data)) {
            data.resetTickTracking();
            return;
        }

        Location from = event.getFrom();
        Location to = event.getTo();
        if (to == null) {
            return;
        }

        // Look-only packets are normal and frequent — only count position ticks for timer
        boolean moved = from.getX() != to.getX() || from.getY() != to.getY() || from.getZ() != to.getZ();
        if (!moved) {
            return;
        }

        long now = System.currentTimeMillis();
        long last = data.getLastMovePacketMs();
        if (last <= 0L) {
            data.setLastMovePacketMs(now);
            data.setTickBalanceMs(0);
            return;
        }

        long delta = Math.max(1L, now - last);
        data.setLastMovePacketMs(now);

        // Expected ~50ms between position ticks at 20 TPS.
        // Fast client (timer): delta small → balance climbs.
        // Lag: delta large → balance drops (forgiven).
        long expected = 50L;
        long balance = data.getTickBalanceMs() + expected - delta;

        // Clamp so lag recovery cannot hide endless timer forever, but lag won't spike VL
        int maxBalance = manager.getConfig().getTickAbuseMaxBalanceMs();
        int minBalance = manager.getConfig().getTickAbuseMinBalanceMs();
        if (balance > maxBalance) {
            balance = maxBalance;
        }
        if (balance < minBalance) {
            balance = minBalance;
        }
        data.setTickBalanceMs(balance);

        int ping = Math.max(0, player.getPing());
        int pingBonus = Math.min(150, ping / 2); // high ping → need higher balance to flag
        int flagBalance = manager.getConfig().getTickAbuseFlagBalanceMs() + pingBonus;

        if (balance >= flagBalance) {
            data.setTimerStreak(data.getTimerStreak() + 1);
        } else {
            data.setTimerStreak(Math.max(0, data.getTimerStreak() - 1));
        }

        int needed = manager.getConfig().getTickAbuseTimerStreak();
        if (data.getTimerStreak() >= needed) {
            data.setTimerStreak(0);
            // Soften balance after a flag so we don't machine-gun flags
            data.setTickBalanceMs(Math.max(0, balance / 2));
            flag(player, data, String.format("timer balance=%dms ping=%d streak=%d", balance, ping, needed));
        }

        // Also track raw move rate over 1s as a secondary, lenient check
        data.pushMoveTimestamp(now, 40);
        int moves = data.countRecentMoves(1000L);
        int maxMoves = manager.getConfig().getTickAbuseMaxMovesPerSecond() + (ping > 200 ? 6 : 0);
        if (moves >= maxMoves) {
            data.setMoveBurstStreak(data.getMoveBurstStreak() + 1);
            if (data.getMoveBurstStreak() >= manager.getConfig().getTickAbuseBurstStreak()) {
                data.setMoveBurstStreak(0);
                flag(player, data, String.format("move burst %d/s (max %d) ping=%d", moves, maxMoves, ping));
            }
        } else {
            data.setMoveBurstStreak(0);
        }
    }

    public void onAction(Player player, PlayerData data, ActionType type) {
        if (!isEnabled() || shouldExempt(player, data)) {
            return;
        }
        if (System.currentTimeMillis() - data.getJoinTimeMs() < 3000L) {
            return;
        }

        long now = System.currentTimeMillis();
        data.pushActionTimestamp(now, 60);
        int actions = data.countRecentActions(1000L);
        int ping = Math.max(0, player.getPing());
        int maxActions = manager.getConfig().getTickAbuseMaxActionsPerSecond() + (ping > 200 ? 4 : 0);

        if (actions >= maxActions) {
            data.setActionBurstStreak(data.getActionBurstStreak() + 1);
            if (data.getActionBurstStreak() >= manager.getConfig().getTickAbuseBurstStreak()) {
                data.setActionBurstStreak(0);
                flag(player, data, String.format("action burst %s %d/s (max %d) ping=%d",
                        type.name().toLowerCase(), actions, maxActions, ping));
            }
        } else {
            data.setActionBurstStreak(Math.max(0, data.getActionBurstStreak() - 1));
        }

        // Wrong-tick style: many attacks with almost no move packets while not in vehicle/lag
        if (type == ActionType.ATTACK) {
            int moves = data.countRecentMoves(500L);
            int attacks = data.countRecentActions(500L);
            int minMoves = manager.getConfig().getTickAbuseMinMovesWithAttacks();
            if (attacks >= manager.getConfig().getTickAbuseAttackDesyncCount()
                    && moves <= minMoves
                    && ping < 300
                    && player.getVehicle() == null) {
                data.setActionDesyncStreak(data.getActionDesyncStreak() + 1);
                if (data.getActionDesyncStreak() >= manager.getConfig().getTickAbuseBurstStreak()) {
                    data.setActionDesyncStreak(0);
                    flag(player, data, String.format("attack-without-ticks attacks=%d moves=%d ping=%d",
                            attacks, moves, ping));
                }
            } else {
                data.setActionDesyncStreak(0);
            }
        }
    }

    private boolean shouldExempt(Player player, PlayerData data) {
        if (player.getGameMode() == GameMode.SPECTATOR || player.getGameMode() == GameMode.CREATIVE) {
            return true;
        }
        if (player.isInsideVehicle() || player.isGliding() || player.isFlying() || player.isRiptiding()) {
            return true;
        }
        if (data.isExemptNextMove()) {
            return true;
        }
        // Extreme lag — do not judge tick rate
        return player.getPing() >= manager.getConfig().getTickAbuseMaxPingExempt();
    }
}
