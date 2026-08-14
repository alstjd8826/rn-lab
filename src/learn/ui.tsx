import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { C, MONO, SIDE_COLOR, SIDE_LABEL, type Side } from './theme'

/** **굵게** 표기를 실제 굵은 글씨로 바꿔 렌더한다. */
export function RichText({
  text,
  style,
}: {
  text: string
  style?: object
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <Text style={[s.prose, style]}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={s.strong}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  )
}

export function Chip({ side }: { side: Exclude<Side, 'none'> }) {
  const c = SIDE_COLOR[side]
  return (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      <Text style={[s.chipText, { color: c.fg }]}>{SIDE_LABEL[side]}</Text>
    </View>
  )
}

export function PathTag({ path }: { path: string }) {
  return <Text style={s.path}>{path}</Text>
}

/** 가로 스크롤되는 코드 블록. 줄 강조 지원. */
export function Code({
  code,
  highlight = [],
  path,
  caption,
}: {
  code: string
  highlight?: number[]
  path?: string
  caption?: string
}) {
  const lines = code.replace(/\n$/, '').split('\n')
  return (
    <View style={s.codeWrap}>
      {path ? <Text style={s.codePath}>{path}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.codeBody}>
          {lines.map((line, i) => {
            const on = highlight.includes(i)
            return (
              <View key={i} style={[s.codeLine, on && s.codeLineOn]}>
                <Text style={[s.codeText, on && s.codeTextOn]}>
                  {line === '' ? ' ' : line}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  )
}

export function Callout({
  tone,
  title,
  text,
}: {
  tone: 'info' | 'warn' | 'key'
  title?: string
  text: string
}) {
  const map = {
    info: { bar: C.struct, bg: C.structSoft, label: C.struct },
    warn: { bar: C.warn, bg: C.warnSoft, label: C.warn },
    key: { bar: C.js, bg: C.jsSoft, label: C.js },
  } as const
  const t = map[tone]
  return (
    <View style={[s.callout, { backgroundColor: t.bg, borderLeftColor: t.bar }]}>
      {title ? (
        <Text style={[s.calloutTitle, { color: t.label }]}>{title}</Text>
      ) : null}
      <RichText text={text} style={s.calloutText} />
    </View>
  )
}

export function Compare({
  leftLabel,
  rightLabel,
  rows,
}: {
  leftLabel: string
  rightLabel: string
  rows: { label: string; left: string; right: string }[]
}) {
  return (
    <View style={s.cmp}>
      <View style={s.cmpHead}>
        <Text style={[s.cmpHeadCell, s.cmpLabelCol]} />
        <Text style={[s.cmpHeadCell, s.cmpCol, { color: C.ink3 }]}>
          {leftLabel}
        </Text>
        <Text style={[s.cmpHeadCell, s.cmpCol, { color: C.js }]}>
          {rightLabel}
        </Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.cmpRow, i === rows.length - 1 && s.cmpRowLast]}>
          <Text style={[s.cmpLabel, s.cmpLabelCol]}>{r.label}</Text>
          <Text style={[s.cmpCell, s.cmpCol]}>{r.left}</Text>
          <Text style={[s.cmpCell, s.cmpCol, s.cmpCellNew]}>{r.right}</Text>
        </View>
      ))}
    </View>
  )
}

/** 순서 목록. 왼쪽 세로선이 흐름을 잇는다. */
export function Steps({
  flavor,
  steps,
}: {
  flavor: 'build' | 'runtime'
  steps: {
    title: string
    side?: Side
    path?: string
    text: string
    code?: string
    highlight?: number[]
  }[]
}) {
  return (
    <View>
      {steps.map((st, i) => {
        const last = i === steps.length - 1
        const lane =
          st.side && st.side !== 'none' ? SIDE_COLOR[st.side].fg : C.rule
        return (
          <View key={i} style={s.step}>
            <View style={s.stepGutter}>
              <View style={[s.stepDot, { borderColor: lane }]}>
                <Text style={[s.stepNum, { color: lane }]}>
                  {flavor === 'build' ? i + 1 : i}
                </Text>
              </View>
              {!last ? <View style={[s.stepLine, { backgroundColor: lane }]} /> : null}
            </View>

            <View style={s.stepBody}>
              <Text style={s.stepTitle}>{st.title}</Text>
              {(st.side && st.side !== 'none') || st.path ? (
                <View style={s.stepMeta}>
                  {st.side && st.side !== 'none' ? <Chip side={st.side} /> : null}
                  {st.path ? <PathTag path={st.path} /> : null}
                </View>
              ) : null}
              <RichText text={st.text} />
              {st.code ? (
                <Code code={st.code} highlight={st.highlight} />
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export function ChapterHead({
  heading,
  question,
}: {
  heading: string
  question?: string
}) {
  return (
    <View style={s.chHead}>
      <Text style={s.chHeading}>{heading}</Text>
      {question ? <Text style={s.chQuestion}>{question}</Text> : null}
    </View>
  )
}

export function DemoCard({
  title,
  text,
  children,
}: {
  title: string
  text?: string
  children: ReactNode
}) {
  return (
    <View style={s.demo}>
      <Text style={s.demoLabel}>직접 확인</Text>
      <Text style={s.demoTitle}>{title}</Text>
      {text ? <RichText text={text} style={s.demoText} /> : null}
      <View style={s.demoBody}>{children}</View>
    </View>
  )
}

const s = StyleSheet.create({
  prose: { fontSize: 15.5, lineHeight: 25, color: C.ink2 },
  strong: { color: C.ink, fontWeight: '700' },

  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 },
  chipText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },

  path: { fontFamily: MONO, fontSize: 10.5, color: C.ink3, flexShrink: 1 },

  codeWrap: { gap: 6 },
  codePath: { fontFamily: MONO, fontSize: 10.5, color: C.ink3 },
  codeBody: {
    backgroundColor: C.code,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 5,
    paddingVertical: 9,
    minWidth: '100%',
  },
  codeLine: { paddingHorizontal: 11 },
  codeLineOn: {
    backgroundColor: '#E2E9F4',
    borderLeftWidth: 3,
    borderLeftColor: C.native,
    paddingLeft: 8,
  },
  codeText: { fontFamily: MONO, fontSize: 11.5, lineHeight: 19, color: C.ink2 },
  codeTextOn: { color: C.ink, fontWeight: '600' },
  caption: { fontSize: 12.5, lineHeight: 19, color: C.ink3 },

  callout: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 5,
  },
  calloutTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  calloutText: { fontSize: 15, lineHeight: 24 },

  cmp: {
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 5,
    overflow: 'hidden',
  },
  cmpHead: { flexDirection: 'row', backgroundColor: C.surface2 },
  cmpHeadCell: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  cmpRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.rule,
    alignItems: 'flex-start',
  },
  cmpRowLast: {},
  cmpLabelCol: { width: 74 },
  cmpCol: { flex: 1 },
  cmpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cmpCell: {
    fontSize: 11.5,
    lineHeight: 18,
    color: C.ink2,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cmpCellNew: { color: C.ink, fontWeight: '600' },

  step: { flexDirection: 'row', gap: 12 },
  stepGutter: { width: 26, alignItems: 'center' },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  stepNum: { fontSize: 12, fontWeight: '800' },
  stepLine: { width: 2, flex: 1, marginVertical: 3 },
  stepBody: { flex: 1, gap: 7, paddingBottom: 22 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: C.ink, lineHeight: 23 },
  stepMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },

  chHead: { gap: 5, paddingTop: 8 },
  chHeading: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  chQuestion: { fontSize: 13.5, color: C.ink3, lineHeight: 20 },

  demo: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 8,
    padding: 14,
    gap: 7,
  },
  demoLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: C.ink3,
  },
  demoTitle: { fontSize: 16.5, fontWeight: '800', color: C.ink },
  demoText: { fontSize: 14.5, lineHeight: 22 },
  demoBody: { gap: 9, paddingTop: 4 },
})
