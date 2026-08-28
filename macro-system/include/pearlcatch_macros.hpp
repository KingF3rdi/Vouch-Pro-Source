#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "common.hpp"
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

    int hotkeyStandard{VK_F6};
    int hotkeyDiagonalLeft{VK_F7};
    int hotkeyDiagonalRight{VK_F8};
    int hotkeyOffhand{VK_F9};
    int hotkeyLunge{VK_F10};

    WORD lungeSlotA{'1'};
    WORD lungeSlotB{'2'};
    WORD lungeUseKey{'R'};

    int loopReliefMinMs{1};
    int loopReliefMaxMs{3};
};

/// Pearlcatch- und Bewegungsmakros mit extrem kurzen Delays.
class PearlcatchMacros {
public:
    PearlcatchMacros(PearlcatchMacrosConfig config, RandomEngine& rng);

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

    PearlcatchMacrosConfig config_;
    RandomEngine& rng_;
    InputSimulator input_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> sequenceRunning_{false};
    std::thread worker_;
    bool keyStates_[256]{};
};

}  // namespace macro
