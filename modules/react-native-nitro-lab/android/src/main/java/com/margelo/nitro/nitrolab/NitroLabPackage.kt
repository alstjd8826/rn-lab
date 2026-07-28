package com.margelo.nitro.nitrolab

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

// Nitro-only 모듈이 RN CLI android autolinking 에 잡히도록 하는 빈 TurboReactPackage.
class NitroLabPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider { emptyMap() }

  companion object {
    init {
      NitroLabOnLoad.initializeNative()
    }
  }
}
