#include "macro_manager.hpp"

namespace macro {

MacroManager::MacroManager(AppConfig config)
    : config_(config),
      bindings_(config.bindings),
      stunslam_(config.stunslam, rng_, guard_),
      pearlcatch_(config.pearlcatch, rng_, guard_, bindings_),
      anchor_(config.anchor, rng_, guard_, bindings_),
      elytra_(config.elytra, rng_, guard_, bindings_),
      autoTotem_(config.autoTotem, rng_, guard_) {}

void MacroManager::setConfig(const AppConfig& config) {
    config_ = config;
    bindings_ = config.bindings;
    stunslam_.setConfig(config.stunslam);
    pearlcatch_.setConfig(config.pearlcatch);
    anchor_.setConfig(config.anchor);
    elytra_.setConfig(config.elytra);
    autoTotem_.setConfig(config.autoTotem);
}

AppConfig MacroManager::config() const {
    AppConfig cfg = config_;
    cfg.bindings = bindings_;
    return cfg;
}

void MacroManager::startAll() {
    if (running_) {
        return;
    }
    stunslam_.start();
    pearlcatch_.start();
    anchor_.start();
    elytra_.start();
    autoTotem_.start();
    running_ = true;
}

void MacroManager::stopAll() {
    if (!running_) {
        return;
    }
    stunslam_.stop();
    pearlcatch_.stop();
    anchor_.stop();
    elytra_.stop();
    autoTotem_.stop();
    running_ = false;
}

bool MacroManager::isRunning() const { return running_; }

bool MacroManager::isInFreeFall() const { return stunslam_.isInFreeFall(); }

bool MacroManager::isShieldActive() const { return stunslam_.isShieldActive(); }

bool MacroManager::isEnemyInRange() const { return elytra_.isEnemyInRange(); }

bool MacroManager::isChatOpen() const { return guard_.isChatOpen(); }

bool MacroManager::isInventoryOpen() const { return guard_.isInventoryOpen(); }

StunslamBot& MacroManager::stunslam() { return stunslam_; }

PearlcatchMacros& MacroManager::pearlcatch() { return pearlcatch_; }

AnchorMacros& MacroManager::anchor() { return anchor_; }

ElytraUnequipBot& MacroManager::elytra() { return elytra_; }

AutoTotemBot& MacroManager::autoTotem() { return autoTotem_; }

GameStateGuard& MacroManager::gameState() { return guard_; }

GlobalBindings& MacroManager::bindings() { return bindings_; }

}  // namespace macro
