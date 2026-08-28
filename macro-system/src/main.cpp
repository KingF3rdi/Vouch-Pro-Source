#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "macro_manager.hpp"

#include <iostream>

namespace {

macro::AppConfig defaultConfig() {
    macro::AppConfig cfg;

    cfg.stunslam.cooldownMs = 1000;
    cfg.stunslam.successChance = 85;
    cfg.stunslam.activationKey = VK_XBUTTON1;
    cfg.stunslam.axeSlotKey = '2';
    cfg.stunslam.fall.motionSampleIntervalMs = 10;
    cfg.stunslam.fall.fallDetectionWindowMs = 220;
    cfg.stunslam.fall.upwardVelocityThreshold = 32.0f;

    cfg.pearlcatch.hotkeyStandard = VK_F6;
    cfg.pearlcatch.hotkeyDiagonalLeft = VK_F7;
    cfg.pearlcatch.hotkeyDiagonalRight = VK_F8;
    cfg.pearlcatch.hotkeyOffhand = VK_F9;
    cfg.pearlcatch.hotkeyLunge = VK_F10;

    cfg.elytra.chestplateSlotX = 0;
    cfg.elytra.chestplateSlotY = 0;

    return cfg;
}

void printBanner() {
    std::cout << "=== Externes Automatisierungs-System ===\n"
              << "Stunslam: XButton1 | Pearlcatch: F6-F10 | Hotbar Totem: F5\n"
              << "AutoTotem (nur Inventar): F11 | Beenden: ESC\n"
              << "Hinweis: Makros sind im Chat und Inventar blockiert (ausser AutoTotem).\n";
}

}  // namespace

int main() {
    printBanner();

    macro::MacroManager manager(defaultConfig());
    manager.startAll();

    macro::RandomEngine rng;
    while ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) == 0) {
        macro::cpuRelief(rng);
    }

    manager.stopAll();
    std::cout << "Beendet.\n";
    return 0;
}
