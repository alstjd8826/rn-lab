import type { ReactNode } from 'react'
import type { Side } from './theme'

/** 문단. 굵게 강조는 **이렇게** 감싸면 렌더러가 처리한다. */
export type ProseBlock = { kind: 'prose'; text: string }

/** 짧은 코드. 폰 화면이라 5줄 이내를 권장. */
export type CodeBlock = {
  kind: 'code'
  lang?: string
  /** 파일 경로 등 출처 */
  path?: string
  code: string
  /** 강조할 줄 (0부터) */
  highlight?: number[]
  caption?: string
}

/** 비유·요점 강조 */
export type CalloutBlock = {
  kind: 'callout'
  tone: 'info' | 'warn' | 'key'
  title?: string
  text: string
}

/** 옛 방식 vs 새 방식 대조 */
export type CompareBlock = {
  kind: 'compare'
  leftLabel: string
  rightLabel: string
  rows: { label: string; left: string; right: string }[]
}

/** 순서가 의미를 갖는 목록 — 구현 순서 / 동작 순서 */
export type StepsBlock = {
  kind: 'steps'
  /** 'build' = 만드는 순서, 'runtime' = 실행 순서 */
  flavor: 'build' | 'runtime'
  steps: {
    title: string
    side?: Side
    path?: string
    text: string
    code?: string
    highlight?: number[]
  }[]
}

/** 직접 눌러보는 구간 */
export type DemoBlock = {
  kind: 'demo'
  title: string
  text?: string
  render: () => ReactNode
}

export type Block =
  | ProseBlock
  | CodeBlock
  | CalloutBlock
  | CompareBlock
  | StepsBlock
  | DemoBlock

export type Chapter = {
  /** 화면에 보이는 제목 */
  heading: string
  /** 이 장이 답하는 질문 */
  question?: string
  blocks: Block[]
}

export type Lesson = {
  /** ①, ② … 표시용 */
  no: string
  slug: string
  title: string
  /** 한 줄 요약 */
  summary: string
  /** 아직 안 만든 레슨은 chapters 없이 둔다 */
  chapters?: Chapter[]
  /** 이 편을 쓰며 실제로 읽고 대조한 문서. 검증 가능하도록 남긴다 */
  sources?: string[]
  /** 준비중일 때 보여줄 예고 */
  comingUp?: string
}
