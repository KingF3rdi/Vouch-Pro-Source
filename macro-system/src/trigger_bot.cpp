#include "trigger_bot.hpp"

namespace macro {

TriggerBot::TriggerBot(TriggerBotConfig config, RandomEngine& rng)
    : config_(config), rng_(rng), input_(rng) {}

void TriggerBot::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastTriggerTime_ = now();
    worker_ = std::thread(&TriggerBot::runLoop, this);
    running_ = true;
}

void TriggerBot::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool TriggerBot::isRunning() const { return running_; }

bool TriggerBot::isActivationActive() const {
    if (config_.isAlwaysActive) {
        return true;
    }
    return (GetAsyncKeyState(config_.activationKey) & 0x8000) != 0;
}

void TriggerBot::runLoop() {
    while (!stopRequested_) {
        const bool cooldownReady = elapsedMs(lastTriggerTime_) >= config_.cooldownMs;

        if (cooldownReady && isActivationActive() && screen_.verifyScreenState()) {
            // Zufallsberechnung: menschliche Ausloesewahrscheinlichkeit
            if (rng_.rollPercent(config_.successChance)) {
                input_.leftClick(25, 60);
                lastTriggerTime_ = now();
            }
        }

        cpuRelief(rng_);
    }
}

}  // namespace macro
