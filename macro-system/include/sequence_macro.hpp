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

/// Konfiguration fuer die sequentielle Hotkey-Kette (Pearlcatch-Logik).
struct SequenceMacroConfig {
    int hotkey{VK_F6};
    WORD slotAKey{'4'};
    WORD slotBKey{'5'};
    int preThrowDelayMinMs{10};
    int preThrowDelayMaxMs{20};
    int betweenSlotsDelayMinMs{40};
    int betweenSlotsDelayMaxMs{60};
};

/// Sequentielles Makro: Slot A -> Rechtsklick -> Slot B -> Rechtsklick.
class SequenceMacro {
public:
    SequenceMacro(SequenceMacroConfig config, RandomEngine& rng);

    void start();
    void stop();
    bool isRunning() const;

private:
    void runLoop();
    void executeSequence();
    bool isHotkeyPressed() const;

    SequenceMacroConfig config_;
    RandomEngine& rng_;
    InputSimulator input_;

    std::atomic<bool> running_{false};
    std::atomic<bool> stopRequested_{false};
    std::atomic<bool> sequenceRunning_{false};
    std::thread worker_;
    bool hotkeyWasDown_{false};
};

}  // namespace macro
