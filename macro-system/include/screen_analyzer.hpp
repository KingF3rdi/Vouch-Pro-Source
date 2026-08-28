#pragma once

#include <array>
#include <cstdint>
#include <vector>

namespace macro {

/// Bildschirmanalyse via GDI-Bitgrabbing und Histogramm-Vergleich.
class ScreenAnalyzer {
public:
    static constexpr int kCaptureSize = 50;
    static constexpr int kHistogramBins = 32;

    ScreenAnalyzer();

    /// Erfasst Bildschirmmitte und prueft auf signifikante Kontrast-/Helligkeitsaenderung.
    bool verifyScreenState();

    /// Schwellwert fuer Histogramm-Abweichung (0.0 - 1.0, Standard: 0.18).
    void setChangeThreshold(float threshold);

private:
    struct LuminanceStats {
        float mean{0.0f};
        float stdDev{0.0f};
        std::array<float, kHistogramBins> histogram{};
    };

    bool captureCenterRegion(std::vector<std::uint8_t>& bgraPixels);
    LuminanceStats computeStats(const std::vector<std::uint8_t>& bgraPixels) const;
    float histogramDistance(const std::array<float, kHistogramBins>& a,
                            const std::array<float, kHistogramBins>& b) const;
    void updateBaseline(const LuminanceStats& stats);

    bool baselineReady_{false};
    float changeThreshold_{0.18f};
    LuminanceStats baseline_{};
    LuminanceStats previous_{};
    bool hasPrevious_{false};
};

}  // namespace macro
