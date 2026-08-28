#pragma once

#include "app_config.hpp"

#include "common.hpp"

namespace macro {

/// Zentraler Manager fuer alle Automatisierungsmodule.
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

    StunslamBot& stunslam();
    PearlcatchMacros& pearlcatch();
    ElytraUnequipBot& elytra();

private:
    AppConfig config_;
    RandomEngine rng_;
    StunslamBot stunslam_;
    PearlcatchMacros pearlcatch_;
    ElytraUnequipBot elytra_;
    bool running_{false};
};

}  // namespace macro
