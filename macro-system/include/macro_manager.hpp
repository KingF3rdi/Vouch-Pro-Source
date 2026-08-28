#pragma once

#include "app_config.hpp"

#include "common.hpp"
#include "game_state_guard.hpp"

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
    ElytraUnequipBot& elytra();
    AutoTotemBot& autoTotem();
    GameStateGuard& gameState();

private:
    AppConfig config_;
    RandomEngine rng_;
    GameStateGuard guard_;
    StunslamBot stunslam_;
    PearlcatchMacros pearlcatch_;
    ElytraUnequipBot elytra_;
    AutoTotemBot autoTotem_;
    bool running_{false};
};

}  // namespace macro
