#include "screen_analyzer.hpp"

#include "common.hpp"

#include <algorithm>
#include <cmath>
#include <windows.h>

namespace macro {

namespace {

constexpr int kEnemyStickyMs = 320;
constexpr int kGroundStickyMs = 280;

}  // namespace

ScreenAnalyzer::ScreenAnalyzer() = default;

void ScreenAnalyzer::setShieldThreshold(float threshold) {
    shieldThreshold_ = std::clamp(threshold, 0.02f, 1.0f);
}

void ScreenAnalyzer::setEnemyThreshold(float threshold) {
    enemyThreshold_ = std::clamp(threshold, 0.05f, 1.0f);
}

void ScreenAnalyzer::setGroundShieldThreshold(float threshold) {
    groundShieldThreshold_ = std::clamp(threshold, 0.02f, 1.0f);
}

float ScreenAnalyzer::lastEnemyShieldConfidence() const { return shield_.enemyConfidence; }

float ScreenAnalyzer::lastGroundShieldConfidence() const { return shield_.groundConfidence; }

bool ScreenAnalyzer::captureScreenRegion(int originX, int originY, int width, int height,
                                         std::vector<std::uint8_t>& bgraPixels) const {
    HDC screenDc = GetDC(nullptr);
    if (!screenDc) {
        return false;
    }

    HDC memoryDc = CreateCompatibleDC(screenDc);
    if (!memoryDc) {
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HBITMAP bitmap = CreateCompatibleBitmap(screenDc, width, height);
    if (!bitmap) {
        DeleteDC(memoryDc);
        ReleaseDC(nullptr, screenDc);
        return false;
    }

    HGDIOBJ oldBitmap = SelectObject(memoryDc, bitmap);
    const BOOL bltOk = BitBlt(memoryDc, 0, 0, width, height, screenDc, originX, originY, SRCCOPY);

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = width;
    bmi.bmiHeader.biHeight = -height;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    bgraPixels.resize(static_cast<std::size_t>(width) * height * 4);
    const int lines = GetDIBits(memoryDc, bitmap, 0, height, bgraPixels.data(), &bmi, DIB_RGB_COLORS);

    SelectObject(memoryDc, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(memoryDc);
    ReleaseDC(nullptr, screenDc);

    return bltOk && lines == height;
}

bool ScreenAnalyzer::captureCenterRegion(int size, std::vector<std::uint8_t>& bgraPixels) const {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    return captureScreenRegion((screenWidth - size) / 2, (screenHeight - size) / 2, size, size,
                               bgraPixels);
}

bool ScreenAnalyzer::captureCrosshairRegion(std::vector<std::uint8_t>& bgraPixels) const {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    return captureScreenRegion((screenWidth - kCrosshairWidth) / 2,
                               (screenHeight - kCrosshairHeight) / 2, kCrosshairWidth,
                               kCrosshairHeight, bgraPixels);
}

bool ScreenAnalyzer::captureGroundShieldRegion(std::vector<std::uint8_t>& bgraPixels) const {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int originX = (screenWidth - kGroundShieldWidth) / 2;
    const int originY = (screenHeight / 2) + (screenHeight / 12);
    return captureScreenRegion(originX, originY, kGroundShieldWidth, kGroundShieldHeight, bgraPixels);
}

float ScreenAnalyzer::luminanceAt(const std::vector<std::uint8_t>& pixels, int width, int x,
                                  int y) const {
    const std::size_t idx = (static_cast<std::size_t>(y) * width + x) * 4;
    const float b = pixels[idx + 0];
    const float g = pixels[idx + 1];
    const float r = pixels[idx + 2];
    return 0.299f * r + 0.587f * g + 0.114f * b;
}

std::array<std::array<float, ScreenAnalyzer::kMatrixSize>, ScreenAnalyzer::kMatrixSize>
ScreenAnalyzer::buildBrightnessMatrix(const std::vector<std::uint8_t>& pixels, int width,
                                      int height) const {
    std::array<std::array<float, kMatrixSize>, kMatrixSize> matrix{};
    const int cellW = std::max(1, width / kMatrixSize);
    const int cellH = std::max(1, height / kMatrixSize);

    for (int my = 0; my < kMatrixSize; ++my) {
        for (int mx = 0; mx < kMatrixSize; ++mx) {
            float sum = 0.0f;
            int count = 0;
            const int startX = mx * cellW;
            const int startY = my * cellH;
            for (int y = startY; y < startY + cellH && y < height; ++y) {
                for (int x = startX; x < startX + cellW && x < width; ++x) {
                    sum += luminanceAt(pixels, width, x, y);
                    ++count;
                }
            }
            matrix[my][mx] = count > 0 ? sum / static_cast<float>(count) : 0.0f;
        }
    }
    return matrix;
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
        const float lum = 0.299f * bgraPixels[i * 4 + 2] + 0.587f * bgraPixels[i * 4 + 1] +
                          0.114f * bgraPixels[i * 4 + 0];
        sum += lum;
        const int bin =
            std::min(kHistogramBins - 1, static_cast<int>(lum / 256.0f * kHistogramBins));
        ++rawHist[bin];
    }

    stats.mean = sum / static_cast<float>(pixelCount);

    float varianceSum = 0.0f;
    for (std::size_t i = 0; i < pixelCount; ++i) {
        const float lum = 0.299f * bgraPixels[i * 4 + 2] + 0.587f * bgraPixels[i * 4 + 1] +
                          0.114f * bgraPixels[i * 4 + 0];
        const float diff = lum - stats.mean;
        varianceSum += diff * diff;
    }
    stats.stdDev = std::sqrt(varianceSum / static_cast<float>(pixelCount));

    float entropy = 0.0f;
    for (int i = 0; i < kHistogramBins; ++i) {
        stats.histogram[i] = static_cast<float>(rawHist[i]) / static_cast<float>(pixelCount);
        if (stats.histogram[i] > 0.0001f) {
            entropy -= stats.histogram[i] * std::log(stats.histogram[i]);
        }
    }
    stats.entropy = entropy;

    return stats;
}

float ScreenAnalyzer::histogramDistance(const std::array<float, kHistogramBins>& a,
                                      const std::array<float, kHistogramBins>& b) const {
    float distance = 0.0f;
    for (int i = 0; i < kHistogramBins; ++i) {
        distance += std::abs(a[i] - b[i]);
    }
    return distance * 0.5f;
}

float ScreenAnalyzer::detectShieldBlockScore(
    const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const {
    float centerSum = 0.0f;
    float edgeSum = 0.0f;
    int centerCount = 0;
    int edgeCount = 0;

    const int c0 = kMatrixSize / 2 - 2;
    const int c1 = kMatrixSize / 2 + 1;

    for (int y = 0; y < kMatrixSize; ++y) {
        for (int x = 0; x < kMatrixSize; ++x) {
            const bool isCenter = x >= c0 && x <= c1 && y >= c0 && y <= c1;
            if (isCenter) {
                centerSum += matrix[y][x];
                ++centerCount;
            } else {
                edgeSum += matrix[y][x];
                ++edgeCount;
            }
        }
    }

    if (centerCount == 0 || edgeCount == 0) {
        return 0.0f;
    }

    const float centerMean = centerSum / static_cast<float>(centerCount);
    const float edgeMean = edgeSum / static_cast<float>(edgeCount);

    float centerVariance = 0.0f;
    for (int y = c0; y <= c1; ++y) {
        for (int x = c0; x <= c1; ++x) {
            const float diff = matrix[y][x] - centerMean;
            centerVariance += diff * diff;
        }
    }
    centerVariance /= static_cast<float>(centerCount);

    const float homogeneity = 1.0f / (1.0f + centerVariance / 80.0f);
    const float edgeContrast = std::abs(edgeMean - centerMean) / 96.0f;
    return std::clamp(homogeneity * 0.5f + edgeContrast * 0.5f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectVerticalShieldEdgeScore(
    const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const {
    float leftEdge = 0.0f;
    float rightEdge = 0.0f;
    const int leftCol = kMatrixSize / 2 - 3;
    const int rightCol = kMatrixSize / 2 + 2;

    for (int y = 1; y < kMatrixSize - 1; ++y) {
        if (leftCol >= 1) {
            leftEdge += std::abs(matrix[y][leftCol] - matrix[y][leftCol - 1]);
            leftEdge += std::abs(matrix[y][leftCol] - matrix[y - 1][leftCol]);
        }
        if (rightCol < kMatrixSize - 1) {
            rightEdge += std::abs(matrix[y][rightCol] - matrix[y][rightCol + 1]);
            rightEdge += std::abs(matrix[y][rightCol] - matrix[y - 1][rightCol]);
        }
    }

    const float avgEdge = (leftEdge + rightEdge) / static_cast<float>((kMatrixSize - 2) * 4);
    return std::clamp(avgEdge / 28.0f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectCenterFlatnessScore(const std::vector<std::uint8_t>& pixels, int width,
                                                int height) const {
    float centerVar = 0.0f;
    float outerVar = 0.0f;
    int centerCount = 0;
    int outerCount = 0;

    const int x0 = width / 4;
    const int x1 = width * 3 / 4;
    const int y0 = height / 4;
    const int y1 = height * 3 / 4;

    float centerMean = 0.0f;
    float outerMean = 0.0f;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            const bool inCenter = x >= x0 && x <= x1 && y >= y0 && y <= y1;
            if (inCenter) {
                centerMean += lum;
                ++centerCount;
            } else {
                outerMean += lum;
                ++outerCount;
            }
        }
    }

    if (centerCount == 0 || outerCount == 0) {
        return 0.0f;
    }

    centerMean /= static_cast<float>(centerCount);
    outerMean /= static_cast<float>(outerCount);

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            const bool inCenter = x >= x0 && x <= x1 && y >= y0 && y <= y1;
            const float diff = lum - (inCenter ? centerMean : outerMean);
            if (inCenter) {
                centerVar += diff * diff;
            } else {
                outerVar += diff * diff;
            }
        }
    }

    centerVar /= static_cast<float>(centerCount);
    outerVar /= static_cast<float>(outerCount);
    const float ratio = outerVar / std::max(centerVar, 1.0f);
    return std::clamp(ratio / 6.0f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectLowEntropyScore(const LuminanceStats& stats) const {
    constexpr float maxEntropy = 3.5f;
    return std::clamp(1.0f - stats.entropy / maxEntropy, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectBaselineShiftScore(const LuminanceStats& current,
                                             const LuminanceStats& baseline, bool ready) const {
    if (!ready) {
        return 0.0f;
    }

    const float histShift = histogramDistance(current.histogram, baseline.histogram);
    const float meanShift = std::abs(current.mean - baseline.mean) / 96.0f;
    const float stdShift = std::abs(current.stdDev - baseline.stdDev) / 48.0f;
    return std::clamp(histShift * 0.55f + meanShift * 0.30f + stdShift * 0.15f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectRectangularBoundaryScore(const std::vector<std::uint8_t>& pixels,
                                                     int width, int height) const {
    float topEdge = 0.0f;
    float bottomEdge = 0.0f;
    float leftEdge = 0.0f;
    float rightEdge = 0.0f;
    const int midX = width / 2;
    const int midY = height / 2;

    for (int x = 2; x < width - 2; ++x) {
        topEdge += std::abs(luminanceAt(pixels, width, x, midY - 8) -
                            luminanceAt(pixels, width, x, midY - 9));
        bottomEdge += std::abs(luminanceAt(pixels, width, x, midY + 8) -
                               luminanceAt(pixels, width, x, midY + 9));
    }
    for (int y = 2; y < height - 2; ++y) {
        leftEdge += std::abs(luminanceAt(pixels, width, midX - 10, y) -
                             luminanceAt(pixels, width, midX - 11, y));
        rightEdge += std::abs(luminanceAt(pixels, width, midX + 10, y) -
                              luminanceAt(pixels, width, midX + 11, y));
    }

    const float avg = (topEdge + bottomEdge + leftEdge + rightEdge) /
                      static_cast<float>((width + height) * 2);
    return std::clamp(avg / 18.0f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectSalientBlobScore(const std::vector<std::uint8_t>& pixels, int width,
                                             int height) const {
    float weightedX = 0.0f;
    float weightedY = 0.0f;
    float weightSum = 0.0f;

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            const float grad = std::abs(lum - luminanceAt(pixels, width, x - 1, y)) +
                               std::abs(lum - luminanceAt(pixels, width, x, y - 1));
            if (grad > 10.0f) {
                weightedX += static_cast<float>(x) * grad;
                weightedY += static_cast<float>(y) * grad;
                weightSum += grad;
            }
        }
    }

    if (weightSum <= 0.0f) {
        return 0.0f;
    }

    const float cx = weightedX / weightSum;
    const float cy = weightedY / weightSum;
    float compact = 0.0f;
    int count = 0;
    const float radius = static_cast<float>(std::min(width, height)) * 0.24f;

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float dx = static_cast<float>(x) - cx;
            const float dy = static_cast<float>(y) - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                const float lum = luminanceAt(pixels, width, x, y);
                compact += std::abs(lum - luminanceAt(pixels, width, x - 1, y));
                ++count;
            }
        }
    }

    const float compactScore = count > 0 ? compact / static_cast<float>(count) : 0.0f;
    const float lowerBias = cy > static_cast<float>(height) * 0.30f ? 1.0f : 0.65f;
    return std::clamp(compactScore / 32.0f, 0.0f, 1.0f) * lowerBias;
}

float ScreenAnalyzer::fuseEnemyShieldScore(const std::vector<std::uint8_t>& pixels, int width,
                                           int height) {
    const auto matrix = buildBrightnessMatrix(pixels, width, height);
    const auto stats = computeStats(pixels);

    const float block = detectShieldBlockScore(matrix);
    const float vertical = detectVerticalShieldEdgeScore(matrix);
    const float flatness = detectCenterFlatnessScore(pixels, width, height);
    const float entropy = detectLowEntropyScore(stats);
    const float baseline = detectBaselineShiftScore(stats, shield_.crosshairBaseline,
                                                    shield_.crosshairBaselineReady);
    const float boundary = detectRectangularBoundaryScore(pixels, width, height);

    updateBaseline(shield_.crosshairBaseline, shield_.crosshairBaselineReady, stats,
                   std::max({block, vertical, flatness}));

    const float fused = std::max({block, vertical * 0.95f, flatness * 0.92f, entropy * 0.88f,
                                  baseline * 1.05f, boundary * 0.90f});

    const bool weakHit = block >= 0.06f || vertical >= 0.08f || flatness >= 0.10f ||
                         baseline >= 0.05f || boundary >= 0.07f || entropy >= 0.12f;

    return weakHit ? std::max(fused, 0.14f) : fused;
}

float ScreenAnalyzer::fuseGroundShieldScore(const std::vector<std::uint8_t>& pixels, int width,
                                            int height) {
    const auto stats = computeStats(pixels);
    const float blob = detectSalientBlobScore(pixels, width, height);
    const float boundary = detectRectangularBoundaryScore(pixels, width, height);
    const float baseline = detectBaselineShiftScore(stats, shield_.groundBaseline,
                                                    shield_.groundBaselineReady);
    const float flatness = detectCenterFlatnessScore(pixels, width, height);

    updateBaseline(shield_.groundBaseline, shield_.groundBaselineReady, stats,
                   std::max({blob, boundary}));

    const float fused = std::max({blob, boundary * 0.95f, baseline * 1.02f, flatness * 0.85f});
    const bool weakHit =
        blob >= 0.06f || boundary >= 0.06f || baseline >= 0.05f || flatness >= 0.08f;

    return weakHit ? std::max(fused, 0.13f) : fused;
}

void ScreenAnalyzer::updateBaseline(LuminanceStats& baseline, bool& ready,
                                      const LuminanceStats& current, float activityScore) {
    if (activityScore > 0.22f) {
        return;
    }

    if (!ready) {
        baseline = current;
        ready = true;
        return;
    }

    constexpr float alpha = 0.08f;
    baseline.mean = baseline.mean * (1.0f - alpha) + current.mean * alpha;
    baseline.stdDev = baseline.stdDev * (1.0f - alpha) + current.stdDev * alpha;
    baseline.entropy = baseline.entropy * (1.0f - alpha) + current.entropy * alpha;
    for (int i = 0; i < kHistogramBins; ++i) {
        baseline.histogram[i] =
            baseline.histogram[i] * (1.0f - alpha) + current.histogram[i] * alpha;
    }
}

void ScreenAnalyzer::pushHistory(std::deque<bool>& history, bool value) {
    history.push_back(value);
    while (history.size() > kShieldHistorySize) {
        history.pop_front();
    }
}

bool ScreenAnalyzer::latchFromHistory(const std::deque<bool>& history,
                                      std::chrono::steady_clock::time_point& stickyUntil,
                                      float confidence, float threshold) const {
    int positives = 0;
    for (bool frame : history) {
        if (frame) {
            ++positives;
        }
    }

    const bool frameHit = confidence >= threshold;
    const bool majority = positives >= 1;
    const bool sticky = now() < stickyUntil;

    return frameHit || majority || sticky;
}

void ScreenAnalyzer::tickShieldDetection() {
    const long long tickMs =
        std::chrono::duration_cast<std::chrono::milliseconds>(now().time_since_epoch()).count();
    if (tickMs == shield_.lastTickMs) {
        return;
    }
    shield_.lastTickMs = tickMs;

    std::vector<std::uint8_t> crosshairPixels;
    if (captureCrosshairRegion(crosshairPixels)) {
        shield_.enemyConfidence =
            fuseEnemyShieldScore(crosshairPixels, kCrosshairWidth, kCrosshairHeight);
        const bool frameEnemy = shield_.enemyConfidence >= shieldThreshold_;
        pushHistory(shield_.enemyFrames, frameEnemy);
        if (frameEnemy) {
            shield_.enemyStickyUntil = now() + std::chrono::milliseconds(kEnemyStickyMs);
        }
        shield_.enemyLatched =
            latchFromHistory(shield_.enemyFrames, shield_.enemyStickyUntil, shield_.enemyConfidence,
                             shieldThreshold_);
    }

    std::vector<std::uint8_t> groundPixels;
    if (captureGroundShieldRegion(groundPixels)) {
        shield_.groundConfidence =
            fuseGroundShieldScore(groundPixels, kGroundShieldWidth, kGroundShieldHeight);
        const bool frameGround = shield_.groundConfidence >= groundShieldThreshold_;
        pushHistory(shield_.groundFrames, frameGround);
        if (frameGround) {
            shield_.groundStickyUntil = now() + std::chrono::milliseconds(kGroundStickyMs);
        }
        shield_.groundLatched = latchFromHistory(shield_.groundFrames, shield_.groundStickyUntil,
                                               shield_.groundConfidence, groundShieldThreshold_);
    }
}

bool ScreenAnalyzer::isShieldRaised() {
    tickShieldDetection();
    return shield_.enemyLatched;
}

bool ScreenAnalyzer::isEnemyShieldInRange() {
    tickShieldDetection();
    return shield_.enemyLatched;
}

bool ScreenAnalyzer::isShieldOnGround() {
    tickShieldDetection();
    return shield_.groundLatched;
}

float ScreenAnalyzer::detectRedDamageScore(const std::vector<std::uint8_t>& pixels, int width,
                                           int height) const {
    int redHits = 0;
    int samples = 0;
    const int startX = width / 4;
    const int endX = width * 3 / 4;
    const int startY = height / 4;
    const int endY = height * 3 / 4;

    for (int y = startY; y < endY; ++y) {
        for (int x = startX; x < endX; ++x) {
            const std::size_t idx = (static_cast<std::size_t>(y) * width + x) * 4;
            const float r = pixels[idx + 2];
            const float g = pixels[idx + 1];
            const float b = pixels[idx + 0];
            if (r > 145.0f && r > g * 1.35f && r > b * 1.35f) {
                ++redHits;
            }
            ++samples;
        }
    }
    return samples > 0 ? static_cast<float>(redHits) / static_cast<float>(samples) : 0.0f;
}

float ScreenAnalyzer::detectNameTagScore(const std::vector<std::uint8_t>& pixels, int width,
                                         int height) const {
    const int midY = height / 2;
    int transitions = 0;
    float prev = luminanceAt(pixels, width, width / 2, midY);

    for (int x = 1; x < width - 1; ++x) {
        const float lum = luminanceAt(pixels, width, x, midY);
        if (std::abs(lum - prev) > 22.0f) {
            ++transitions;
        }
        prev = lum;
    }

    return std::clamp((static_cast<float>(transitions) / static_cast<float>(width)) * 2.2f, 0.0f,
                      1.0f);
}

float ScreenAnalyzer::detectArmorContrastScore(const std::vector<std::uint8_t>& pixels, int width,
                                               int height) const {
    float edgeEnergy = 0.0f;
    int count = 0;
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            edgeEnergy += std::abs(lum - luminanceAt(pixels, width, x - 1, y)) +
                          std::abs(lum - luminanceAt(pixels, width, x, y - 1));
            ++count;
        }
    }
    return std::clamp((edgeEnergy / static_cast<float>(count)) / 55.0f, 0.0f, 1.0f);
}

bool ScreenAnalyzer::isEnemyInCrosshairRange() {
    std::vector<std::uint8_t> pixels;
    if (!captureCrosshairRegion(pixels)) {
        return false;
    }

    const float redScore = detectRedDamageScore(pixels, kCrosshairWidth, kCrosshairHeight);
    const float nameScore = detectNameTagScore(pixels, kCrosshairWidth, kCrosshairHeight);
    const float armorScore = detectArmorContrastScore(pixels, kCrosshairWidth, kCrosshairHeight);
    return std::max({redScore * 1.2f, nameScore * 0.9f, armorScore * 0.75f}) >= enemyThreshold_;
}

float ScreenAnalyzer::detectInventoryGridScore(const std::vector<std::uint8_t>& pixels, int width,
                                               int height) const {
    const int gridCols = 9;
    const int gridRows = 3;
    const int cellW = width / gridCols;
    const int cellH = height / gridRows;
    float edgeScore = 0.0f;
    int samples = 0;

    for (int row = 0; row < gridRows; ++row) {
        for (int col = 0; col < gridCols; ++col) {
            const int cx = col * cellW + cellW / 2;
            const int cy = row * cellH + cellH / 2;
            if (cx <= 0 || cy <= 0 || cx >= width - 1 || cy >= height - 1) {
                continue;
            }
            const float center = luminanceAt(pixels, width, cx, cy);
            edgeScore += std::abs(center - luminanceAt(pixels, width, cx - 1, cy)) +
                         std::abs(center - luminanceAt(pixels, width, cx, cy - 1));
            ++samples;
        }
    }

    return std::clamp((edgeScore / static_cast<float>(samples)) / 38.0f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectChatBarScore(const std::vector<std::uint8_t>& pixels, int width,
                                         int height) const {
    int brightPixels = 0;
    int samples = 0;
    float transitionScore = 0.0f;

    for (int y = height / 2; y < height; ++y) {
        float prev = luminanceAt(pixels, width, 1, y);
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            if (lum > 175.0f) {
                ++brightPixels;
            }
            if (std::abs(lum - prev) > 18.0f) {
                transitionScore += 1.0f;
            }
            prev = lum;
            ++samples;
        }
    }

    const float brightRatio =
        samples > 0 ? static_cast<float>(brightPixels) / static_cast<float>(samples) : 0.0f;
    const float transitionRatio =
        samples > 0 ? transitionScore / static_cast<float>(samples) : 0.0f;
    return std::clamp(brightRatio * 1.4f + transitionRatio * 2.8f, 0.0f, 1.0f);
}

bool ScreenAnalyzer::isChatOpen() {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int bandHeight = std::max(42, screenHeight / 14);

    std::vector<std::uint8_t> pixels;
    if (!captureScreenRegion(0, screenHeight - bandHeight, screenWidth, bandHeight, pixels)) {
        return false;
    }

    return detectChatBarScore(pixels, screenWidth, bandHeight) >= 0.34f;
}

bool ScreenAnalyzer::isInventoryOpen() {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int invW = std::min(360, screenWidth * 2 / 5);
    const int invH = std::min(220, screenHeight / 3);

    std::vector<std::uint8_t> pixels;
    if (!captureScreenRegion((screenWidth - invW) / 2, (screenHeight - invH) / 2, invW, invH,
                             pixels)) {
        return false;
    }

    return detectInventoryGridScore(pixels, invW, invH) >= 0.36f;
}

}  // namespace macro
