import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Nitro 놀이터 스펙 — sync(string/number) + async(Promise) 를 한 번에 검증.
 */
export interface Lab extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** 동기 · 문자열 */
  hello(name: string): string
  /** 동기 · 숫자 (number → Double) */
  add(a: number, b: number): number
  /** 비동기 · Promise<void> */
  delay(ms: number): Promise<void>
}
