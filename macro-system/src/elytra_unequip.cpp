#include "elytra_unequip.hpp"

namespace macro {

ElytraUnequipBot::ElytraUnequipBot(ElytraUnequipConfig config, RandomEngine& rng,
                                   GameStateGuard& guard, GlobalBindings& bindings)
    : config_(config), rng_(rng), guard_(guard), bindings_(bindings), input_(rng) {}

void ElytraUnequipBot::setConfig(const ElytraUnequipConfig& config) { config_ = config; }

ElytraUnequipConfig ElytraUnequipBot::config() const { return config_; }

bool ElytraUnequipBot::isEnemyInRange() const { return enemyInRange_; }

void ElytraUnequipBot::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastActionTime_ = now();
    lastScanTime_ = now();
    worker_ = std::thread(&ElytraUnequipBot::runLoop, this);
    running_ = true;
}

void ElytraUnequipBot::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool ElytraUnequipBot::isRunning() const { return running_; }

void ElytraUnequipBot::executeUnequipSequence() {
    input_.pressKey(bindings_.inventoryKey);
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);

    input_.moveCursor(config_.chestplateSlotX, config_.chestplateSlotY);
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);

    input_.shiftLeftClick();
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.pressKey(bindings_.inventoryKey);

    lastActionTime_ = now();
}

void ElytraUnequipBot::runLoop() {
    while (!stopRequested_) {
        guard_.update();

        if (config_.enabled && guard_.isAllowed(GameStateGuard::MacroPolicy::Gameplay) &&
            elapsedMs(lastScanTime_) >= config_.scanIntervalMs) {
            lastScanTime_ = now();
            const bool enemy = screen_.isEnemyInCrosshairRange();
            enemyInRange_ = enemy;

            const bool cooldownReady = elapsedMs(lastActionTime_) >= config_.actionCooldownMs;
            if (enemy && cooldownReady && config_.chestplateSlotX > 0 &&
                config_.chestplateSlotY > 0) {
                executeUnequipSequence();
            }
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
