#include <jni.h>
#include "NitroLabOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitrolab::initialize(vm);
}
