package de.oakffa.anticheat.check.impl;

import de.oakffa.anticheat.check.Check;
import de.oakffa.anticheat.check.CheckManager;
import de.oakffa.anticheat.data.PlayerData;
import de.oakffa.anticheat.prediction.MovementPredictor;
import de.oakffa.anticheat.prediction.UncertaintyHandler;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.util.Vector;

/**
 * Grim-style simulation check: compare observed movement to predicted physics.
 * High offset → flag + setback (ban only via accumulated flags / threshold).
 */
public final class SimulationCheck extends Check {

    public SimulationCheck(CheckManager manager) {
        super(manager, "Simulation");
    }

    @Override
    public boolean isEnabled() {
        return manager.getConfig().isSimulationEnabled();
    }

    @Override
    public int getWeight() {
        return manager.getConfig().getSimulationWeight();
    }

    @Override
    public int getMaxVl() {
        return manager.getConfig().getSimulationMaxVl();
    }

    @Override
    public void onMove(Player player, PlayerData data, PlayerMoveEvent event) {
        Location from = event.getFrom();
        Location to = event.getTo();
        if (to == null) {
            return;
        }

        UncertaintyHandler.tick(data);

        if (System.currentTimeMillis() - data.getJoinTimeMs() < 3000L || data.isExemptNextMove()) {
            data.setLastVelocity(to.toVector().subtract(from.toVector()));
            data.setWasOnGround(player.isOnGround());
            manager.getSetbackManager().rememberValid(player, to);
            return;
        }

        MovementPredictor.PredictionResult result = MovementPredictor.predict(player, data, from, to);
        Vector actual = to.toVector().subtract(from.toVector());
        data.setLastVelocity(actual);
        data.setWasOnGround(player.isOnGround());

        if (result.ignored()) {
            manager.getSetbackManager().rememberValid(player, to);
            data.setSimulationStreak(0);
            return;
        }

        double threshold = manager.getConfig().getSimulationOffsetThreshold();
        // Decay streak when clean
        if (result.offset() <= threshold * 0.5) {
            data.setSimulationStreak(0);
            manager.getSetbackManager().rememberValid(player, to);
            return;
        }

        if (result.isViolation(threshold)) {
            data.setSimulationStreak(data.getSimulationStreak() + 1);
            int needed = manager.getConfig().getSimulationStreak();
            if (data.getSimulationStreak() >= needed) {
                data.setSimulationStreak(0);
                flag(player, data, String.format("offset=%.4f h=%.4f v=%.4f ping=%d",
                        result.offset(), result.horizontalOffset(), result.verticalOffset(), player.getPing()));
                if (manager.getConfig().isSetbacksEnabled()) {
                    event.setTo(from); // cancel this illegal step client-side as far as Bukkit can
                    manager.getSetbackManager().setback(player,
                            String.format("Simulation offset %.4f", result.offset()));
                }
            }
        } else {
            // Mild overage — don't setback, just reduce confidence
            data.setSimulationStreak(Math.max(0, data.getSimulationStreak() - 1));
            manager.getSetbackManager().rememberValid(player, to);
        }
    }
}
