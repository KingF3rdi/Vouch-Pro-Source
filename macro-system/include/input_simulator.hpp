#pragma once

#include "common.hpp"

#include <windows.h>

namespace macro {

/// Windows SendInput-Wrapper fuer Tastatur- und Maus-Simulation.
class InputSimulator {
public:
    explicit InputSimulator(RandomEngine& rng);

    void pressKey(WORD virtualKey);
    void leftClick(int holdMinMs = 25, int holdMaxMs = 60);
    void rightClick(int holdMinMs = 25, int holdMaxMs = 60);
    void sleepMs(int minMs, int maxMs);

private:
    RandomEngine& rng_;

    void sendMouse(DWORD flags);
    void sendKey(WORD virtualKey, DWORD flags);
};

}  // namespace macro
