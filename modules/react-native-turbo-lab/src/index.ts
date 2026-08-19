import type { Spec } from './specs/NativeTurboLab'

/**
 * ★ 중요 ★
 *
 * spec 파일 안의 `TurboModuleRegistry.getEnforcing(...)` 는
 * **그 파일이 import 되는 순간** 실행된다. 그리고 그 호출이 곧
 * 네이티브 인스턴스 생성을 유발한다.
 *
 * 그래서 여기서 `import ... from './specs/NativeTurboLab'` 을 쓰면
 * 이 파일을 import 하는 것만으로 모듈이 만들어져 버리고,
 * "언제 만들어지는가" 실험이 무의미해진다.
 *
 * 그래서 실제 참조를 **처음 쓸 때까지 미룬다.**
 */
let cached: Spec | null = null

function mod(): Spec {
  if (cached === null) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('./specs/NativeTurboLab').default as Spec
  }
  return cached
}

/** 아직 한 번도 안 불렸는지 (JS 쪽 기준) */
export function isResolvedInJs(): boolean {
  return cached !== null
}

export const turboLab = {
  getCreatedAtMs: () => mod().getCreatedAtMs(),
  getUptimeMs: () => mod().getUptimeMs(),
  ping: () => mod().ping(),
  getPingCount: () => mod().getPingCount(),
  add: (a: number, b: number) => mod().add(a, b),
}
