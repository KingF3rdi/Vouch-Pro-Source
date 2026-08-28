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
    const int swapAt = std::clamp(rng_.uniformInt(swapAtMinMs, swapAtMaxMs), 1, totalHold - 1);

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
