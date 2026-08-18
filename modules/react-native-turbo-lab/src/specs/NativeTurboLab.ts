import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * "모듈이 언제 만들어지는가" 를 관찰하기 위한 TurboModule.
 *
 * 핵심은 `getCreatedAtMs` 다. 이 값이 0 에 가까우면 앱 시작 때 만들어진 것이고,
 * 버튼을 누른 시점과 비슷하면 **그때 처음 만들어진 것**이다.
 */
export interface Spec extends TurboModule {
  /** 네이티브 라이브러리 로드 후 이 모듈 인스턴스가 생성되기까지 걸린 ms */
  readonly getCreatedAtMs: () => number
  /** 지금이 로드 후 몇 ms 인지 */
  readonly getUptimeMs: () => number
  /** 호출할 때마다 1 증가 */
  readonly ping: () => number
  /** 지금까지 ping 이 몇 번 불렸는지 */
  readonly getPingCount: () => number
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeTurboLab')
