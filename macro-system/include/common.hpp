#pragma once

#include <chrono>
#include <random>
#include <thread>

namespace macro {

/// Zentraler Zufallsgenerator fuer menschlich wirkende Verzoegerungen.
class RandomEngine {
public:
    RandomEngine();

    int uniformInt(int min, int max);
    bool rollPercent(int chancePercent);

private:
    std::mt19937 rng_;
};

/// CPU-Entlastung: 1-3 ms Pause in Hintergrund-Schleifen.
void cpuRelief(RandomEngine& rng, int minMs = 1, int maxMs = 3);

inline std::chrono::steady_clock::time_point now() {
    return std::chrono::steady_clock::now();
}

inline long long elapsedMs(const std::chrono::steady_clock::time_point& since) {
    return std::chrono::duration_cast<std::chrono::milliseconds>(now() - since).count();
}

inline long long elapsedUs(const std::chrono::steady_clock::time_point& since) {
    return std::chrono::duration_cast<std::chrono::microseconds>(now() - since).count();
}

}  // namespace macro
