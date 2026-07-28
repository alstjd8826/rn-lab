package com.margelo.nitro.timeractivity

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

// iOS Live Activity 의 안드 대응 = ongoing 알림(카운트다운 chronometer).
@Keep
@DoNotStrip
class HybridTimerActivity : HybridTimerActivitySpec() {

  private val ctx: Context
    get() = NitroModules.applicationContext
      ?: throw IllegalStateException("NitroModules.applicationContext is null")

  private val channelId = "nitro_timer"

  override fun isSupported(): Boolean = true // ongoing 알림은 API24+ 항상 가능

  // 다중: start 마다 고유 notiId 발급 (고정값이면 서로 덮어씀)
  override fun start(state: TimerActivityState): Promise<String> = Promise.async {
    val id = counter.incrementAndGet()
    post(id, state)
    id.toString()
  }

  override fun update(id: String, state: TimerActivityState): Promise<Unit> = Promise.async {
    post(id.toInt(), state)
  }

  override fun end(id: String): Promise<Unit> = Promise.async {
    nm().cancel(id.toInt())
  }

  private fun post(id: Int, state: TimerActivityState) {
    val nm = nm()
    ensureChannel(nm)
    val builder = Notification.Builder(ctx, channelId)
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(state.title)
      .setOngoing(true)
      // 종료 시각까지 카운트다운
      .setWhen(state.endTimeEpochMs.toLong())
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
    nm.notify(id, builder.build())
  }

  companion object {
    private val counter = java.util.concurrent.atomic.AtomicInteger(1000)
  }

  private fun ensureChannel(nm: NotificationManager) {
    if (nm.getNotificationChannel(channelId) == null) {
      nm.createNotificationChannel(
        NotificationChannel(channelId, "Timer", NotificationManager.IMPORTANCE_LOW),
      )
    }
  }

  private fun nm(): NotificationManager =
    ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
