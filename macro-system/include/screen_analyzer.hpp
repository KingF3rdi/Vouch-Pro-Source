#pragma once

#include <array>
#include <cstdint>
#include <vector>

namespace macro {

/// Externe Bildschirmanalyse via GDI – kein Memory Reading.
class ScreenAnalyzer {
public:
    static constexpr int kShieldCaptureSize = 56;
    static constexpr int kCrosshairWidth = 88;
    static constexpr int kCrosshairHeight = 64;
    static constexpr int kMatrixSize = 8;
    static constexpr int kHistogramBins = 32;

    ScreenAnalyzer();

    /// Schild-Erkennung: relative Helligkeitsmatrix mit Block-Form im Zentrum.
    bool isShieldRaised();

    /// Gegner in Nahkampf-Reichweite: Namensband, Ruestung oder roter Damage-Tick.
    bool isEnemyInCrosshairRange();

    /// Chat geoeffnet (Eingabezeile unten sichtbar).
    bool isChatOpen();

    /// Inventar geoeffnet (Slot-Gitter in der Bildschirmmitte).
    bool isInventoryOpen();

    void setShieldThreshold(float threshold);
    void setEnemyThreshold(float threshold);

private:
    struct LuminanceStats {
        float mean{0.0f};
        float stdDev{0.0f};
        std::array<float, kHistogramBins> histogram{};
    };

    bool captureScreenRegion(int originX, int originY, int width, int height,
                             std::vector<std::uint8_t>& bgraPixels) const;
    bool captureCenterRegion(int size, std::vector<std::uint8_t>& bgraPixels) const;
    bool captureCrosshairRegion(std::vector<std::uint8_t>& bgraPixels) const;

    float luminanceAt(const std::vector<std::uint8_t>& pixels, int width, int x, int y) const;
    std::array<std::array<float, kMatrixSize>, kMatrixSize> buildBrightnessMatrix(
        const std::vector<std::uint8_t>& pixels, int width, int height) const;

    LuminanceStats computeStats(const std::vector<std::uint8_t>& bgraPixels) const;
    float histogramDistance(const std::array<float, kHistogramBins>& a,
                            const std::array<float, kHistogramBins>& b) const;

    float detectShieldBlockScore(const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const;
    float detectRedDamageScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectNameTagScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectArmorContrastScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectInventoryGridScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;
    float detectChatBarScore(const std::vector<std::uint8_t>& pixels, int width, int height) const;

    float shieldThreshold_{0.42f};
    float enemyThreshold_{0.35f};
};

}  // namespace macro
