#include "fall_detector.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>
#include <windows.h>

namespace macro {

FallDetector::FallDetector(FallDetectorConfig config) : config_(config) {}

void FallDetector::setConfig(const FallDetectorConfig& config) { config_ = config; }

FallDetectorConfig FallDetector::config() const { return config_; }

bool FallDetector::captureMotionRegion(std::vector<std::uint8_t>& bgraPixels) const {
    // --- GDI Bitgrabbing: mittlerer Bildschirmbereich fuer Bewegungserkennung ---
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int originX = (screenWidth - kRegionWidth) / 2;
    const int originY = (screenHeight - kRegionHeight) / 2;

    HDC screenDc = GetDC(nullptr);
    if (!screenDc) {
        return false;
    }

    HDC memoryDc = CreateCompatibleDC(screenDc);
    if (!memoryDc) {
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HBITMAP bitmap = CreateCompatibleBitmap(screenDc, kRegionWidth, kRegionHeight);
    if (!bitmap) {
        DeleteDC(memoryDc);
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HGDIOBJ oldBitmap = SelectObject(memoryDc, bitmap);
    const BOOL bltOk =
        BitBlt(memoryDc, 0, 0, kRegionWidth, kRegionHeight, screenDc, originX, originY, SRCCOPY);

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = kRegionWidth;
    bmi.bmiHeader.biHeight = -kRegionHeight;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    bgraPixels.resize(static_cast<std::size_t>(kRegionWidth) * kRegionHeight * 4);
    const int lines =
        GetDIBits(memoryDc, bitmap, 0, kRegionHeight, bgraPixels.data(), &bmi, DIB_RGB_COLORS);

    SelectObject(memoryDc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(memoryDc);
    ReleaseDC(nullptr, screenDc);

    return bltOk && lines == kRegionHeight;
}

float FallDetector::computeSalientCenterY(const std::vector<std::uint8_t>& bgraPixels) const {
    const int width = kRegionWidth;
    const int height = kRegionHeight;

    auto luminanceAt = [&](int x, int y) -> float {
        const std::size_t idx = (static_cast<std::size_t>(y) * width + x) * 4;
        const float b = bgraPixels[idx + 0];
        const float g = bgraPixels[idx + 1];
        const float r = bgraPixels[idx + 2];
        return 0.299f * r + 0.587f * g + 0.114f * b;
    };

    float gradientSum = 0.0f;
    int gradientCount = 0;

    // Erste Pass: mittlere Kantenstaerke bestimmen (markante Pixelstrukturen)
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(x, y);
            const float gradX = std::abs(lum - luminanceAt(x - 1, y));
            const float gradY = std::abs(lum - luminanceAt(x, y - 1));
            gradientSum += gradX + gradY;
            ++gradientCount;
        }
    }

    if (gradientCount == 0) {
        return static_cast<float>(height) * 0.5f;
    }

    const float meanGradient = gradientSum / static_cast<float>(gradientCount);
    const float salientThreshold = meanGradient * 1.35f + 4.0f;

    float weightedY = 0.0f;
    float weightSum = 0.0f;

    // Zweite Pass: Y-Koordinaten markanter Strukturen gewichten
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(x, y);
            const float gradX = std::abs(lum - luminanceAt(x - 1, y));
            const float gradY = std::abs(lum - luminanceAt(x, y - 1));
            const float gradient = gradX + gradY;

            if (gradient >= salientThreshold) {
                weightedY += static_cast<float>(y) * gradient;
                weightSum += gradient;
            }
        }
    }

    if (weightSum <= 0.0f) {
        return static_cast<float>(height) * 0.5f;
    }

    return weightedY / weightSum;
}

void FallDetector::pruneOldSamples(long long nowMs) {
    const long long window = config_.fallDetectionWindowMs;
    while (!samples_.empty() && nowMs - samples_.front().timestampMs > window) {
        samples_.pop_front();
    }
}

void FallDetector::update() {
    if (elapsedMs(lastSampleTime_) < config_.motionSampleIntervalMs) {
        return;
    }

    lastSampleTime_ = now();

    std::vector<std::uint8_t> pixels;
    if (!captureMotionRegion(pixels)) {
        return;
    }

    const float centerY = computeSalientCenterY(pixels);
    const long long timestampMs =
        std::chrono::duration_cast<std::chrono::milliseconds>(now().time_since_epoch()).count();

    samples_.push_back({timestampMs, centerY});
    pruneOldSamples(timestampMs);

    if (hasLastSample_) {
        const float deltaY = centerY - lastSalientCenterY_;
        const float deltaSeconds =
            static_cast<float>(config_.motionSampleIntervalMs) / 1000.0f;

        // Negative deltaY: Strukturen wandern nach oben (Fall-Indikator)
        const float upwardVelocity = -deltaY / deltaSeconds;

        if (upwardVelocity >= config_.upwardVelocityThreshold && deltaY < -0.35f) {
            sustainedUpwardMs_ += config_.motionSampleIntervalMs;
        } else {
            sustainedUpwardMs_ =
                std::max(0, sustainedUpwardMs_ - config_.motionSampleIntervalMs * 2);
        }
    }

    // Kontinuierliche Aufwaertsbewegung ueber Zeitraum X
    isFalling_ = sustainedUpwardMs_ >= config_.fallDetectionWindowMs;

    lastSalientCenterY_ = centerY;
    hasLastSample_ = true;
}

bool FallDetector::isFalling() const { return isFalling_; }

}  // namespace macro
