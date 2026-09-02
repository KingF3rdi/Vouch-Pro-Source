#include "anchor_macros.hpp"

#include <algorithm>

namespace macro {

AnchorMacros::AnchorMacros(AnchorMacrosConfig config, RandomEngine& rng, GameStateGuard& guard,
                           GlobalBindings& bindings)
    : config_(config), rng_(rng), guard_(guard), bindings_(bindings), input_(rng) {
    lastSequenceEnd_ = now();
}

void AnchorMacros::setConfig(const AnchorMacrosConfig& config) { config_ = config; }

AnchorMacrosConfig AnchorMacros::config() const { return config_; }

void AnchorMacros::start() {
    if (running_) {
        return;
    }
    stopRequested_ = false;
    lastSequenceEnd_ = now();
    worker_ = std::thread(&AnchorMacros::runLoop, this);
    running_ = true;
}

void AnchorMacros::stop() {
    if (!running_) {
        return;
    }
    stopRequested_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    running_ = false;
}

bool AnchorMacros::isRunning() const { return running_; }

bool AnchorMacros::consumeHotkeyEdge(int virtualKey) {
    const bool down = (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
    const bool edge = down && !keyStates_[virtualKey & 0xFF];
    keyStates_[virtualKey & 0xFF] = down;
    return edge;
}

bool AnchorMacros::cooldownReady() const {
    return elapsedMs(lastSequenceEnd_) >= config_.cooldownMs;
}

void AnchorMacros::markCooldown() { lastSequenceEnd_ = now(); }

void AnchorMacros::selectSlot(WORD slotKey) {
    input_.pressKey(slotKey);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
}

void AnchorMacros::placeAnchor() {
    selectSlot(config_.anchorSlotKey);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
}

void AnchorMacros::chargeGlowstone() {
    selectSlot(config_.glowstoneSlotKey);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
    // Zwischenladungen: wieder Anchor-Slot (nicht Explode-Slot)
    selectSlot(config_.anchorSlotKey);
}

void AnchorMacros::explodeWithSlot(WORD slotKey) {
    selectSlot(slotKey);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
    input_.sleepMs(config_.delayMinMs, config_.delayMaxMs);
}

void AnchorMacros::airPlaceAnchor() {
    selectSlot(config_.anchorSlotKey);
    input_.rightClick(config_.delayMinMs, config_.delayMaxMs);
}

void AnchorMacros::executeSingleAnchor() {
    // Place -> laden -> exploden (Explode-Slot nur beim letzten Klick)
    placeAnchor();

    const int charges = std::max(1, config_.chargeClicks);
    for (int i = 0; i < charges; ++i) {
        chargeGlowstone();
    }

    explodeWithSlot(config_.explodeSlotKey);
    selectSlot(config_.anchorSlotKey);
}

void AnchorMacros::executeAirAnchor() {
    // Place -> laden (Anchor-Slot zwischen den Schritten) -> letzter Explode -> sofort Air-Place
    placeAnchor();

    const int charges = std::max(1, config_.chargeClicks);
    for (int i = 0; i < charges; ++i) {
        chargeGlowstone();
    }

    // Explode-Slot NUR fuer den letzten Explode
    explodeWithSlot(config_.explodeSlotKey);

    // Direkt danach Anchor platzieren (Air-Place)
    airPlaceAnchor();
}

void AnchorMacros::executeSafeAnchor() {
    // Wie AirAnchor, aber Explode mit Totem-Slot
    placeAnchor();

    const int charges = std::max(1, config_.chargeClicks);
    for (int i = 0; i < charges; ++i) {
        chargeGlowstone();
    }

    explodeWithSlot(config_.totemSlotKey);
    airPlaceAnchor();
}

void AnchorMacros::runLoop() {
    while (!stopRequested_) {
        guard_.update();

        // Waehrend Cooldown oder laufender Sequenz: KEINE Teilaktionen (kein Glowstone-Spam)
        if (sequenceRunning_ || !cooldownReady()) {
            cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
            continue;
        }

        if (!guard_.isAllowed(GameStateGuard::MacroPolicy::Gameplay)) {
            cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
            continue;
        }

        if (consumeHotkeyEdge(config_.hotkeySingle)) {
            sequenceRunning_ = true;
            executeSingleAnchor();
            sequenceRunning_ = false;
            markCooldown();
        } else if (consumeHotkeyEdge(config_.hotkeyAir)) {
            sequenceRunning_ = true;
            executeAirAnchor();
            sequenceRunning_ = false;
            markCooldown();
        } else if (consumeHotkeyEdge(config_.hotkeySafe)) {
            sequenceRunning_ = true;
            executeSafeAnchor();
            sequenceRunning_ = false;
            markCooldown();
        }

        cpuRelief(rng_, config_.loopReliefMinMs, config_.loopReliefMaxMs);
    }
}

}  // namespace macro
