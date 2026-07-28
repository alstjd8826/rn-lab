package com.margelo.nitro.nitrolab

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

// `npx nitrogen` 후 생성되는 HybridLabSpec 을 상속.
@Keep
@DoNotStrip
class HybridLab : HybridLabSpec() {
  override fun hello(name: String): String = "Hello, $name! (from Nitro/Kotlin)"

  override fun add(a: Double, b: Double): Double = a + b

  override fun delay(ms: Double): Promise<Unit> = Promise.async {
    kotlinx.coroutines.delay(ms.toLong())
  }
}
