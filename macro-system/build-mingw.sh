#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

cmake -B build-mingw -DCMAKE_TOOLCHAIN_FILE=toolchain-mingw64.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build-mingw -j"$(nproc)"

echo ""
echo "Build erfolgreich:"
echo "  build-mingw/MacroSystemGUI.exe"
echo "  build-mingw/MacroSystem.exe"
