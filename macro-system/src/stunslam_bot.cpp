#include "stunslam_bot.hpp"

namespace macro {

StunslamBot::StunslamBot(StunslamBotConfig config, RandomEngine& rng)
    : config_(config), rng_(rng), input_(rng), fallDetector_(config.fall) {}

void StunslamBot::setConfig(const StunslamBotConfig& config) {
    config_ = config;
    fallDetector_.setConfig(config.fall);
}

StunslamBotConfig StunslamBot::config() const { return config_; }

bool StunslamBot::isInFreeFall() const { return fallDetector_.isInFreeFall(); }

bool StunslamBot::isShieldActive() const { return shieldActive_; }

void StunslamBot::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastTriggerTime_ = now();
    worker_ = std::thread(&StunslamBot::runLoop, this);
    running_ = true;
}

void StunslamBot::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool StunslamBot::isRunning() const { return running_; }

bool StunslamBot::isActivationActive() const {
    if (config_.isAlwaysActive) {
        return true;
    }
    return (GetAsyncKeyState(config_.activationKey) & 0x8000) != 0;
}

void StunslamBot::executeStunslam() {
    // Erweiterter Axt-Swap-Ablauf mit minimaler Humanisierung
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.pressKey(config_.axeSlotKey);
    input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);
    lastTriggerTime_ = now();
}

void StunslamBot::runLoop() {
    while (!stopRequested_) {
        fallDetector_.update();

        const bool falling = fallDetector_.isInFreeFall();
        bool shieldDetected = false;

        // Schild-Scan nur im freien Fall (CPU-effizient)
        if (falling) {
            shieldDetected = screen_.isShieldRaised();
        }
        shieldActive_ = shieldDetected;

        const bool cooldownReady = elapsedMs(lastTriggerTime_) >= config_.cooldownMs;
        if (cooldownReady && isActivationActive() && falling && shieldDetected &&
            rng_.rollPercent(config_.successChance)) {
            executeStunslam();
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
