#include "macro_manager.hpp"

namespace macro {

MacroManager::MacroManager(AppConfig config)
    : config_(config),
      stunslam_(config.stunslam, rng_),
      pearlcatch_(config.pearlcatch, rng_),
      elytra_(config.elytra, rng_) {}

void MacroManager::setConfig(const AppConfig& config) {
    config_ = config;
    stunslam_.setConfig(config.stunslam);
    pearlcatch_.setConfig(config.pearlcatch);
    elytra_.setConfig(config.elytra);
}

AppConfig MacroManager::config() const { return config_; }

void MacroManager::startAll() {
    if (running_) {
        return;
    }
    stunslam_.start();
    pearlcatch_.start();
    elytra_.start();
    running_ = true;
}

void MacroManager::stopAll() {
    if (!running_) {
        return;
    }
    stunslam_.stop();
    pearlcatch_.stop();
    elytra_.stop();
    running_ = false;
}

bool MacroManager::isRunning() const { return running_; }

bool MacroManager::isInFreeFall() const { return stunslam_.isInFreeFall(); }

bool MacroManager::isShieldActive() const { return stunslam_.isShieldActive(); }

bool MacroManager::isEnemyInRange() const { return elytra_.isEnemyInRange(); }

StunslamBot& MacroManager::stunslam() { return stunslam_; }

PearlcatchMacros& MacroManager::pearlcatch() { return pearlcatch_; }

ElytraUnequipBot& MacroManager::elytra() { return elytra_; }

}  // namespace macro
