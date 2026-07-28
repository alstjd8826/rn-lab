#include <jni.h>
#include "NitroTimerActivityOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::timeractivity::initialize(vm);
}
