#include "stunslam_bot.hpp"

namespace macro {

StunslamBot::StunslamBot(StunslamBotConfig config, RandomEngine& rng, GameStateGuard& guard)
    : config_(config), rng_(rng), guard_(guard), input_(rng), fallDetector_(config.fall) {}

void StunslamBot::setConfig(const StunslamBotConfig& config) {
    config_ = config;
    fallDetector_.setConfig(config.fall);
}

StunslamBotConfig StunslamBot::config() const { return config_; }

bool StunslamBot::isInFreeFall() const { return fallDetector_.isInFreeFall(); }

bool StunslamBot::isShieldActive() const { return shieldInRange_ || shieldOnGround_; }

bool StunslamBot::isEnemyShieldInRange() const { return shieldInRange_; }

bool StunslamBot::isShieldOnGround() const { return shieldOnGround_; }

void StunslamBot::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastAirStunTime_ = now();
    lastGroundStunTime_ = now();
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

void StunslamBot::executeAirStunslam() {
    // Luft-Stunslam: Hit starten -> mid-hit Axt -> Mace -> Mace-Hit
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.leftClickWithMidSwap(config_.axeSlotKey, config_.clickHoldMinMs, config_.clickHoldMaxMs,
                                config_.airMidSwapMinMs, config_.airMidSwapMaxMs);

    input_.sleepMs(config_.preSwapDelayMinMs, config_.preSwapDelayMaxMs);
    input_.pressKey(config_.maceSlotKey);
    input_.sleepMs(config_.preSwapDelayMinMs, config_.preSwapDelayMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);

    if (config_.switchBackToAxeWhenActivated && isActivationActive()) {
        input_.sleepMs(config_.preSwapDelayMinMs, config_.preSwapDelayMaxMs);
        input_.pressKey(config_.axeSlotKey);
    }

    lastAirStunTime_ = now();
}

void StunslamBot::executeGroundShieldStun() {
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.leftClickWithMidSwap(config_.axeSlotKey, config_.clickHoldMinMs, config_.clickHoldMaxMs,
                                config_.midSwapMinMs, config_.midSwapMaxMs);
    input_.sleepMs(config_.betweenHitsMinMs, config_.betweenHitsMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);

    lastGroundStunTime_ = now();
}

void StunslamBot::runLoop() {
    while (!stopRequested_) {
        guard_.update();
        fallDetector_.update();
        screen_.tickShieldDetection();

        const bool gameplayAllowed =
            guard_.isAllowed(GameStateGuard::MacroPolicy::Gameplay);

        const bool enemyShield = gameplayAllowed && screen_.isEnemyShieldInRange();
        const bool groundShield = gameplayAllowed && screen_.isShieldOnGround();

        shieldInRange_ = enemyShield;
        shieldOnGround_ = groundShield;

        if (!gameplayAllowed || !isActivationActive()) {
            cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
            continue;
        }

        const bool falling = fallDetector_.isInFreeFall();
        const bool airCooldownReady = elapsedMs(lastAirStunTime_) >= config_.cooldownMs;
        const bool groundCooldownReady =
            elapsedMs(lastGroundStunTime_) >= config_.groundStunCooldownMs;

        if (airCooldownReady && falling && enemyShield) {
            executeAirStunslam();
        } else if (groundCooldownReady && groundShield) {
            executeGroundShieldStun();
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
