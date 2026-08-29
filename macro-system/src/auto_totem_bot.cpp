#include "auto_totem_bot.hpp"

namespace macro {

AutoTotemBot::AutoTotemBot(AutoTotemConfig config, RandomEngine& rng, GameStateGuard& guard)
    : config_(config), rng_(rng), guard_(guard), input_(rng) {}

void AutoTotemBot::setConfig(const AutoTotemConfig& config) { config_ = config; }

AutoTotemConfig AutoTotemBot::config() const { return config_; }

void AutoTotemBot::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    worker_ = std::thread(&AutoTotemBot::runLoop, this);
    running_ = true;
}

void AutoTotemBot::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool AutoTotemBot::isRunning() const { return running_; }

bool AutoTotemBot::consumeHotkeyEdge(int virtualKey) {
    const bool down = (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
    const bool edge = down && !keyStates_[virtualKey & 0xFF];
    keyStates_[virtualKey & 0xFF] = down;
    return edge;
}

void AutoTotemBot::executeInventoryTotemSwap() {
    if (config_.totemInventorySlotX <= 0 || config_.totemInventorySlotY <= 0) {
        return;
    }

    input_.moveCursor(config_.totemInventorySlotX, config_.totemInventorySlotY);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    input_.shiftLeftClick();
}

void AutoTotemBot::runLoop() {
    while (!stopRequested_) {
        guard_.update();

        if (!sequenceRunning_ && config_.enabled &&
            guard_.isAllowed(GameStateGuard::MacroPolicy::InventoryAutoTotem) &&
            consumeHotkeyEdge(config_.hotkey)) {
            sequenceRunning_ = true;
            executeInventoryTotemSwap();
            sequenceRunning_ = false;
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
