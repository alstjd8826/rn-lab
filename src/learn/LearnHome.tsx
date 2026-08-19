import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LESSONS } from './lessons'
import { LessonView } from './LessonView'
import { useScrollToTop } from './scrollContext'
import { C, MONO } from './theme'

// RN 학습 교재. 목차 → 레슨 본문.
// App.tsx 의 단일 슬롯 라우터에 그대로 꽂히도록 내부 상태로 화면을 관리한다.
export default function LearnHome() {
  const [slug, setSlug] = useState<string | null>(null)
  const lesson = LESSONS.find((l) => l.slug === slug) ?? null
  const back = useCallback(() => setSlug(null), [])
  const scrollToTop = useScrollToTop()

  // 목차 → 레슨, 레슨 → 목차 모두 맨 위에서 시작해야 한다.
  useEffect(() => {
    scrollToTop()
  }, [slug, scrollToTop])

  if (lesson) return <LessonView lesson={lesson} onBack={back} />

  const done = LESSONS.filter((l) => l.chapters).length

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.eyebrow}>RN LAB · 학습</Text>
        <Text style={s.title}>React Native 새 구조 익히기</Text>
        <Text style={s.sub}>
          브릿지가 사라진 자리에 뭐가 들어왔는지, 이 앱 안의 실제 코드로 따라갑니다.
        </Text>
        <View style={s.progress}>
          <View style={[s.progressFill, { flex: done }]} />
          <View style={{ flex: LESSONS.length - done }} />
        </View>
        <Text style={s.progressText}>
          {done} / {LESSONS.length} 편 준비됨
        </Text>
      </View>

      <View style={s.list}>
        {LESSONS.map((l) => {
          const ready = Boolean(l.chapters)
          return (
            <Pressable
              key={l.slug}
              disabled={!ready}
              onPress={() => setSlug(l.slug)}
              style={({ pressed }) => [
                s.item,
                !ready && s.itemLocked,
                pressed && ready && s.itemPressed,
              ]}
            >
              <Text style={[s.no, !ready && s.noLocked]}>{l.no}</Text>
              <View style={s.itemBody}>
                <Text style={[s.itemTitle, !ready && s.textLocked]}>
                  {l.title}
                </Text>
                <Text style={[s.itemSummary, !ready && s.textLocked]}>
                  {l.summary}
                </Text>
                {!ready && l.comingUp ? (
                  <Text style={s.coming}>{l.comingUp}</Text>
                ) : null}
              </View>
              {ready ? <Text style={s.go}>›</Text> : <Text style={s.soon}>준비중</Text>}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 22, paddingTop: 34 },

  head: { gap: 8 },
  eyebrow: {
    fontFamily: MONO,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: C.ink3,
    fontWeight: '700',
  },
  title: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5, lineHeight: 33 },
  sub: { fontSize: 14.5, lineHeight: 22, color: C.ink2 },
  progress: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: C.surface2,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: { backgroundColor: C.js },
  progressText: { fontFamily: MONO, fontSize: 10.5, color: C.ink3 },

  list: { gap: 9 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 9,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: C.bg,
  },
  itemPressed: { backgroundColor: C.surface2 },
  itemLocked: { backgroundColor: C.surface, borderColor: C.surface2 },
  no: { fontSize: 19, color: C.js, width: 24, fontWeight: '700' },
  noLocked: { color: C.ink3 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 16.5, fontWeight: '800', color: C.ink },
  itemSummary: { fontSize: 13.5, lineHeight: 20, color: C.ink2 },
  textLocked: { color: C.ink3 },
  coming: {
    fontSize: 12.5,
    lineHeight: 19,
    color: C.ink3,
    marginTop: 5,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  go: { fontSize: 22, color: C.ink3, lineHeight: 24 },
  soon: { fontFamily: MONO, fontSize: 9.5, color: C.ink3, letterSpacing: 0.5 },
})
