#include "game_state_guard.hpp"

namespace macro {

void GameStateGuard::update() {
    chatOpen_ = screen_.isChatOpen();
    inventoryOpen_ = screen_.isInventoryOpen();
    updateHotbarTracking();
}

bool GameStateGuard::isChatOpen() const { return chatOpen_; }

bool GameStateGuard::isInventoryOpen() const { return inventoryOpen_; }

bool GameStateGuard::isAllowed(MacroPolicy policy) const {
    if (chatOpen_) {
        return false;
    }

    switch (policy) {
        case MacroPolicy::Gameplay:
            return !inventoryOpen_;
        case MacroPolicy::InventoryAutoTotem:
            return inventoryOpen_;
        default:
            return false;
    }
}

WORD GameStateGuard::lastActiveHotbarSlot() const { return lastHotbarSlot_; }

void GameStateGuard::updateHotbarTracking() {
    for (int slot = 1; slot <= 9; ++slot) {
        const WORD key = static_cast<WORD>('0' + slot);
        const bool down = (GetAsyncKeyState(key) & 0x8000) != 0;
        const int idx = slot - 1;

        if (down && !hotbarKeyDown_[idx]) {
            lastHotbarSlot_ = key;
        }
        hotbarKeyDown_[idx] = down;
    }
}

}  // namespace macro
