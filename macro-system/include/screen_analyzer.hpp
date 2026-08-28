#pragma once

#include <array>
#include <chrono>
#include <cstdint>
#include <deque>
#include <vector>

namespace macro {

/// Externe Bildschirmanalyse via GDI – kein Memory Reading.
class ScreenAnalyzer {
public:
    static constexpr int kShieldCaptureSize = 56;
    static constexpr int kCrosshairWidth = 96;
    static constexpr int kCrosshairHeight = 72;
    static constexpr int kMatrixSize = 10;
    static constexpr int kHistogramBins = 32;
    static constexpr int kGroundShieldWidth = 112;
    static constexpr int kGroundShieldHeight = 84;
    static constexpr int kShieldHistorySize = 6;

    ScreenAnalyzer();

    void tickShieldDetection();

    bool isShieldRaised();
    bool isEnemyShieldInRange();
    bool isShieldOnGround();
    bool isEnemyInCrosshairRange();
    bool isChatOpen();
    bool isInventoryOpen();

    float lastEnemyShieldConfidence() const;
    float lastGroundShieldConfidence() const;

    void setShieldThreshold(float threshold);
    void setEnemyThreshold(float threshold);
    void setGroundShieldThreshold(float threshold);

private:
    struct LuminanceStats {
        float mean{0.0f};
        float stdDev{0.0f};
        float entropy{0.0f};
        std::array<float, kHistogramBins> histogram{};
    };

    struct ShieldTracker {
        std::deque<bool> enemyFrames{};
        std::deque<bool> groundFrames{};
        std::chrono::steady_clock::time_point enemyStickyUntil{};
        std::chrono::steady_clock::time_point groundStickyUntil{};
        LuminanceStats crosshairBaseline{};
        LuminanceStats groundBaseline{};
        bool crosshairBaselineReady{false};
        bool groundBaselineReady{false};
        long long lastTickMs{0};
        float enemyConfidence{0.0f};
        float groundConfidence{0.0f};
        bool enemyLatched{false};
        bool groundLatched{false};
    };

    bool captureScreenRegion(int originX, int originY, int width, int height,
                             std::vector<std::uint8_t>& bgraPixels) const;
    bool captureCenterRegion(int size, std::vector<std::uint8_t>& bgraPixels) const;
    bool captureCrosshairRegion(std::vector<std::uint8_t>& bgraPixels) const;
    bool captureGroundShieldRegion(std::vector<std::uint8_t>& bgraPixels) const;

    float luminanceAt(const std::vector<std::uint8_t>& pixels, int width, int x, int y) const;
    std::array<std::array<float, kMatrixSize>, kMatrixSize> buildBrightnessMatrix(
        const std::vector<std::uint8_t>& pixels, int width, int height) const;

    LuminanceStats computeStats(const std::vector<std::uint8_t>& bgraPixels) const;
    float histogramDistance(const std::array<float, kHistogramBins>& a,
                            const std::array<float, kHistogramBins>& b) const;

    float detectShieldBlockScore(
        const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const;
    float detectVerticalShieldEdgeScore(
        const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const;
    float detectCenterFlatnessScore(const std::vector<std::uint8_t>& pixels, int width,
                                  int height) const;
    float detectLowEntropyScore(const LuminanceStats& stats) const;
    float detectBaselineShiftScore(const LuminanceStats& current,
                                   const LuminanceStats& baseline, bool ready) const;
    float detectSalientBlobScore(const std::vector<std::uint8_t>& pixels, int width,
                                 int height) const;
    float detectRectangularBoundaryScore(const std::vector<std::uint8_t>& pixels, int width,
                                         int height) const;

    float fuseEnemyShieldScore(const std::vector<std::uint8_t>& pixels, int width, int height);
    float fuseGroundShieldScore(const std::vector<std::uint8_t>& pixels, int width, int height);

    void pushHistory(std::deque<bool>& history, bool value);
    bool latchFromHistory(const std::deque<bool>& history,
                          std::chrono::steady_clock::time_point& stickyUntil, float confidence,
                          float threshold) const;
    void updateBaseline(LuminanceStats& baseline, bool& ready, const LuminanceStats& current,
                        float activityScore);

    float detectRedDamageScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectNameTagScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectArmorContrastScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectInventoryGridScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectChatBarScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;

    ShieldTracker shield_;
    float shieldThreshold_{0.10f};
    float enemyThreshold_{0.35f};
    float groundShieldThreshold_{0.10f};
};

}  // namespace macro
