#include "pearlcatch_macros.hpp"

namespace macro {

PearlcatchMacros::PearlcatchMacros(PearlcatchMacrosConfig config, RandomEngine& rng)
    : config_(config), rng_(rng), input_(rng) {}

void PearlcatchMacros::setConfig(const PearlcatchMacrosConfig& config) { config_ = config; }

PearlcatchMacrosConfig PearlcatchMacros::config() const { return config_; }

void PearlcatchMacros::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    worker_ = std::thread(&PearlcatchMacros::runLoop, this);
    running_ = true;
}

void PearlcatchMacros::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool PearlcatchMacros::isRunning() const { return running_; }

bool PearlcatchMacros::consumeHotkeyEdge(int virtualKey) {
    const bool down = (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
    const bool edge = down && !keyStates_[virtualKey & 0xFF];
    keyStates_[virtualKey & 0xFF] = down;
    return edge;
}

void PearlcatchMacros::executeStandardPearlcatch() {
    input_.pressKey(config_.pearlSlotKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.pressKey(config_.windchargeSlotKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
}

void PearlcatchMacros::executeDiagonalPearlcatch(bool leftDiagonal) {
    if (leftDiagonal) {
        input_.holdKeys({'W', 'A'});
    } else {
        input_.holdKeys({'W', 'D'});
    }

    executeStandardPearlcatch();

    if (leftDiagonal) {
        input_.releaseKeys({'W', 'A'});
    } else {
        input_.releaseKeys({'W', 'D'});
    }
}

void PearlcatchMacros::executeOffhandPearlcatch() {
    // Offhand-Wechsel: Windcharge-Slot -> Swap -> Doppel-Rechtsklick -> Swap zurueck
    input_.pressKey(config_.windchargeSlotKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.pressKey(config_.offhandSwapKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.doubleRightClick(config_.delayMinMs, config_.delayMaxMs, config_.delayMinMs,
                            config_.delayMaxMs);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.pressKey(config_.offhandSwapKey);
}

void PearlcatchMacros::executeLungeSwap() {
    input_.pressKey(config_.lungeSlotB);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.pressKey(config_.lungeUseKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.pressKey(config_.lungeSlotA);
}

void PearlcatchMacros::runLoop() {
    while (!stopRequested_) {
        if (!sequenceRunning_) {
            if (consumeHotkeyEdge(config_.hotkeyStandard)) {
                sequenceRunning_ = true;
                executeStandardPearlcatch();
                sequenceRunning_ = false;
            } else if (consumeHotkeyEdge(config_.hotkeyDiagonalLeft)) {
                sequenceRunning_ = true;
                executeDiagonalPearlcatch(true);
                sequenceRunning_ = false;
            } else if (consumeHotkeyEdge(config_.hotkeyDiagonalRight)) {
                sequenceRunning_ = true;
                executeDiagonalPearlcatch(false);
                sequenceRunning_ = false;
            } else if (consumeHotkeyEdge(config_.hotkeyOffhand)) {
                sequenceRunning_ = true;
                executeOffhandPearlcatch();
                sequenceRunning_ = false;
            } else if (consumeHotkeyEdge(config_.hotkeyLunge)) {
                sequenceRunning_ = true;
                executeLungeSwap();
                sequenceRunning_ = false;
            }
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
