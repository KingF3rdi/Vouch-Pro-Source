#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "fall_detector.hpp"
#include "game_state_guard.hpp"
#include "input_simulator.hpp"
#include "screen_analyzer.hpp"

#include <atomic>
#include <thread>

namespace macro {

struct StunslamBotConfig {
    int cooldownMs{620};
    int groundStunCooldownMs{480};
    int successChance{100};
    bool isAlwaysActive{false};
    int activationKey{VK_XBUTTON1};
    WORD axeSlotKey{'2'};
    WORD maceSlotKey{'3'};
    int preSwapDelayMinMs{1};
    int preSwapDelayMaxMs{2};
    int clickHoldMinMs{10};
    int clickHoldMaxMs{16};
    int midSwapMinMs{3};
    int midSwapMaxMs{5};
    int betweenHitsMinMs{1};
    int betweenHitsMaxMs{2};
    int microDelayMinMs{1};
    int microDelayMaxMs{1};
    int loopReliefMinMs{1};
    int loopReliefMaxMs{2};
    bool switchBackToAxeWhenActivated{true};
    FallDetectorConfig fall{};
};

class StunslamBot {
public:
    StunslamBot(StunslamBotConfig config, RandomEngine& rng, GameStateGuard& guard);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const StunslamBotConfig& config);
    StunslamBotConfig config() const;

    bool isInFreeFall() const;
    bool isShieldActive() const;
    bool isEnemyShieldInRange() const;
    bool isShieldOnGround() const;

private:
    void runLoop();
    bool isActivationActive() const;
    void executeAirStunslam();
    void executeGroundShieldStun();

    StunslamBotConfig config_;
    RandomEngine& rng_;
    GameStateGuard& guard_;
    InputSimulator input_;
    ScreenAnalyzer screen_;
    FallDetector fallDetector_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> shieldInRange_{false};
    std::atomic<bool> shieldOnGround_{false};
    std::thread worker_;
    std::chrono::steady_clock::time_point lastAirStunTime_{now()};
    std::chrono::steady_clock::time_point lastGroundStunTime_{now()};
};

}  // namespace macro
