#pragma once

#include "elytra_unequip.hpp"
#include "pearlcatch_macros.hpp"
#include "stunslam_bot.hpp"

namespace macro {

struct AppConfig {
    StunslamBotConfig stunslam{};
    PearlcatchMacrosConfig pearlcatch{};
    ElytraUnequipConfig elytra{};
};

}  // namespace macro
