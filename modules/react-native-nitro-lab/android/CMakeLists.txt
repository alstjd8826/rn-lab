cmake_minimum_required(VERSION 3.9.0)
project(NitroLab)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(NitroLab SHARED src/main/cpp/cpp-adapter.cpp)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroLab+autolinking.cmake)

find_library(LOG_LIB log)
target_link_libraries(NitroLab ${LOG_LIB} android)
