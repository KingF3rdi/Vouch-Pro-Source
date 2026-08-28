@echo off
setlocal

if not exist build mkdir build
cd build

cmake .. -G "Visual Studio 17 2022" -A x64
if errorlevel 1 exit /b 1

cmake --build . --config Release
if errorlevel 1 exit /b 1

echo.
echo Build erfolgreich:
echo   build\Release\MacroSystemGUI.exe  (GUI)
echo   build\Release\MacroSystem.exe       (Konsole)
