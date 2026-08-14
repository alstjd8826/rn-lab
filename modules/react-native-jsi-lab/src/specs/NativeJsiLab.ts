import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * 순수 C++ TurboModule 스펙.
 *
 * 파일명에 `Native` 접두어가 없으면 Codegen 이 무시한다.
 *
 * 이 모듈의 역할은 딱 하나 — 네이티브에서 `jsi::Runtime&` 을 받아
 * `global.__jsiLab` 에 HostObject 를 심는 것. 실제 기능은 전부
 * 그 HostObject 쪽에 있고, 그건 Codegen 을 안 거친 raw JSI 다.
 */
export interface Spec extends TurboModule {
  readonly install: () => boolean
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeJsiLab')
