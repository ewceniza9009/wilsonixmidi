cmake_minimum_required(VERSION 3.22.1)
project(wilsonix-audio LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(wilsonix-audio SHARED wilsonix-audio-engine.cpp)

# Oboe ships as a Prefab package inside its Maven AAR
# (implementation 'com.google.oboe:oboe:...' + buildFeatures.prefab true).
find_package(oboe REQUIRED CONFIG)

target_link_libraries(wilsonix-audio PRIVATE oboe::oboe log)
