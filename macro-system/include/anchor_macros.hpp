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

struct AnchorMacrosConfig {
    int delayMinMs{5};
    int delayMaxMs{12};
    int cooldownMs{420};

  /// Hotbar-Slots
    WORD anchorSlotKey{'7'};
    WORD glowstoneSlotKey{'8'};
    WORD explodeSlotKey{'2'};
    WORD totemSlotKey{'9'};

  /// Glowstone-Klicks vor dem Explode (1 = einmal laden)
    int chargeClicks{1};

    int hotkeySingle{VK_F11};
    int hotkeyAir{VK_F12};
    int hotkeySafe{VK_INSERT};

    int loopReliefMinMs{1};
    int loopReliefMaxMs{3};
};

class AnchorMacros {
public:
    AnchorMacros(AnchorMacrosConfig config, RandomEngine& rng, GameStateGuard& guard,
                 GlobalBindings& bindings);

    void start();
    void stop();
    bool isRunning() const;

    void setConfig(const AnchorMacrosConfig& config);
    AnchorMacrosConfig config() const;

private:
    void runLoop();
    bool consumeHotkeyEdge(int virtualKey);
    bool cooldownReady() const;
    void markCooldown();

    void selectSlot(WORD slotKey);
    void placeAnchor();
    void chargeGlowstone();
    void explodeWithSlot(WORD slotKey);
    void airPlaceAnchor();

    void executeSingleAnchor();
    void executeAirAnchor();
    void executeSafeAnchor();

    AnchorMacrosConfig config_;
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
