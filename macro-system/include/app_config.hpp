#pragma once

#include "fall_detector.hpp"
#include "sequence_macro.hpp"
#include "trigger_bot.hpp"

namespace macro {

/// Gesamtkonfiguration fuer GUI und Laufzeit.
struct AppConfig {
    TriggerBotConfig trigger{};
    FallDetectorConfig fall{};
    SequenceMacroConfig sequence{};

    int loopReliefMinMs{2};
    int loopReliefMaxMs{5};
};

}  // namespace macro
