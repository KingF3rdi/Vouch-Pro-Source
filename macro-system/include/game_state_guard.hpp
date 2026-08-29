#pragma once

#include <atomic>

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "screen_analyzer.hpp"

namespace macro {

/// Externe UI-Zustandserkennung: Chat/Inventar blockieren Makros zentral.
class GameStateGuard {
public:
    enum class MacroPolicy {
        Gameplay,
        InventoryAutoTotem,
    };

    void update();

    bool isChatOpen() const;
    bool isInventoryOpen() const;
    bool isAllowed(MacroPolicy policy) const;

    WORD lastActiveHotbarSlot() const;

private:
    void updateHotbarTracking();

    ScreenAnalyzer screen_;
    std::atomic<bool> chatOpen_{false};
    std::atomic<bool> inventoryOpen_{false};
    WORD lastHotbarSlot_{'1'};
    bool hotbarKeyDown_[10]{};
};

}  // namespace macro
