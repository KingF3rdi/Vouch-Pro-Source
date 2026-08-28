#pragma once

#include "common.hpp"

#include <atomic>
#include <cstdint>
#include <deque>
#include <vector>

namespace macro {

/// Konfiguration fuer die externe Fallhoehen-Erkennung via Bewegungserkennung.
struct FallDetectorConfig {
    int motionSampleIntervalMs{15};
    int fallDetectionWindowMs{300};
    float upwardVelocityThreshold{28.0f};
};

/// Erkennt anhaltende Aufwaertsbewegung markanter Pixelstrukturen (Indikator fuer Fall).
class FallDetector {
public:
    static constexpr int kRegionWidth = 72;
    static constexpr int kRegionHeight = 110;

    explicit FallDetector(FallDetectorConfig config = {});

    void setConfig(const FallDetectorConfig& config);
    FallDetectorConfig config() const;

    /// Aktualisiert die Bewegungserkennung (intern auf motionSampleIntervalMs gedrosselt).
    void update();

    bool isFalling() const;

private:
    struct MotionSample {
        long long timestampMs{0};
        float salientCenterY{0.0f};
    };

    bool captureMotionRegion(std::vector<std::uint8_t>& bgraPixels) const;
    float computeSalientCenterY(const std::vector<std::uint8_t>& bgraPixels) const;
    void pruneOldSamples(long long nowMs);

    FallDetectorConfig config_;
    std::deque<MotionSample> samples_;
    std::chrono::steady_clock::time_point lastSampleTime_{};
    bool hasLastSample_{false};
    float lastSalientCenterY_{0.0f};
    int sustainedUpwardMs_{0};

    std::atomic<bool> isFalling_{false};
};

}  // namespace macro
