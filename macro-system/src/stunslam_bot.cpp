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

bool StunslamBot::isShieldActive() const {
    return shieldInRange_ || shieldOnGround_;
}

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
    // Luft-Stunslam: Treffer -> Axt -> Mace -> Treffer -> optional zurueck zur Axt
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);

    input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
    input_.pressKey(config_.axeSlotKey);
    input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
    input_.pressKey(config_.maceSlotKey);
    input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);

    if (config_.switchBackToAxeWhenActivated && isActivationActive()) {
        input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
        input_.pressKey(config_.axeSlotKey);
    }

    lastAirStunTime_ = now();
}

void StunslamBot::executeGroundShieldStun() {
    // Boden-Stun: Treffer -> waehrend Hit Axt-Swap -> zweiter Treffer
    input_.microDelay(config_.microDelayMinMs, config_.microDelayMaxMs);
    input_.leftClickWithMidSwap(config_.axeSlotKey, config_.clickHoldMinMs, config_.clickHoldMaxMs,
                                config_.midSwapMinMs, config_.midSwapMaxMs);
    input_.sleepMs(config_.preClickDelayMinMs, config_.preClickDelayMaxMs);
    input_.leftClick(config_.clickHoldMinMs, config_.clickHoldMaxMs);

    lastGroundStunTime_ = now();
}

void StunslamBot::runLoop() {
    while (!stopRequested_) {
        guard_.update();
        fallDetector_.update();

        const bool gameplayAllowed =
            guard_.isAllowed(GameStateGuard::MacroPolicy::Gameplay);

        bool enemyShield = false;
        bool groundShield = false;

        if (gameplayAllowed) {
            enemyShield = screen_.isEnemyShieldInRange();
            groundShield = screen_.isShieldOnGround();
        }

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

        if (airCooldownReady && falling && enemyShield &&
            rng_.rollPercent(config_.successChance)) {
            executeAirStunslam();
        } else if (groundCooldownReady && groundShield &&
                   rng_.rollPercent(config_.successChance)) {
            executeGroundShieldStun();
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
