#include "input_simulator.hpp"

#include <algorithm>
#include <thread>

namespace macro {

InputSimulator::InputSimulator(RandomEngine& rng) : rng_(rng) {}

void InputSimulator::sendKey(WORD virtualKey, DWORD flags) {
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = virtualKey;
    input.ki.dwFlags = flags;
    SendInput(1, &input, sizeof(INPUT));
}

void InputSimulator::sendMouse(DWORD flags) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = flags;
    SendInput(1, &input, sizeof(INPUT));
}

void InputSimulator::keyDown(WORD virtualKey) { sendKey(virtualKey, 0); }

void InputSimulator::keyUp(WORD virtualKey) { sendKey(virtualKey, KEYEVENTF_KEYUP); }

void InputSimulator::pressKey(WORD virtualKey) {
    keyDown(virtualKey);
    keyUp(virtualKey);
}

void InputSimulator::holdKeys(const std::initializer_list<WORD>& keys) {
    for (WORD key : keys) {
        keyDown(key);
    }
}

void InputSimulator::releaseKeys(const std::initializer_list<WORD>& keys) {
    for (WORD key : keys) {
        keyUp(key);
    }
}

void InputSimulator::leftClick(int holdMinMs, int holdMaxMs) {
    sendMouse(MOUSEEVENTF_LEFTDOWN);
    std::this_thread::sleep_for(
        std::chrono::milliseconds(rng_.uniformInt(holdMinMs, holdMaxMs)));
    sendMouse(MOUSEEVENTF_LEFTUP);
}

void InputSimulator::leftClickWithMidSwap(WORD slotKey, int holdMinMs, int holdMaxMs,
                                          int swapAtMinMs, int swapAtMaxMs) {
    const int totalHold = rng_.uniformInt(holdMinMs, holdMaxMs);
    const int swapAt =
        std::clamp(rng_.uniformInt(swapAtMinMs, swapAtMaxMs), 0, std::max(0, totalHold - 1));

    if (swapAt == 0) {
        // Sofort-Swap: Linksklick und Slotwechsel im selben SendInput-Tick (exakt im Hit)
        INPUT inputs[3]{};
        inputs[0].type = INPUT_MOUSE;
        inputs[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
        inputs[1].type = INPUT_KEYBOARD;
        inputs[1].ki.wVk = slotKey;
        inputs[2].type = INPUT_KEYBOARD;
        inputs[2].ki.wVk = slotKey;
        inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;
        SendInput(3, inputs, sizeof(INPUT));
        std::this_thread::sleep_for(std::chrono::milliseconds(totalHold));
        sendMouse(MOUSEEVENTF_LEFTUP);
        return;
    }

    sendMouse(MOUSEEVENTF_LEFTDOWN);
    std::this_thread::sleep_for(std::chrono::milliseconds(swapAt));
    pressKey(slotKey);
    std::this_thread::sleep_for(std::chrono::milliseconds(totalHold - swapAt));
    sendMouse(MOUSEEVENTF_LEFTUP);
}

void InputSimulator::rightClick(int holdMinMs, int holdMaxMs) {
    sendMouse(MOUSEEVENTF_RIGHTDOWN);
    std::this_thread::sleep_for(
        std::chrono::milliseconds(rng_.uniformInt(holdMinMs, holdMaxMs)));
    sendMouse(MOUSEEVENTF_RIGHTUP);
}

void InputSimulator::fastSlotRightClick(WORD slotKey, int holdMinMs, int holdMaxMs) {
    const int hold = std::max(0, rng_.uniformInt(holdMinMs, holdMaxMs));
    INPUT inputs[4]{};
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = slotKey;
    inputs[1].type = INPUT_KEYBOARD;
    inputs[1].ki.wVk = slotKey;
    inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;
    inputs[2].type = INPUT_MOUSE;
    inputs[2].mi.dwFlags = MOUSEEVENTF_RIGHTDOWN;
    inputs[3].type = INPUT_MOUSE;
    inputs[3].mi.dwFlags = MOUSEEVENTF_RIGHTUP;
    if (hold == 0) {
        SendInput(4, inputs, sizeof(INPUT));
        return;
    }
    SendInput(3, inputs, sizeof(INPUT));
    std::this_thread::sleep_for(std::chrono::milliseconds(hold));
    sendMouse(MOUSEEVENTF_RIGHTUP);
}

void InputSimulator::doubleRightClick(int holdMinMs, int holdMaxMs, int gapMinMs, int gapMaxMs) {
    rightClick(holdMinMs, holdMaxMs);
    sleepMs(gapMinMs, gapMaxMs);
    rightClick(holdMinMs, holdMaxMs);
}

void InputSimulator::shiftLeftClick() {
    // Offhand-/Inventar-Wechsel: Shift-Klick via SendInput
    keyDown(VK_SHIFT);
    microDelay(1, 3);
    sendMouse(MOUSEEVENTF_LEFTDOWN);
    microDelay(1, 3);
    sendMouse(MOUSEEVENTF_LEFTUP);
    keyUp(VK_SHIFT);
}

void InputSimulator::moveCursor(int x, int y) { SetCursorPos(x, y); }

void InputSimulator::microDelay(int minMs, int maxMs) {
    std::this_thread::sleep_for(std::chrono::milliseconds(rng_.uniformInt(minMs, maxMs)));
}

void InputSimulator::sleepMs(int minMs, int maxMs) {
    std::this_thread::sleep_for(std::chrono::milliseconds(rng_.uniformInt(minMs, maxMs)));
}

}  // namespace macro
