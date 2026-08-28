#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
#include "game_state_guard.hpp"
#include "input_simulator.hpp"

#include <atomic>
#include <thread>

namespace macro {

struct AutoTotemConfig {
    int hotkey{VK_F11};
    int totemInventorySlotX{0};
    int totemInventorySlotY{0};
    int delayMinMs{5};
    int delayMaxMs{12};
    int loopReliefMinMs{1};
    int loopReliefMaxMs{3};
    bool enabled{true};
};

/// AutoTotem: nur im Inventar aktiv (Shift-Klick auf Totem-Slot).
class AutoTotemBot {
public:
    AutoTotemBot(AutoTotemConfig config, RandomEngine& rng, GameStateGuard& guard);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const AutoTotemConfig& config);
    AutoTotemConfig config() const;

private:
    void runLoop();
    bool consumeHotkeyEdge(int virtualKey);
    void executeInventoryTotemSwap();

    AutoTotemConfig config_;
    RandomEngine& rng_;
    GameStateGuard& guard_;
    InputSimulator input_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> sequenceRunning_{false};
    std::thread worker_;
    bool keyStates_[256]{};
};

}  // namespace macro
