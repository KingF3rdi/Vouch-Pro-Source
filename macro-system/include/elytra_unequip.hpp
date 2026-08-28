#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "input_simulator.hpp"
#include "screen_analyzer.hpp"

#include <atomic>
#include <thread>

namespace macro {

struct ElytraUnequipConfig {
    WORD inventoryKey{'E'};
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

/// Auto Unequip Elytra bei erkanntem Nahkampf-Gegner im Fadenkreuz.
class ElytraUnequipBot {
public:
    ElytraUnequipBot(ElytraUnequipConfig config, RandomEngine& rng);

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
