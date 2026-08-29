#pragma once

#include "common.hpp"

#include <array>
#include <atomic>
#include <cstdint>
#include <vector>

namespace macro {

struct FallDetectorConfig {
    int motionSampleIntervalMs{8};
    int fallDetectionWindowMs{180};
    float upwardVelocityThreshold{28.0f};
};

/// Rasterbasierte Bewegungserkennung: vertikale Kontrastverschiebung nach oben.
class FallDetector {
public:
    static constexpr int kGridCols = 10;
    static constexpr int kGridRows = 14;
    static constexpr int kRegionWidth = 70;
    static constexpr int kRegionHeight = 98;

    explicit FallDetector(FallDetectorConfig config = {});

    void setConfig(const FallDetectorConfig& config);
    void update();
    bool isInFreeFall() const;

private:
    using Grid = std::array<std::array<float, kGridCols>, kGridRows>;

    bool captureMotionRegion(std::vector<std::uint8_t>& bgraPixels) const;
    Grid buildContrastGrid(const std::vector<std::uint8_t>& pixels) const;
    float estimateUpwardShiftRows(const Grid& previous, const Grid& current) const;

    FallDetectorConfig config_;
    Grid previousGrid_{};
    bool hasPreviousGrid_{false};
    std::chrono::steady_clock::time_point lastSampleTime_{};
    int sustainedUpwardMs_{0};
    std::atomic<bool> inFreeFall_{false};
};

}  // namespace macro
