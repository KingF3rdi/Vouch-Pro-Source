#include "sequence_macro.hpp"

namespace macro {

SequenceMacro::SequenceMacro(SequenceMacroConfig config, RandomEngine& rng)
    : config_(config), rng_(rng), input_(rng) {}

void SequenceMacro::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    hotkeyWasDown_ = false;
    worker_ = std::thread(&SequenceMacro::runLoop, this);
    running_ = true;
}

void SequenceMacro::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool SequenceMacro::isRunning() const { return running_; }

bool SequenceMacro::isHotkeyPressed() const {
    return (GetAsyncKeyState(config_.hotkey) & 0x8000) != 0;
}

void SequenceMacro::executeSequence() {
    if (sequenceRunning_.exchange(true)) {
        return;
    }

    // Schritt 1: Slot A (Perle) auswaehlen
    input_.pressKey(config_.slotAKey);
    input_.sleepMs(config_.preThrowDelayMinMs, config_.preThrowDelayMaxMs);

    // Schritt 2: Rechtsklick zum Werfen
    input_.rightClick();

    // Schritt 3: Verzoegerung vor Slot B (Windcharge)
    input_.sleepMs(config_.betweenSlotsDelayMinMs, config_.betweenSlotsDelayMaxMs);

    // Schritt 4: Slot B auswaehlen
    input_.pressKey(config_.slotBKey);
    input_.sleepMs(config_.preThrowDelayMinMs, config_.preThrowDelayMaxMs);

    // Schritt 5: Rechtsklick zum Zuenden
    input_.rightClick();

    sequenceRunning_ = false;
}

void SequenceMacro::runLoop() {
    while (!stopRequested_) {
        const bool hotkeyDown = isHotkeyPressed();

        // Flankenerkennung: nur bei Tastendruck (nicht bei Halten) ausloesen
        if (hotkeyDown && !hotkeyWasDown_ && !sequenceRunning_) {
            executeSequence();
        }

        hotkeyWasDown_ = hotkeyDown;
        cpuRelief(rng_);
    }
}

}  // namespace macro
