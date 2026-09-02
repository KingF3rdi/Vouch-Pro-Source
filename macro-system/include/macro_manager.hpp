#pragma once

#include "anchor_macros.hpp"
#include "app_config.hpp"
#include "hit_crystal_macros.hpp"

#include "common.hpp"
#include "game_state_guard.hpp"
#include "global_bindings.hpp"

namespace macro {

class MacroManager {
public:
    explicit MacroManager(AppConfig config = {});

    void setConfig(const AppConfig& config);
    AppConfig config() const;

    void startAll();
    void stopAll();

    bool isRunning() const;

    bool isInFreeFall() const;
    bool isShieldActive() const;
    bool isEnemyInRange() const;
    bool isChatOpen() const;
    bool isInventoryOpen() const;

    StunslamBot& stunslam();
    PearlcatchMacros& pearlcatch();
    AnchorMacros& anchor();
    HitCrystalMacros& hitCrystal();
    ElytraUnequipBot& elytra();
    AutoTotemBot& autoTotem();
    GameStateGuard& gameState();
    GlobalBindings& bindings();

private:
    AppConfig config_;
    RandomEngine rng_;
    GameStateGuard guard_;
    GlobalBindings bindings_;
    StunslamBot stunslam_;
    PearlcatchMacros pearlcatch_;
    AnchorMacros anchor_;
    HitCrystalMacros hitCrystal_;
    ElytraUnequipBot elytra_;
    AutoTotemBot autoTotem_;
    bool running_{false};
};

}  // namespace macro
