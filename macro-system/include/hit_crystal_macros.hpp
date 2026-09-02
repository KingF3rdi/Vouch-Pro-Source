#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "game_state_guard.hpp"
#include "global_bindings.hpp"
#include "input_simulator.hpp"

#include <atomic>
#include <chrono>
#include <thread>

namespace macro {

struct HitCrystalMacrosConfig {
    WORD obsidianSlotKey{'7'};
    WORD crystalSlotKey{'6'};

    /// Minimale, enge Delays fuer konsistentes Timing
    int placeHoldMinMs{0};
    int placeHoldMaxMs{1};
    int betweenPlaceMinMs{0};
    int betweenPlaceMaxMs{1};

    int hitHoldMinMs{8};
    int hitHoldMaxMs{12};
    int preHitMinMs{0};
    int preHitMaxMs{1};

    int cooldownMs{320};
    int hotkey{VK_F3};

    bool hitCrystalAfterPlace{true};

    int loopReliefMinMs{1};
    int loopReliefMaxMs{2};
};

class HitCrystalMacros {
public:
    HitCrystalMacros(HitCrystalMacrosConfig config, RandomEngine& rng, GameStateGuard& guard,
                     GlobalBindings& bindings);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const HitCrystalMacrosConfig& config);
    HitCrystalMacrosConfig config() const;

private:
    void runLoop();
    bool consumeHotkeyEdge(int virtualKey);
    bool cooldownReady() const;
    void markCooldown();
    void executeHitCrystal();

    HitCrystalMacrosConfig config_;
    RandomEngine& rng_;
    GameStateGuard& guard_;
    GlobalBindings& bindings_;
    InputSimulator input_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> sequenceRunning_{false};
    std::thread worker_;
    bool keyStates_[256]{};
    std::chrono::steady_clock::time_point lastSequenceEnd_{};
};

}  // namespace macro
