#pragma once

#include "auto_totem_bot.hpp"
#include "elytra_unequip.hpp"
#include "pearlcatch_macros.hpp"
#include "stunslam_bot.hpp"

namespace macro {

struct AppConfig {
    StunslamBotConfig stunslam{};
    PearlcatchMacrosConfig pearlcatch{};
    ElytraUnequipConfig elytra{};
    AutoTotemConfig autoTotem{};
};

}  // namespace macro
