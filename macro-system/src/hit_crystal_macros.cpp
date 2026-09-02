#include "hit_crystal_macros.hpp"

namespace macro {

HitCrystalMacros::HitCrystalMacros(HitCrystalMacrosConfig config, RandomEngine& rng,
                                     GameStateGuard& guard, GlobalBindings& bindings)
    : config_(config), rng_(rng), guard_(guard), bindings_(bindings), input_(rng) {
    lastSequenceEnd_ = now();
}

void HitCrystalMacros::setConfig(const HitCrystalMacrosConfig& config) { config_ = config; }

HitCrystalMacrosConfig HitCrystalMacros::config() const { return config_; }

void HitCrystalMacros::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastSequenceEnd_ = now();
    worker_ = std::thread(&HitCrystalMacros::runLoop, this);
    running_ = true;
}

void HitCrystalMacros::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool HitCrystalMacros::isRunning() const { return running_; }

bool HitCrystalMacros::consumeHotkeyEdge(int virtualKey) {
    const bool down = (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
    const bool edge = down && !keyStates_[virtualKey & 0xFF];
    keyStates_[virtualKey & 0xFF] = down;
    return edge;
}

bool HitCrystalMacros::cooldownReady() const {
    return elapsedMs(lastSequenceEnd_) >= config_.cooldownMs;
}

void HitCrystalMacros::markCooldown() { lastSequenceEnd_ = now(); }

void HitCrystalMacros::executeHitCrystal() {
    // 1) Obsidian — Slot + Place im selben Tick
    input_.fastSlotRightClick(config_.obsidianSlotKey, config_.placeHoldMinMs,
                              config_.placeHoldMaxMs);

    // 2) Crystal — minimaler Gap, dann sofort Place
    input_.sleepMs(config_.betweenPlaceMinMs, config_.betweenPlaceMaxMs);
    input_.fastSlotRightClick(config_.crystalSlotKey, config_.placeHoldMinMs,
                              config_.placeHoldMaxMs);

    // 3) Optional: Crystal treffen
    if (config_.hitCrystalAfterPlace) {
        input_.sleepMs(config_.preHitMinMs, config_.preHitMaxMs);
        input_.leftClick(config_.hitHoldMinMs, config_.hitHoldMaxMs);
    }
}

void HitCrystalMacros::runLoop() {
    while (!stopRequested_) {
        guard_.update();

        if (sequenceRunning_ || !cooldownReady()) {
            cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
            continue;
        }

        if (!guard_.isAllowed(GameStateGuard::MacroPolicy::Gameplay)) {
            cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
            continue;
        }

        if (consumeHotkeyEdge(config_.hotkey)) {
            sequenceRunning_ = true;
            executeHitCrystal();
            sequenceRunning_ = false;
            markCooldown();
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
