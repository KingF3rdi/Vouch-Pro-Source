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

struct PearlcatchMacrosConfig {
    int delayMinMs{5};
    int delayMaxMs{15};

    WORD pearlSlotKey{'4'};
    WORD windchargeSlotKey{'5'};
    WORD offhandSwapKey{'F'};

    WORD totemHotbarSlotKey{'9'};
    WORD fallbackReturnSlotKey{'1'};

    int hotkeyStandard{VK_F6};
    int hotkeyDiagonalLeft{VK_F7};
    int hotkeyDiagonalRight{VK_F8};
    int hotkeyOffhand{VK_F9};
    int hotkeyLunge{VK_F10};
    int hotkeyHotbarTotem{VK_F5};

    WORD lungeSlotA{'1'};
    WORD lungeSlotB{'2'};
    WORD lungeUseKey{'R'};

    int loopReliefMinMs{1};
    int loopReliefMaxMs{3};
};

/// Pearlcatch-, Bewegungs- und Hotbar-Totem-Makros.
class PearlcatchMacros {
public:
    PearlcatchMacros(PearlcatchMacrosConfig config, RandomEngine& rng, GameStateGuard& guard);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const PearlcatchMacrosConfig& config);
    PearlcatchMacrosConfig config() const;

private:
    void runLoop();
    bool consumeHotkeyEdge(int virtualKey);
    void executeStandardPearlcatch();
    void executeDiagonalPearlcatch(bool leftDiagonal);
    void executeOffhandPearlcatch();
    void executeLungeSwap();
    void executeHotbarTotemSwap();

    PearlcatchMacrosConfig config_;
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
