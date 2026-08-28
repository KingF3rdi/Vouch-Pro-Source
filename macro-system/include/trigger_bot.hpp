#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "fall_detector.hpp"
#include "input_simulator.hpp"
#include "screen_analyzer.hpp"

#include <atomic>
#include <thread>

namespace macro {

/// Konfiguration fuer den automatischen Trigger (Stunslam-Logik).
struct TriggerBotConfig {
    int cooldownMs{1000};
    int successChance{100};
    bool isAlwaysActive{false};
    int activationKey{VK_XBUTTON1};
    int clickHoldMinMs{25};
    int clickHoldMaxMs{60};
    int loopReliefMinMs{2};
    int loopReliefMaxMs{5};
    FallDetectorConfig fall{};
};

/// Automatischer Trigger-Thread mit Bildschirmanalyse und Linksklick.
class TriggerBot {
public:
    TriggerBot(TriggerBotConfig config, RandomEngine& rng);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const TriggerBotConfig& config);
    TriggerBotConfig config() const;

    bool isFalling() const;
    bool isShieldActive() const;

private:
    void runLoop();
    bool isActivationActive() const;

    TriggerBotConfig config_;
    RandomEngine& rng_;
    InputSimulator input_;
    ScreenAnalyzer screen_;
    FallDetector fallDetector_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> shieldActive_{false};
    std::thread worker_;
    std::chrono::steady_clock::time_point lastTriggerTime_{now()};
};

}  // namespace macro
