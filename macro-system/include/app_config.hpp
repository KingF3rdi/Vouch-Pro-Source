#pragma once

#include "anchor_macros.hpp"
#include "auto_totem_bot.hpp"
#include "elytra_unequip.hpp"
#include "global_bindings.hpp"
#include "pearlcatch_macros.hpp"
#include "stunslam_bot.hpp"

namespace macro {

struct AppConfig {
    GlobalBindings bindings{};
    StunslamBotConfig stunslam{};
    PearlcatchMacrosConfig pearlcatch{};
    AnchorMacrosConfig anchor{};
    ElytraUnequipConfig elytra{};
    AutoTotemConfig autoTotem{};
};

}  // namespace macro
