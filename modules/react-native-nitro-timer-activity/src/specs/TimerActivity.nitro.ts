import type { HybridObject } from 'react-native-nitro-modules'

export interface TimerActivityState {
  title: string
  /** 카운트다운 종료 시각(epoch ms). OS 가 이 값으로 라이브 타이머를 렌더 → 초단위 갱신 불필요 */
  endTimeEpochMs: number
}

/**
 * 라이브 타이머 — iOS Live Activity(Dynamic Island) / Android ongoing 알림.
 * 앱 포그라운드에서 로컬 start(푸시 불필요), 카운트다운은 OS 담당.
 */
export interface TimerActivity
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** iOS 16.1+ & 활성화 여부 (Android 는 항상 true) */
  isSupported(): boolean
  /** 시작 → activityId(iOS)/notificationId(Android) */
  start(state: TimerActivityState): Promise<string>
  /** 종료 시각 연장 등 갱신 */
  update(id: string, state: TimerActivityState): Promise<void>
  /** 종료 */
  end(id: string): Promise<void>
}
