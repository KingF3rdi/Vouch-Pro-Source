#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

namespace macro {

/// Globale Tastenbelegung – gilt fuer alle Module.
struct GlobalBindings {
    WORD inventoryKey{'E'};
    WORD offhandSwapKey{'F'};
    WORD useKey{'R'};
    WORD attackSlotKey{'1'};
};

}  // namespace macro
