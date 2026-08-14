// 학습 화면 공용 토큰.
// 색이 의미를 나릅니다 — JS 쪽은 틸, 네이티브 쪽은 코퍼, 구조/생성물은 슬레이트.
export const C = {
  bg: '#FFFFFF',
  surface: '#F7F8FA',
  surface2: '#EFF1F5',
  code: '#F2F4F8',
  ink: '#14161B',
  ink2: '#4A5160',
  ink3: '#828A99',
  rule: '#E3E7ED',

  js: '#0B6E75',
  jsSoft: '#E2F1F2',
  native: '#A15A1B',
  nativeSoft: '#F8EEE2',
  struct: '#2E4A7D',
  structSoft: '#E9EEF7',

  warn: '#9A3412',
  warnSoft: '#FBEEE7',
  ok: '#1A7F37',
  okSoft: '#E6F4EA',
} as const

export const MONO = 'Menlo'

export type Side = 'js' | 'native' | 'gen' | 'none'

export const SIDE_LABEL: Record<Exclude<Side, 'none'>, string> = {
  js: 'JS',
  native: '네이티브',
  gen: '자동 생성',
}

export const SIDE_COLOR: Record<Exclude<Side, 'none'>, { fg: string; bg: string }> = {
  js: { fg: C.js, bg: C.jsSoft },
  native: { fg: C.native, bg: C.nativeSoft },
  gen: { fg: C.struct, bg: C.structSoft },
}
