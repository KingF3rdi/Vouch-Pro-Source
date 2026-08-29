#include "gui_app.hpp"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <windowsx.h>
#include <objidl.h>
#include <gdiplus.h>
#include <commctrl.h>

#include <algorithm>
#include <sstream>

#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "comctl32.lib")

namespace {

constexpr int kWindowWidth = 480;
constexpr int kWindowHeight = 820;
constexpr int kCornerRadius = 26;
constexpr int kTitleBarHeight = 58;
COLORREF kWhite = RGB(245, 248, 255);
ULONG_PTR gdiplusToken = 0;

HWND createLabel(HWND parent, HFONT font, const wchar_t* text, int x, int y, int w, int h) {
    HWND label = CreateWindowExW(0, L"STATIC", text, WS_CHILD | WS_VISIBLE, x, y, w, h, parent,
                                 nullptr, nullptr, nullptr);
    SendMessageW(label, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
    return label;
}

HWND createEdit(HWND parent, HFONT font, int id, int x, int y, int w, int h, const wchar_t* text) {
    HWND edit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", text,
                                WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL, x, y, w, h, parent,
                                reinterpret_cast<HMENU>(static_cast<intptr_t>(id)), nullptr,
                                nullptr);
    SendMessageW(edit, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
    return edit;
}

HWND createButton(HWND parent, HFONT font, int id, const wchar_t* text, int x, int y, int w, int h) {
    HWND button = CreateWindowExW(0, L"BUTTON", text, WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, x, y,
                                  w, h, parent, reinterpret_cast<HMENU>(static_cast<intptr_t>(id)),
                                  nullptr, nullptr);
    SendMessageW(button, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
    return button;
}

std::wstring toWide(int value) { return std::to_wstring(value); }

std::wstring toWide(float value) {
    std::wostringstream stream;
    stream.precision(1);
    stream << std::fixed << value;
    return stream.str();
}

}  // namespace

namespace macro {

int GuiApp::run(HINSTANCE instance) {
    instance_ = instance;

    Gdiplus::GdiplusStartupInput startupInput;
    if (Gdiplus::GdiplusStartup(&gdiplusToken, &startupInput, nullptr) != Gdiplus::Ok) {
        return 1;
    }

    INITCOMMONCONTROLSEX controls{};
    controls.dwSize = sizeof(controls);
    controls.dwICC = ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&controls);

    if (!createWindow(instance)) {
        Gdiplus::GdiplusShutdown(gdiplusToken);
        return 1;
    }

    writeConfigToUi(AppConfig{});
    manager_ = std::make_unique<MacroManager>(AppConfig{});

    MSG msg{};
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    stopModules();
    Gdiplus::GdiplusShutdown(gdiplusToken);
    return static_cast<int>(msg.wParam);
}

bool GuiApp::createWindow(HINSTANCE instance) {
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = instance;
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.lpszClassName = L"MacroSystemGuiWindow";
    RegisterClassExW(&wc);

    hwnd_ = CreateWindowExW(WS_EX_APPWINDOW, wc.lpszClassName, L"Macro System",
                            WS_POPUP | WS_VISIBLE | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN,
                            CW_USEDEFAULT, CW_USEDEFAULT, kWindowWidth, kWindowHeight, nullptr,
                            nullptr, instance, this);

    if (!hwnd_) {
        return false;
    }

    HRGN roundRegion = CreateRoundRectRgn(0, 0, kWindowWidth + 1, kWindowHeight + 1,
                                          kCornerRadius, kCornerRadius);
    SetWindowRgn(hwnd_, roundRegion, TRUE);
    ShowWindow(hwnd_, SW_SHOW);
    UpdateWindow(hwnd_);
    return true;
}

void GuiApp::createControls(HWND hwnd) {
    titleFont_ = CreateFontW(26, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
    bodyFont_ = CreateFontW(16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                            DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
    editBrush_ = CreateSolidBrush(kWhite);

    const struct FieldSpec {
        int id;
        const wchar_t* label;
        const wchar_t* value;
    } fields[] = {
        {ControlIds::GlobalInventory, L"Inventar-Taste (global)", L"E"},
        {ControlIds::GlobalOffhand, L"Offhand-Taste (global)", L"F"},
        {ControlIds::GlobalUse, L"Use-Taste (global)", L"R"},
        {ControlIds::GlobalAttackSlot, L"Angriffs-Slot (global)", L"1"},
        {ControlIds::Cooldown, L"Stunslam Cooldown (ms)", L"1000"},
        {ControlIds::SuccessChance, L"Erfolgschance (%)", L"85"},
        {ControlIds::ClickHoldMin, L"Klick Min (ms)", L"15"},
        {ControlIds::ClickHoldMax, L"Klick Max (ms)", L"35"},
        {ControlIds::MotionInterval, L"Motion Intervall (ms)", L"10"},
        {ControlIds::FallWindow, L"Fall Fenster (ms)", L"220"},
        {ControlIds::UpwardVelocity, L"Aufwaerts px/s", L"32.0"},
        {ControlIds::PearlDelayMin, L"Pearl Delay Min (ms)", L"5"},
        {ControlIds::PearlDelayMax, L"Pearl Delay Max (ms)", L"15"},
        {ControlIds::ChestX, L"Elytra Slot X", L"0"},
        {ControlIds::ChestY, L"Elytra Slot Y", L"0"},
        {ControlIds::TotemX, L"AutoTotem Slot X", L"0"},
        {ControlIds::TotemY, L"AutoTotem Slot Y", L"0"},
        {ControlIds::LoopReliefMin, L"Loop Pause Min (ms)", L"1"},
        {ControlIds::LoopReliefMax, L"Loop Pause Max (ms)", L"3"},
    };

    int y = 88;
    for (const auto& field : fields) {
        createLabel(hwnd, bodyFont_, field.label, 28, y, 230, 22);
        createEdit(hwnd, bodyFont_, field.id, 270, y - 2, 170, 26, field.value);
        y += 38;
    }

    createLabel(hwnd, bodyFont_, L"Status Fall:", 28, y + 4, 120, 22);
    CreateWindowExW(0, L"STATIC", L"Inaktiv", WS_CHILD | WS_VISIBLE | SS_CENTER, 150, y, 90, 24,
                    hwnd, reinterpret_cast<HMENU>(ControlIds::StatusFall), instance_, nullptr);
    createLabel(hwnd, bodyFont_, L"Schild:", 250, y + 4, 70, 22);
    CreateWindowExW(0, L"STATIC", L"Inaktiv", WS_CHILD | WS_VISIBLE | SS_CENTER, 320, y, 90, 24,
                    hwnd, reinterpret_cast<HMENU>(ControlIds::StatusShield), instance_, nullptr);
    createLabel(hwnd, bodyFont_, L"Gegner:", 28, y + 36, 70, 22);
    CreateWindowExW(0, L"STATIC", L"Inaktiv", WS_CHILD | WS_VISIBLE | SS_CENTER, 150, y + 32, 90,
                    24, hwnd, reinterpret_cast<HMENU>(ControlIds::StatusEnemy), instance_, nullptr);
    createLabel(hwnd, bodyFont_, L"Chat:", 250, y + 36, 50, 22);
    CreateWindowExW(0, L"STATIC", L"Zu", WS_CHILD | WS_VISIBLE | SS_CENTER, 300, y + 32, 50, 24,
                    hwnd, reinterpret_cast<HMENU>(ControlIds::StatusChat), instance_, nullptr);
    createLabel(hwnd, bodyFont_, L"Inventar:", 360, y + 36, 70, 22);
    CreateWindowExW(0, L"STATIC", L"Zu", WS_CHILD | WS_VISIBLE | SS_CENTER, 430, y + 32, 50, 24,
                    hwnd, reinterpret_cast<HMENU>(ControlIds::StatusInventory), instance_, nullptr);

    const int buttonY = kWindowHeight - 74;
    createButton(hwnd, bodyFont_, ControlIds::BtnStart, L"Start", 36, buttonY, 120, 38);
    createButton(hwnd, bodyFont_, ControlIds::BtnStop, L"Stop", 170, buttonY, 120, 38);
    createButton(hwnd, bodyFont_, ControlIds::BtnApply, L"Uebernehmen", 304, buttonY, 140, 38);

    for (HWND child = GetWindow(hwnd, GW_CHILD); child; child = GetWindow(child, GW_HWNDNEXT)) {
        SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(bodyFont_), TRUE);
    }

    SetTimer(hwnd, ControlIds::TimerStatus, 100, nullptr);
}

void GuiApp::paintBackground(HDC hdc, const RECT& clientRect) {
    Gdiplus::Graphics graphics(hdc);
    graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);

    Gdiplus::LinearGradientBrush brush(
        Gdiplus::Point(0, 0), Gdiplus::Point(0, clientRect.bottom),
        Gdiplus::Color(255, 37, 99, 235), Gdiplus::Color(255, 29, 78, 216));
    graphics.FillRectangle(&brush, 0, 0, clientRect.right, clientRect.bottom);

    Gdiplus::SolidBrush cardBrush(Gdiplus::Color(175, 255, 255, 255));
    Gdiplus::GraphicsPath path;
    const int cardX = 18;
    const int cardY = 64;
    const int cardW = clientRect.right - 36;
    const int cardH = clientRect.bottom - 150;
    const int radius = 18;
    path.AddArc(cardX, cardY, radius * 2, radius * 2, 180, 90);
    path.AddArc(cardX + cardW - radius * 2, cardY, radius * 2, radius * 2, 270, 90);
    path.AddArc(cardX + cardW - radius * 2, cardY + cardH - radius * 2, radius * 2, radius * 2, 0,
                90);
    path.AddArc(cardX, cardY + cardH - radius * 2, radius * 2, radius * 2, 90, 90);
    path.CloseFigure();
    graphics.FillPath(&cardBrush, &path);

    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, RGB(255, 255, 255));
    SelectObject(hdc, titleFont_);
    RECT titleRect{24, 18, clientRect.right - 24, 58};
    DrawTextW(hdc, L"Macro System", -1, &titleRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    SelectObject(hdc, bodyFont_);
    DrawTextW(hdc, L"Extern | No Memory Read", -1, &titleRect, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
}

int GuiApp::readInt(int controlId, int fallback) const {
    wchar_t buffer[64]{};
    GetDlgItemTextW(hwnd_, controlId, buffer, 63);
    try {
        return std::stoi(buffer);
    } catch (...) {
        return fallback;
    }
}

float GuiApp::readFloat(int controlId, float fallback) const {
    wchar_t buffer[64]{};
    GetDlgItemTextW(hwnd_, controlId, buffer, 63);
    try {
        return std::stof(buffer);
    } catch (...) {
        return fallback;
    }
}

WORD GuiApp::readKey(int controlId, WORD fallback) const {
    wchar_t buffer[8]{};
    GetDlgItemTextW(hwnd_, controlId, buffer, 7);
    if (buffer[0] == L'\0') {
        return fallback;
    }
    return static_cast<WORD>(buffer[0]);
}

AppConfig GuiApp::readConfigFromUi() const {
    AppConfig config{};
    config.bindings.inventoryKey =
        readKey(ControlIds::GlobalInventory, config.bindings.inventoryKey);
    config.bindings.offhandSwapKey =
        readKey(ControlIds::GlobalOffhand, config.bindings.offhandSwapKey);
    config.bindings.useKey = readKey(ControlIds::GlobalUse, config.bindings.useKey);
    config.bindings.attackSlotKey =
        readKey(ControlIds::GlobalAttackSlot, config.bindings.attackSlotKey);

    config.stunslam.cooldownMs = readInt(ControlIds::Cooldown, config.stunslam.cooldownMs);
    config.stunslam.successChance =
        std::clamp(readInt(ControlIds::SuccessChance, config.stunslam.successChance), 0, 100);
    config.stunslam.clickHoldMinMs = readInt(ControlIds::ClickHoldMin, config.stunslam.clickHoldMinMs);
    config.stunslam.clickHoldMaxMs = readInt(ControlIds::ClickHoldMax, config.stunslam.clickHoldMaxMs);
    config.stunslam.fall.motionSampleIntervalMs =
        readInt(ControlIds::MotionInterval, config.stunslam.fall.motionSampleIntervalMs);
    config.stunslam.fall.fallDetectionWindowMs =
        readInt(ControlIds::FallWindow, config.stunslam.fall.fallDetectionWindowMs);
    config.stunslam.fall.upwardVelocityThreshold =
        readFloat(ControlIds::UpwardVelocity, config.stunslam.fall.upwardVelocityThreshold);

    config.pearlcatch.delayMinMs = readInt(ControlIds::PearlDelayMin, config.pearlcatch.delayMinMs);
    config.pearlcatch.delayMaxMs = readInt(ControlIds::PearlDelayMax, config.pearlcatch.delayMaxMs);

    config.elytra.chestplateSlotX = readInt(ControlIds::ChestX, config.elytra.chestplateSlotX);
    config.elytra.chestplateSlotY = readInt(ControlIds::ChestY, config.elytra.chestplateSlotY);
    config.autoTotem.totemInventorySlotX =
        readInt(ControlIds::TotemX, config.autoTotem.totemInventorySlotX);
    config.autoTotem.totemInventorySlotY =
        readInt(ControlIds::TotemY, config.autoTotem.totemInventorySlotY);

    const int loopMin = readInt(ControlIds::LoopReliefMin, 1);
    const int loopMax = readInt(ControlIds::LoopReliefMax, 3);
    config.stunslam.loopReliefMinMs = loopMin;
    config.stunslam.loopReliefMaxMs = loopMax;
    config.pearlcatch.loopReliefMinMs = loopMin;
    config.pearlcatch.loopReliefMaxMs = loopMax;
    config.elytra.loopReliefMinMs = loopMin;
    config.elytra.loopReliefMaxMs = loopMax;

    return config;
}

void GuiApp::writeConfigToUi(const AppConfig& config) {
    wchar_t keyBuf[2]{};
    keyBuf[1] = L'\0';

    keyBuf[0] = static_cast<wchar_t>(config.bindings.inventoryKey);
    SetDlgItemTextW(hwnd_, ControlIds::GlobalInventory, keyBuf);
    keyBuf[0] = static_cast<wchar_t>(config.bindings.offhandSwapKey);
    SetDlgItemTextW(hwnd_, ControlIds::GlobalOffhand, keyBuf);
    keyBuf[0] = static_cast<wchar_t>(config.bindings.useKey);
    SetDlgItemTextW(hwnd_, ControlIds::GlobalUse, keyBuf);
    keyBuf[0] = static_cast<wchar_t>(config.bindings.attackSlotKey);
    SetDlgItemTextW(hwnd_, ControlIds::GlobalAttackSlot, keyBuf);

    SetDlgItemTextW(hwnd_, ControlIds::Cooldown, toWide(config.stunslam.cooldownMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::SuccessChance, toWide(config.stunslam.successChance).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::ClickHoldMin, toWide(config.stunslam.clickHoldMinMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::ClickHoldMax, toWide(config.stunslam.clickHoldMaxMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::MotionInterval,
                    toWide(config.stunslam.fall.motionSampleIntervalMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::FallWindow,
                    toWide(config.stunslam.fall.fallDetectionWindowMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::UpwardVelocity,
                    toWide(config.stunslam.fall.upwardVelocityThreshold).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::PearlDelayMin, toWide(config.pearlcatch.delayMinMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::PearlDelayMax, toWide(config.pearlcatch.delayMaxMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::ChestX, toWide(config.elytra.chestplateSlotX).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::ChestY, toWide(config.elytra.chestplateSlotY).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::TotemX, toWide(config.autoTotem.totemInventorySlotX).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::TotemY, toWide(config.autoTotem.totemInventorySlotY).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::LoopReliefMin, toWide(config.stunslam.loopReliefMinMs).c_str());
    SetDlgItemTextW(hwnd_, ControlIds::LoopReliefMax, toWide(config.stunslam.loopReliefMaxMs).c_str());
}

void GuiApp::setStatusText(int controlId, const wchar_t* text) {
    SetDlgItemTextW(hwnd_, controlId, text);
}

void GuiApp::updateStatusLabels() {
    if (!manager_ || !manager_->isRunning()) {
        setStatusText(ControlIds::StatusFall, L"Inaktiv");
        setStatusText(ControlIds::StatusShield, L"Inaktiv");
        setStatusText(ControlIds::StatusEnemy, L"Inaktiv");
        setStatusText(ControlIds::StatusChat, L"Zu");
        setStatusText(ControlIds::StatusInventory, L"Zu");
        return;
    }

    setStatusText(ControlIds::StatusFall, manager_->isInFreeFall() ? L"Aktiv" : L"Warten");
    setStatusText(ControlIds::StatusShield, manager_->isShieldActive() ? L"Aktiv" : L"Warten");
    setStatusText(ControlIds::StatusEnemy, manager_->isEnemyInRange() ? L"Aktiv" : L"Warten");
    setStatusText(ControlIds::StatusChat, manager_->isChatOpen() ? L"Offen" : L"Zu");
    setStatusText(ControlIds::StatusInventory, manager_->isInventoryOpen() ? L"Offen" : L"Zu");
}

void GuiApp::startModules() {
    if (!manager_) {
        manager_ = std::make_unique<MacroManager>(readConfigFromUi());
    } else {
        manager_->setConfig(readConfigFromUi());
    }
    manager_->startAll();
}

void GuiApp::stopModules() {
    if (manager_) {
        manager_->stopAll();
    }
}

void GuiApp::applyConfigFromUi() {
    if (manager_) {
        manager_->setConfig(readConfigFromUi());
    }
}

LRESULT CALLBACK GuiApp::WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam) {
    GuiApp* app = nullptr;

    if (msg == WM_NCCREATE) {
        auto* createStruct = reinterpret_cast<CREATESTRUCTW*>(lparam);
        app = static_cast<GuiApp*>(createStruct->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(app));
        app->hwnd_ = hwnd;
    } else {
        app = reinterpret_cast<GuiApp*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }

    if (!app) {
        return DefWindowProcW(hwnd, msg, wparam, lparam);
    }

    switch (msg) {
        case WM_CREATE:
            app->createControls(hwnd);
            return 0;

        case WM_TIMER:
            if (wparam == ControlIds::TimerStatus) {
                app->updateStatusLabels();
            }
            return 0;

        case WM_CTLCOLORSTATIC: {
            HDC hdcStatic = reinterpret_cast<HDC>(wparam);
            SetTextColor(hdcStatic, RGB(20, 35, 75));
            SetBkMode(hdcStatic, TRANSPARENT);
            return reinterpret_cast<LRESULT>(GetStockObject(HOLLOW_BRUSH));
        }

        case WM_CTLCOLOREDIT: {
            HDC hdcEdit = reinterpret_cast<HDC>(wparam);
            SetTextColor(hdcEdit, RGB(20, 35, 75));
            SetBkColor(hdcEdit, kWhite);
            return reinterpret_cast<LRESULT>(app->editBrush_);
        }

        case WM_COMMAND:
            switch (LOWORD(wparam)) {
                case ControlIds::BtnStart:
                    app->startModules();
                    break;
                case ControlIds::BtnStop:
                    app->stopModules();
                    break;
                case ControlIds::BtnApply:
                    app->applyConfigFromUi();
                    break;
                default:
                    break;
            }
            return 0;

        case WM_PAINT: {
            PAINTSTRUCT ps{};
            HDC hdc = BeginPaint(hwnd, &ps);
            RECT clientRect{};
            GetClientRect(hwnd, &clientRect);
            app->paintBackground(hdc, clientRect);
            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_ERASEBKGND:
            return 1;

        case WM_NCHITTEST: {
            LRESULT hit = DefWindowProcW(hwnd, msg, wparam, lparam);
            if (hit == HTCLIENT) {
                POINT pt{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
                ScreenToClient(hwnd, &pt);
                if (pt.y < kTitleBarHeight) {
                    return HTCAPTION;
                }
            }
            return hit;
        }

        case WM_DESTROY:
            KillTimer(hwnd, ControlIds::TimerStatus);
            if (app->titleFont_) {
                DeleteObject(app->titleFont_);
            }
            if (app->bodyFont_) {
                DeleteObject(app->bodyFont_);
            }
            if (app->editBrush_) {
                DeleteObject(app->editBrush_);
            }
            app->stopModules();
            PostQuitMessage(0);
            return 0;

        default:
            break;
    }

    return DefWindowProcW(hwnd, msg, wparam, lparam);
}

}  // namespace macro
