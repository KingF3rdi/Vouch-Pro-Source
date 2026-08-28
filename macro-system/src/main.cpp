#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "sequence_macro.hpp"
#include "trigger_bot.hpp"

#include <iostream>

namespace {

macro::TriggerBotConfig defaultTriggerConfig() {
    macro::TriggerBotConfig cfg;
    cfg.cooldownMs = 1000;
    cfg.successChance = 85;
    cfg.isAlwaysActive = false;
    cfg.clickHoldMinMs = 25;
    cfg.clickHoldMaxMs = 60;
    cfg.fall.motionSampleIntervalMs = 15;
    cfg.fall.fallDetectionWindowMs = 300;
    cfg.fall.upwardVelocityThreshold = 28.0f;
    return cfg;
}

macro::SequenceMacroConfig defaultSequenceConfig() {
    macro::SequenceMacroConfig cfg;
    cfg.hotkey = VK_F6;
    cfg.slotAKey = '4';
    cfg.slotBKey = '5';
    cfg.preThrowDelayMinMs = 10;
    cfg.preThrowDelayMaxMs = 20;
    cfg.betweenSlotsDelayMinMs = 40;
    cfg.betweenSlotsDelayMaxMs = 60;
    return cfg;
}

void printBanner() {
    std::cout << "=== Macro System (Stunslam + Pearlcatch) ===\n"
              << "TriggerBot: XButton1 halten + Fall erkannt + Schild aktiv\n"
              << "SequenceMacro: F6 druecken\n"
              << "Beenden: ESC\n";
}

}  // namespace

int main() {
    printBanner();

    macro::RandomEngine rng;
    macro::TriggerBot triggerBot(defaultTriggerConfig(), rng);
    macro::SequenceMacro sequenceMacro(defaultSequenceConfig(), rng);

    triggerBot.start();
    sequenceMacro.start();

    // Hauptschleife: auf ESC warten und Module sauber stoppen
    while ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) == 0) {
        macro::cpuRelief(rng);
    }

    triggerBot.stop();
    sequenceMacro.stop();

    std::cout << "Beendet.\n";
    return 0;
}
