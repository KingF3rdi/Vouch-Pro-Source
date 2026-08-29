#include "common.hpp"

#include <algorithm>
#include <random>

namespace macro {

RandomEngine::RandomEngine()
    : rng_(static_cast<unsigned>(
          std::chrono::steady_clock::now().time_since_epoch().count())) {}

int RandomEngine::uniformInt(int min, int max) {
    std::uniform_int_distribution<int> dist(min, max);
    return dist(rng_);
}

bool RandomEngine::rollPercent(int chancePercent) {
    if (chancePercent <= 0) {
        return false;
    }
    if (chancePercent >= 100) {
        return true;
    }
    std::uniform_int_distribution<int> dist(1, 100);
    return dist(rng_) <= chancePercent;
}

void cpuRelief(RandomEngine& rng, int minMs, int maxMs) {
    std::this_thread::sleep_for(std::chrono::milliseconds(rng.uniformInt(minMs, maxMs)));
}

}  // namespace macro
