#include "fall_detector.hpp"

#include <algorithm>
#include <cmath>
#include <windows.h>

namespace macro {

FallDetector::FallDetector(FallDetectorConfig config) : config_(config) {}

void FallDetector::setConfig(const FallDetectorConfig& config) { config_ = config; }

bool FallDetector::captureMotionRegion(std::vector<std::uint8_t>& bgraPixels) const {
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

FallDetector::Grid FallDetector::buildContrastGrid(const std::vector<std::uint8_t>& pixels) const {
    Grid grid{};
    const int cellW = kRegionWidth / kGridCols;
    const int cellH = kRegionHeight / kGridRows;

    auto lumAt = [&](int x, int y) {
        const std::size_t idx = (static_cast<std::size_t>(y) * kRegionWidth + x) * 4;
        const float r = pixels[idx + 2];
        const float g = pixels[idx + 1];
        const float b = pixels[idx + 0];
        return 0.299f * r + 0.587f * g + 0.114f * b;
    };

    for (int gy = 0; gy < kGridRows; ++gy) {
        for (int gx = 0; gx < kGridCols; ++gx) {
            float edgeSum = 0.0f;
            int count = 0;
            const int startX = gx * cellW;
            const int startY = gy * cellH;

            for (int y = startY + 1; y < startY + cellH - 1 && y < kRegionHeight - 1; ++y) {
                for (int x = startX + 1; x < startX + cellW - 1 && x < kRegionWidth - 1; ++x) {
                    const float lum = lumAt(x, y);
                    const float grad = std::abs(lum - lumAt(x, y - 1)) + std::abs(lum - lumAt(x - 1, y));
                    edgeSum += grad;
                    ++count;
                }
            }
            grid[gy][gx] = count > 0 ? edgeSum / static_cast<float>(count) : 0.0f;
        }
    }
    return grid;
}

float FallDetector::estimateUpwardShiftRows(const Grid& previous, const Grid& current) const {
    // Mathematische Bewegungsberechnung: Zeilen-Korrelation fuer vertikalen Shift
    float bestShift = 0.0f;
    float bestScore = -1.0f;

    for (int shift = 1; shift <= 4; ++shift) {
        float correlation = 0.0f;
        int pairs = 0;
        for (int row = shift; row < kGridRows; ++row) {
            for (int col = 0; col < kGridCols; ++col) {
                correlation += previous[row - shift][col] * current[row][col];
                ++pairs;
            }
        }
        if (pairs > 0) {
            correlation /= static_cast<float>(pairs);
            if (correlation > bestScore) {
                bestScore = correlation;
                bestShift = static_cast<float>(shift);
            }
        }
    }
    return bestShift;
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

    const Grid currentGrid = buildContrastGrid(pixels);

    if (hasPreviousGrid_) {
        const float upwardRows = estimateUpwardShiftRows(previousGrid_, currentGrid);
        const float deltaSeconds = static_cast<float>(config_.motionSampleIntervalMs) / 1000.0f;
        const float cellHeightPx = static_cast<float>(kRegionHeight) / static_cast<float>(kGridRows);
        const float upwardVelocity = (upwardRows * cellHeightPx) / deltaSeconds;

        if (upwardVelocity >= config_.upwardVelocityThreshold && upwardRows >= 1.0f) {
            sustainedUpwardMs_ += config_.motionSampleIntervalMs;
        } else {
            sustainedUpwardMs_ = std::max(0, sustainedUpwardMs_ - config_.motionSampleIntervalMs * 2);
        }
    }

    inFreeFall_ = sustainedUpwardMs_ >= config_.fallDetectionWindowMs;
    previousGrid_ = currentGrid;
    hasPreviousGrid_ = true;
}

bool FallDetector::isInFreeFall() const { return inFreeFall_; }

}  // namespace macro
