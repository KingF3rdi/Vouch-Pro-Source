#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "macro_manager.hpp"

#include <memory>
#include <string>

namespace macro {

class GuiApp {
public:
    int run(HINSTANCE instance);

private:
    struct ControlIds {
        static constexpr int Cooldown = 1001;
        static constexpr int SuccessChance = 1002;
        static constexpr int ClickHoldMin = 1003;
        static constexpr int ClickHoldMax = 1004;
        static constexpr int MotionInterval = 1005;
        static constexpr int FallWindow = 1006;
        static constexpr int UpwardVelocity = 1007;
        static constexpr int PearlDelayMin = 1008;
        static constexpr int PearlDelayMax = 1009;
        static constexpr int ChestX = 1010;
        static constexpr int ChestY = 1011;
        static constexpr int TotemX = 1020;
        static constexpr int TotemY = 1021;
        static constexpr int LoopReliefMin = 1012;
        static constexpr int LoopReliefMax = 1013;
        static constexpr int BtnStart = 1014;
        static constexpr int BtnStop = 1015;
        static constexpr int BtnApply = 1016;
        static constexpr int StatusFall = 1017;
        static constexpr int StatusShield = 1018;
        static constexpr int StatusEnemy = 1019;
        static constexpr int StatusChat = 1022;
        static constexpr int StatusInventory = 1023;
        static constexpr int TimerStatus = 1;
    };

    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam);

    bool createWindow(HINSTANCE instance);
    void createControls(HWND hwnd);
    void paintBackground(HDC hdc, const RECT& clientRect);
    void startModules();
    void stopModules();
    void applyConfigFromUi();
    AppConfig readConfigFromUi() const;
    void writeConfigToUi(const AppConfig& config);
    void updateStatusLabels();
    int readInt(int controlId, int fallback) const;
    float readFloat(int controlId, float fallback) const;
    void setStatusText(int controlId, const wchar_t* text);

    HWND hwnd_{nullptr};
    HINSTANCE instance_{nullptr};
    HFONT titleFont_{nullptr};
    HFONT bodyFont_{nullptr};
    HBRUSH editBrush_{nullptr};

    std::unique_ptr<MacroManager> manager_;
};

}  // namespace macro
