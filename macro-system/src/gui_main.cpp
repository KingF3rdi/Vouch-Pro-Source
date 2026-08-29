#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "gui_app.hpp"

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE /*prevInstance*/, PWSTR /*commandLine*/,
                    int /*showCommand*/) {
    macro::GuiApp app;
    return app.run(instance);
}
