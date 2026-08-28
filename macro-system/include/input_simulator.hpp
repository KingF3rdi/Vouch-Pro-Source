#pragma once

#include "common.hpp"

#include <windows.h>

#include <initializer_list>
#include <vector>

namespace macro {

/// Windows SendInput-Wrapper – ausschliesslich moderne SendInput-API.
class InputSimulator {
public:
    explicit InputSimulator(RandomEngine& rng);

    void keyDown(WORD virtualKey);
    void keyUp(WORD virtualKey);
    void pressKey(WORD virtualKey);
    void holdKeys(const std::initializer_list<WORD>& keys);
    void releaseKeys(const std::initializer_list<WORD>& keys);

    void leftClick(int holdMinMs = 15, int holdMaxMs = 35);
    void rightClick(int holdMinMs = 5, int holdMaxMs = 15);
    void doubleRightClick(int holdMinMs = 5, int holdMaxMs = 15, int gapMinMs = 5,
                          int gapMaxMs = 12);
    void shiftLeftClick();

    void moveCursor(int x, int y);
    void microDelay(int minMs = 1, int maxMs = 5);
    void sleepMs(int minMs, int maxMs);

private:
    RandomEngine& rng_;

    void sendMouse(DWORD flags);
    void sendKey(WORD virtualKey, DWORD flags);
};

}  // namespace macro
