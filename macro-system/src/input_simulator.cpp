#include "input_simulator.hpp"

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

void InputSimulator::pressKey(WORD virtualKey) {
    sendKey(virtualKey, 0);
    sendKey(virtualKey, KEYEVENTF_KEYUP);
}

void InputSimulator::leftClick(int holdMinMs, int holdMaxMs) {
    sendMouse(MOUSEEVENTF_LEFTDOWN);
    // Zufallsberechnung: variable Klickdauer wirkt menschlicher
    std::this_thread::sleep_for(
        std::chrono::milliseconds(rng_.uniformInt(holdMinMs, holdMaxMs)));
    sendMouse(MOUSEEVENTF_LEFTUP);
}

void InputSimulator::rightClick(int holdMinMs, int holdMaxMs) {
    sendMouse(MOUSEEVENTF_RIGHTDOWN);
    std::this_thread::sleep_for(
        std::chrono::milliseconds(rng_.uniformInt(holdMinMs, holdMaxMs)));
    sendMouse(MOUSEEVENTF_RIGHTUP);
}

void InputSimulator::sleepMs(int minMs, int maxMs) {
    std::this_thread::sleep_for(
        std::chrono::milliseconds(rng_.uniformInt(minMs, maxMs)));
}

}  // namespace macro
