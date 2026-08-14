import NativeJsiLab from './specs/NativeJsiLab'

/**
 * global.__jsiLab 의 모양.
 *
 * 주의: 이 타입은 순전히 손으로 적은 것이다. Codegen 을 안 거쳤으니
 * 타입 계약을 강제해주는 사람이 아무도 없다 — 오타가 나면 런타임에
 * undefined 다. ④ Codegen 편에서 이 문제를 다룬다.
 */
export type JsiLab = {
  readonly kind: string
  add(a: number, b: number): number
  bufferAddress(buffer: ArrayBuffer): string
  fillBuffer(buffer: ArrayBuffer, byte: number): number
  sumBuffer(buffer: ArrayBuffer): number
  blockJsThread(ms: number): number
}

declare const global: Record<string, unknown>

let cached: JsiLab | null = null

/** C++ TurboModule 을 호출해 HostObject 를 전역에 설치하고 그걸 돌려준다. */
export function installJsiLab(): JsiLab {
  if (cached) return cached

  NativeJsiLab.install()

  const lab = global.__jsiLab as JsiLab | undefined
  if (!lab) {
    throw new Error('JSI HostObject 설치 실패 — global.__jsiLab 이 없습니다')
  }
  cached = lab
  return lab
}

/** 옛 브릿지(MessageQueue)의 흔적이 남아있는지. bridgeless 면 없다. */
export function isBridgeless(): boolean {
  return global.__fbBatchedBridge === undefined
}

/** Hermes 로 돌고 있는지. HermesInternal 자체가 JSI 로 심어진 객체다. */
export function isHermes(): boolean {
  return global.HermesInternal !== undefined
}
