#pragma once

#include <chrono>
#include <random>
#include <thread>

namespace macro {

/// Zentraler Zufallsgenerator fuer menschlich wirkende Verzoegerungen.
class RandomEngine {
public:
    RandomEngine();

    /// Gleichverteilte Ganzzahl im Intervall [min, max] (inklusive).
    int uniformInt(int min, int max);

    /// Gleichverteilte Wahrscheinlichkeit: true mit chancePercent (0-100).
    bool rollPercent(int chancePercent);

private:
    std::mt19937 rng_;
};

/// Kurze CPU-Pause fuer Hintergrund-Schleifen (Standard: 2-5 ms).
void cpuRelief(RandomEngine& rng, int minMs = 2, int maxMs = 5);

/// Aktuelle Zeitpunkt via steady_clock (monoton, nicht systemabhaengig).
inline std::chrono::steady_clock::time_point now() {
    return std::chrono::steady_clock::now();
}

/// Millisekunden seit einem Referenzzeitpunkt.
inline long long elapsedMs(const std::chrono::steady_clock::time_point& since) {
    return std::chrono::duration_cast<std::chrono::milliseconds>(now() - since).count();
}

}  // namespace macro
