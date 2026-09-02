cmake_minimum_required(VERSION 3.16)
project(MacroSystem VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(MACRO_CORE_SOURCES
    src/common.cpp
    src/input_simulator.cpp
    src/screen_analyzer.cpp
    src/fall_detector.cpp
    src/stunslam_bot.cpp
    src/pearlcatch_macros.cpp
    src/anchor_macros.cpp
    src/elytra_unequip.cpp
    src/auto_totem_bot.cpp
    src/game_state_guard.cpp
    src/macro_manager.cpp
)

add_executable(MacroSystem
    src/main.cpp
    ${MACRO_CORE_SOURCES}
)

add_executable(MacroSystemGUI WIN32
    src/gui_main.cpp
    src/gui_app.cpp
    ${MACRO_CORE_SOURCES}
)

foreach(target MacroSystem MacroSystemGUI)
    target_include_directories(${target} PRIVATE include)
    if(WIN32 OR CMAKE_CROSSCOMPILING)
        target_link_libraries(${target} PRIVATE user32 gdi32)
    endif()
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4 /permissive-)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()

if(WIN32 OR CMAKE_CROSSCOMPILING)
    target_link_libraries(MacroSystemGUI PRIVATE gdiplus comctl32 ole32 uuid)
    if(MSVC)
        set_target_properties(MacroSystemGUI PROPERTIES WIN32_EXECUTABLE TRUE)
    endif()
    if(CMAKE_CROSSCOMPILING)
        target_compile_definitions(MacroSystemGUI PRIVATE UNICODE _UNICODE)
        target_compile_options(MacroSystemGUI PRIVATE -municode)
        target_link_options(MacroSystemGUI PRIVATE -mwindows -municode -static-libgcc -static-libstdc++)
        target_link_options(MacroSystem PRIVATE -static-libgcc -static-libstdc++)
    endif()
endif()
