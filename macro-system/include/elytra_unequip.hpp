#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "game_state_guard.hpp"
#include "global_bindings.hpp"
#include "input_simulator.hpp"
#include "screen_analyzer.hpp"

#include <atomic>
#include <thread>

namespace macro {

struct ElytraUnequipConfig {
    int chestplateSlotX{0};
    int chestplateSlotY{0};
    int scanIntervalMs{12};
    int actionCooldownMs{900};
    int microDelayMinMs{1};
    int microDelayMaxMs{4};
    int loopReliefMinMs{1};
    int loopReliefMaxMs{3};
    bool enabled{true};
};

class ElytraUnequipBot {
public:
    ElytraUnequipBot(ElytraUnequipConfig config, RandomEngine& rng, GameStateGuard& guard,
                     GlobalBindings& bindings);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const ElytraUnequipConfig& config);
    ElytraUnequipConfig config() const;

    bool isEnemyInRange() const;

private:
    void runLoop();
    void executeUnequipSequence();

    ElytraUnequipConfig config_;
    RandomEngine& rng_;
    GameStateGuard& guard_;
    GlobalBindings& bindings_;
    InputSimulator input_;
    ScreenAnalyzer screen_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> enemyInRange_{false};
    std::thread worker_;
    std::chrono::steady_clock::time_point lastActionTime_{};
    std::chrono::steady_clock::time_point lastScanTime_{};
};

}  // namespace macro
