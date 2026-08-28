cmake_minimum_required(VERSION 3.16)
project(MacroSystem VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(MacroSystem
    src/main.cpp
    src/common.cpp
    src/input_simulator.cpp
    src/screen_analyzer.cpp
    src/trigger_bot.cpp
    src/sequence_macro.cpp
)

target_include_directories(MacroSystem PRIVATE include)

if(WIN32)
    target_link_libraries(MacroSystem PRIVATE user32 gdi32)
endif()

if(MSVC)
    target_compile_options(MacroSystem PRIVATE /W4 /permissive-)
else()
    target_compile_options(MacroSystem PRIVATE -Wall -Wextra -Wpedantic)
endif()
