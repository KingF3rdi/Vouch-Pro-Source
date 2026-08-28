#include "trigger_bot.hpp"

namespace macro {

TriggerBot::TriggerBot(TriggerBotConfig config, RandomEngine& rng)
    : config_(config), rng_(rng), input_(rng), fallDetector_(config.fall) {}

void TriggerBot::setConfig(const TriggerBotConfig& config) {
    config_ = config;
    fallDetector_.setConfig(config.fall);
}

TriggerBotConfig TriggerBot::config() const { return config_; }

bool TriggerBot::isFalling() const { return fallDetector_.isFalling(); }

bool TriggerBot::isShieldActive() const { return shieldActive_; }

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
        // Bewegungserkennung alle ~15ms (intern gedrosselt)
        fallDetector_.update();

        const bool cooldownReady = elapsedMs(lastTriggerTime_) >= config_.cooldownMs;
        const bool shieldDetected = screen_.verifyScreenState();
        shieldActive_ = shieldDetected;

        // Stunslam nur bei Fall UND aktivem Schild
        if (cooldownReady && isActivationActive() && fallDetector_.isFalling() && shieldDetected) {
            // Zufallsberechnung: menschliche Ausloesewahrscheinlichkeit
            if (rng_.rollPercent(config_.successChance)) {
                input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);
                lastTriggerTime_ = now();
            }
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
