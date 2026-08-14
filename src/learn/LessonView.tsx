import { Pressable, StyleSheet, Text, View } from 'react-native'
import { C, MONO } from './theme'
import type { Block, Lesson } from './types'
import {
  Callout,
  ChapterHead,
  Code,
  Compare,
  DemoCard,
  RichText,
  Steps,
} from './ui'

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'prose':
      return <RichText text={block.text} />
    case 'code':
      return (
        <Code
          code={block.code}
          highlight={block.highlight}
          path={block.path}
          caption={block.caption}
        />
      )
    case 'callout':
      return <Callout tone={block.tone} title={block.title} text={block.text} />
    case 'compare':
      return (
        <Compare
          leftLabel={block.leftLabel}
          rightLabel={block.rightLabel}
          rows={block.rows}
        />
      )
    case 'steps':
      return <Steps flavor={block.flavor} steps={block.steps} />
    case 'demo':
      return (
        <DemoCard title={block.title} text={block.text}>
          {block.render()}
        </DemoCard>
      )
  }
}

export function LessonView({
  lesson,
  onBack,
}: {
  lesson: Lesson
  onBack(): void
}) {
  return (
    <View style={s.wrap}>
      <Pressable onPress={onBack} style={s.back} hitSlop={8}>
        <Text style={s.backText}>‹ 목차</Text>
      </Pressable>

      <View style={s.head}>
        <Text style={s.no}>{lesson.no}</Text>
        <Text style={s.title}>{lesson.title}</Text>
        <Text style={s.summary}>{lesson.summary}</Text>
      </View>

      {lesson.chapters?.map((ch, ci) => (
        <View key={ci} style={s.chapter}>
          <ChapterHead heading={ch.heading} question={ch.question} />
          <View style={s.blocks}>
            {ch.blocks.map((b, bi) => (
              <BlockView key={bi} block={b} />
            ))}
          </View>
        </View>
      ))}

      <View style={s.foot}>
        <Text style={s.footText}>
          코드는 이 앱 안에 실제로 있습니다 · modules/react-native-jsi-lab
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  // App.tsx 의 paddingTop(56) 만으로는 다이나믹 아일랜드를 못 피한다.
  wrap: { alignSelf: 'stretch', gap: 4, paddingTop: 34 },
  back: { paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { fontSize: 15.5, fontWeight: '700', color: C.struct },

  head: { gap: 6, paddingBottom: 10 },
  no: { fontSize: 22, color: C.js, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  summary: { fontSize: 15, lineHeight: 23, color: C.ink2 },

  chapter: {
    gap: 13,
    paddingTop: 26,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  blocks: { gap: 15 },

  foot: { marginTop: 34, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.rule },
  footText: { fontFamily: MONO, fontSize: 10.5, color: C.ink3, lineHeight: 17 },
})
