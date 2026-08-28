#include "screen_analyzer.hpp"

#include <algorithm>
#include <cmath>
#include <windows.h>

namespace macro {

ScreenAnalyzer::ScreenAnalyzer() = default;

void ScreenAnalyzer::setChangeThreshold(float threshold) {
    changeThreshold_ = std::clamp(threshold, 0.01f, 1.0f);
}

bool ScreenAnalyzer::captureCenterRegion(std::vector<std::uint8_t>& bgraPixels) {
    // --- GDI Bitgrabbing: Bildschirmmitte erfassen ---
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int originX = (screenWidth - kCaptureSize) / 2;
    const int originY = (screenHeight - kCaptureSize) / 2;

    HDC screenDc = GetDC(nullptr);
    if (!screenDc) {
        return false;
    }

    HDC memoryDc = CreateCompatibleDC(screenDc);
    if (!memoryDc) {
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HBITMAP bitmap = CreateCompatibleBitmap(screenDc, kCaptureSize, kCaptureSize);
    if (!bitmap) {
        DeleteDC(memoryDc);
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HGDIOBJ oldBitmap = SelectObject(memoryDc, bitmap);

    // BitBlt kopiert den definierten Bereich in den kompatiblen DC
    const BOOL bltOk = BitBlt(memoryDc, 0, 0, kCaptureSize, kCaptureSize, screenDc, originX,
                              originY, SRCCOPY);

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = kCaptureSize;
    bmi.bmiHeader.biHeight = -kCaptureSize;  // top-down DIB
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    bgraPixels.resize(static_cast<std::size_t>(kCaptureSize) * kCaptureSize * 4);

    const int lines = GetDIBits(memoryDc, bitmap, 0, kCaptureSize, bgraPixels.data(), &bmi,
                                DIB_RGB_COLORS);

    SelectObject(memoryDc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(memoryDc);
    ReleaseDC(nullptr, screenDc);

    return bltOk && lines == kCaptureSize;
}

ScreenAnalyzer::LuminanceStats ScreenAnalyzer::computeStats(
    const std::vector<std::uint8_t>& bgraPixels) const {
    LuminanceStats stats{};
    const std::size_t pixelCount = bgraPixels.size() / 4;
    if (pixelCount == 0) {
        return stats;
    }

    std::array<int, kHistogramBins> rawHist{};
    float sum = 0.0f;

    for (std::size_t i = 0; i < pixelCount; ++i) {
        const std::uint8_t b = bgraPixels[i * 4 + 0];
        const std::uint8_t g = bgraPixels[i * 4 + 1];
        const std::uint8_t r = bgraPixels[i * 4 + 2];

        // Relative Helligkeit unabhaengig vom Texturepack (ITU-R BT.601)
        const float luminance = 0.299f * r + 0.587f * g + 0.114f * b;
        sum += luminance;

        const int bin = std::min(kHistogramBins - 1,
                                 static_cast<int>(luminance / 256.0f * kHistogramBins));
        ++rawHist[bin];
    }

    stats.mean = sum / static_cast<float>(pixelCount);

    float varianceSum = 0.0f;
    for (std::size_t i = 0; i < pixelCount; ++i) {
        const std::uint8_t b = bgraPixels[i * 4 + 0];
        const std::uint8_t g = bgraPixels[i * 4 + 1];
        const std::uint8_t r = bgraPixels[i * 4 + 2];
        const float luminance = 0.299f * r + 0.587f * g + 0.114f * b;
        const float diff = luminance - stats.mean;
        varianceSum += diff * diff;
    }

    stats.stdDev = std::sqrt(varianceSum / static_cast<float>(pixelCount));

    // Normalisiertes Histogramm fuer texturunabhaengigen Vergleich
    for (int i = 0; i < kHistogramBins; ++i) {
        stats.histogram[i] = static_cast<float>(rawHist[i]) / static_cast<float>(pixelCount);
    }

    return stats;
}

float ScreenAnalyzer::histogramDistance(const std::array<float, kHistogramBins>& a,
                                        const std::array<float, kHistogramBins>& b) const {
    float distance = 0.0f;
    for (int i = 0; i < kHistogramBins; ++i) {
        distance += std::abs(a[i] - b[i]);
    }
    return distance * 0.5f;  // L1-Distanz normalisiert auf [0, 1]
}

void ScreenAnalyzer::updateBaseline(const LuminanceStats& stats) {
    if (!baselineReady_) {
        baseline_ = stats;
        baselineReady_ = true;
        return;
    }

    // Exponentieller gleitender Mittelwert: Baseline passt sich langsam an stabile Szenen an
    constexpr float alpha = 0.05f;
    baseline_.mean = baseline_.mean * (1.0f - alpha) + stats.mean * alpha;
    baseline_.stdDev = baseline_.stdDev * (1.0f - alpha) + stats.stdDev * alpha;

    for (int i = 0; i < kHistogramBins; ++i) {
        baseline_.histogram[i] =
            baseline_.histogram[i] * (1.0f - alpha) + stats.histogram[i] * alpha;
    }
}

bool ScreenAnalyzer::verifyScreenState() {
    std::vector<std::uint8_t> pixels;
    if (!captureCenterRegion(pixels)) {
        return false;
    }

    const LuminanceStats current = computeStats(pixels);

    if (!baselineReady_) {
        updateBaseline(current);
        previous_ = current;
        hasPrevious_ = true;
        return false;
    }

    // Histogramm-Abweichung: blockierendes Objekt veraendert Helligkeitsverteilung
    const float histDelta = histogramDistance(current.histogram, baseline_.histogram);

    // Kontrast-Aenderung: Standardabweichung der Luminanz (relativ zur Baseline)
    const float contrastDelta =
        std::abs(current.stdDev - baseline_.stdDev) / std::max(baseline_.stdDev, 1.0f);

    // Frame-zu-Frame-Sprung erkennt ploetzliches Auftreten eines Schilds
    float frameJump = 0.0f;
    if (hasPrevious_) {
        frameJump = histogramDistance(current.histogram, previous_.histogram);
    }

    previous_ = current;
    hasPrevious_ = true;

    const bool significantChange =
        histDelta >= changeThreshold_ || contrastDelta >= changeThreshold_ ||
        frameJump >= changeThreshold_ * 1.2f;

    if (!significantChange) {
        updateBaseline(current);
    }

    return significantChange;
}

}  // namespace macro
