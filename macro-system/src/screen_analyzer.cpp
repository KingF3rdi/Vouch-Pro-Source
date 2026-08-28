#include "screen_analyzer.hpp"

#include <algorithm>
#include <cmath>
#include <windows.h>

namespace macro {

ScreenAnalyzer::ScreenAnalyzer() = default;

void ScreenAnalyzer::setShieldThreshold(float threshold) {
    shieldThreshold_ = std::clamp(threshold, 0.05f, 1.0f);
}

void ScreenAnalyzer::setEnemyThreshold(float threshold) {
    enemyThreshold_ = std::clamp(threshold, 0.05f, 1.0f);
}

void ScreenAnalyzer::setGroundShieldThreshold(float threshold) {
    groundShieldThreshold_ = std::clamp(threshold, 0.05f, 1.0f);
}

bool ScreenAnalyzer::captureScreenRegion(int originX, int originY, int width, int height,
                                         std::vector<std::uint8_t>& bgraPixels) const {
    // --- GDI-Bitmap-Auslesung: definierter Bildschirmbereich ---
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
    const int originX = (screenWidth - size) / 2;
    const int originY = (screenHeight - size) / 2;
    return captureScreenRegion(originX, originY, size, size, bgraPixels);
}

bool ScreenAnalyzer::captureCrosshairRegion(std::vector<std::uint8_t>& bgraPixels) const {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int originX = (screenWidth - kCrosshairWidth) / 2;
    const int originY = (screenHeight - kCrosshairHeight) / 2;
    return captureScreenRegion(originX, originY, kCrosshairWidth, kCrosshairHeight, bgraPixels);
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
    const int cellW = width / kMatrixSize;
    const int cellH = height / kMatrixSize;

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
    return distance * 0.5f;
}

float ScreenAnalyzer::detectShieldBlockScore(
    const std::array<std::array<float, kMatrixSize>, kMatrixSize>& matrix) const {
    // Schild-Block: zentrale Zellen relativ homogen, aeussere Ring-Kontrastkante erhoeht
    float centerSum = 0.0f;
    float edgeSum = 0.0f;
    int centerCount = 0;
    int edgeCount = 0;

    for (int y = 0; y < kMatrixSize; ++y) {
        for (int x = 0; x < kMatrixSize; ++x) {
            const bool isCenter = x >= 2 && x <= 5 && y >= 2 && y <= 5;
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
    for (int y = 2; y <= 5; ++y) {
        for (int x = 2; x <= 5; ++x) {
            const float diff = matrix[y][x] - centerMean;
            centerVariance += diff * diff;
        }
    }
    centerVariance /= 16.0f;

    const float homogeneity = 1.0f / (1.0f + centerVariance / 120.0f);
    const float edgeContrast = std::abs(edgeMean - centerMean) / 128.0f;
    return std::clamp(homogeneity * 0.55f + edgeContrast * 0.45f, 0.0f, 1.0f);
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
    // Horizontale Textband-Struktur: abwechselnde Kanten entlang X-Achse
    float bandScore = 0.0f;
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

    bandScore = static_cast<float>(transitions) / static_cast<float>(width);
    return std::clamp(bandScore * 2.2f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectArmorContrastScore(const std::vector<std::uint8_t>& pixels, int width,
                                               int height) const {
    float edgeEnergy = 0.0f;
    int count = 0;
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            const float grad =
                std::abs(lum - luminanceAt(pixels, width, x - 1, y)) +
                std::abs(lum - luminanceAt(pixels, width, x, y - 1));
            edgeEnergy += grad;
            ++count;
        }
    }
    const float avgGrad = count > 0 ? edgeEnergy / static_cast<float>(count) : 0.0f;
    return std::clamp(avgGrad / 55.0f, 0.0f, 1.0f);
}

bool ScreenAnalyzer::isShieldRaised() {
    std::vector<std::uint8_t> pixels;
    if (!captureCenterRegion(kShieldCaptureSize, pixels)) {
        return false;
    }

    const auto matrix = buildBrightnessMatrix(pixels, kShieldCaptureSize, kShieldCaptureSize);
    const float score = detectShieldBlockScore(matrix);
    return score >= shieldThreshold_;
}

bool ScreenAnalyzer::isEnemyShieldInRange() {
    std::vector<std::uint8_t> pixels;
    if (!captureCrosshairRegion(pixels)) {
        return false;
    }

    const auto matrix = buildBrightnessMatrix(pixels, kCrosshairWidth, kCrosshairHeight);
    const float score = detectShieldBlockScore(matrix);
    return score >= shieldThreshold_;
}

bool ScreenAnalyzer::captureGroundShieldRegion(std::vector<std::uint8_t>& bgraPixels) const {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int originX = (screenWidth - kGroundShieldWidth) / 2;
    const int originY = (screenHeight / 2) + (screenHeight / 10);
    return captureScreenRegion(originX, originY, kGroundShieldWidth, kGroundShieldHeight, bgraPixels);
}

float ScreenAnalyzer::detectGroundShieldScore(const std::vector<std::uint8_t>& pixels, int width,
                                            int height) const {
    // Liegendes Schild: kompakte Kontrast-Insel auf dem Boden (texturunabhaengig)
    float weightedX = 0.0f;
    float weightedY = 0.0f;
    float weightSum = 0.0f;
    float localContrastSum = 0.0f;
    int samples = 0;

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float lum = luminanceAt(pixels, width, x, y);
            const float grad = std::abs(lum - luminanceAt(pixels, width, x - 1, y)) +
                               std::abs(lum - luminanceAt(pixels, width, x, y - 1));
            localContrastSum += grad;
            ++samples;

            if (grad > 16.0f) {
                weightedX += static_cast<float>(x) * grad;
                weightedY += static_cast<float>(y) * grad;
                weightSum += grad;
            }
        }
    }

    if (weightSum <= 0.0f || samples == 0) {
        return 0.0f;
    }

    const float centerX = weightedX / weightSum;
    const float centerY = weightedY / weightSum;
    const float avgContrast = localContrastSum / static_cast<float>(samples);

    float compactness = 0.0f;
    int compactSamples = 0;
    const float radius = static_cast<float>(std::min(width, height)) * 0.22f;

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            const float dx = static_cast<float>(x) - centerX;
            const float dy = static_cast<float>(y) - centerY;
            if ((dx * dx + dy * dy) <= radius * radius) {
                const float lum = luminanceAt(pixels, width, x, y);
                const float grad = std::abs(lum - luminanceAt(pixels, width, x - 1, y)) +
                                   std::abs(lum - luminanceAt(pixels, width, x, y - 1));
                compactness += grad;
                ++compactSamples;
            }
        }
    }

    const float compactScore =
        compactSamples > 0 ? compactness / static_cast<float>(compactSamples) : 0.0f;
    const float lowerBias = centerY > static_cast<float>(height) * 0.35f ? 1.0f : 0.55f;
    return std::clamp((compactScore / 42.0f) * 0.7f + (avgContrast / 50.0f) * 0.3f, 0.0f, 1.0f) *
           lowerBias;
}

bool ScreenAnalyzer::isShieldOnGround() {
    std::vector<std::uint8_t> pixels;
    if (!captureGroundShieldRegion(pixels)) {
        return false;
    }

    const float score = detectGroundShieldScore(pixels, kGroundShieldWidth, kGroundShieldHeight);
    return score >= groundShieldThreshold_;
}

bool ScreenAnalyzer::isEnemyInCrosshairRange() {
    std::vector<std::uint8_t> pixels;
    if (!captureCrosshairRegion(pixels)) {
        return false;
    }

    const float redScore = detectRedDamageScore(pixels, kCrosshairWidth, kCrosshairHeight);
    const float nameScore = detectNameTagScore(pixels, kCrosshairWidth, kCrosshairHeight);
    const float armorScore = detectArmorContrastScore(pixels, kCrosshairWidth, kCrosshairHeight);

    const float combined = std::max({redScore * 1.2f, nameScore * 0.9f, armorScore * 0.75f});
    return combined >= enemyThreshold_;
}

float ScreenAnalyzer::detectInventoryGridScore(const std::vector<std::uint8_t>& pixels, int width,
                                               int height) const {
    // Inventar: regelmaessiges Slot-Gitter in der Bildschirmmitte
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
            const float edge = std::abs(center - luminanceAt(pixels, width, cx - 1, cy)) +
                               std::abs(center - luminanceAt(pixels, width, cx, cy - 1));
            edgeScore += edge;
            ++samples;
        }
    }

    const float avgEdge = samples > 0 ? edgeScore / static_cast<float>(samples) : 0.0f;
    return std::clamp(avgEdge / 38.0f, 0.0f, 1.0f);
}

float ScreenAnalyzer::detectChatBarScore(const std::vector<std::uint8_t>& pixels, int width,
                                         int height) const {
    // Chat: helle Eingabezeile und erhoehte Kontrastzone am unteren Rand
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

    const float score = detectChatBarScore(pixels, screenWidth, bandHeight);
    return score >= 0.34f;
}

bool ScreenAnalyzer::isInventoryOpen() {
    const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    const int invW = std::min(360, screenWidth * 2 / 5);
    const int invH = std::min(220, screenHeight / 3);
    const int originX = (screenWidth - invW) / 2;
    const int originY = (screenHeight - invH) / 2;

    std::vector<std::uint8_t> pixels;
    if (!captureScreenRegion(originX, originY, invW, invH, pixels)) {
        return false;
    }

    const float score = detectInventoryGridScore(pixels, invW, invH);
    return score >= 0.36f;
}

}  // namespace macro
