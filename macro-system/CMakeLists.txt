cmake_minimum_required(VERSION 3.16)
project(MacroSystem VERSION 1.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(MACRO_CORE_SOURCES
    src/common.cpp
    src/input_simulator.cpp
    src/screen_analyzer.cpp
    src/fall_detector.cpp
    src/trigger_bot.cpp
    src/sequence_macro.cpp
)

set(MACRO_CORE_HEADERS
    include/common.hpp
    include/input_simulator.hpp
    include/screen_analyzer.hpp
    include/fall_detector.hpp
    include/trigger_bot.hpp
    include/sequence_macro.hpp
    include/app_config.hpp
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
    if(WIN32)
        target_link_libraries(${target} PRIVATE user32 gdi32)
    endif()
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4 /permissive-)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()

if(WIN32)
    target_link_libraries(MacroSystemGUI PRIVATE gdiplus comctl32 ole32)
    if(MSVC)
        set_target_properties(MacroSystemGUI PROPERTIES WIN32_EXECUTABLE TRUE)
    endif()
endif()
