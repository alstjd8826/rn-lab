import { useRef, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import Animated, {
  CurvedTransition,
  EntryExitTransition,
  FadeIn,
  FadeOut,
  FadingTransition,
  JumpingTransition,
  LinearTransition,
  SequencedTransition,
} from 'react-native-reanimated'

// 레이아웃 트랜지션 = 아이템 추가/제거/재배치로 위치가 바뀔 때
// 남아있는 뷰들이 새 위치로 이동하는 방식. 종류별로 이동 궤적이 다름.
const TRANSITIONS = {
  Linear: () => LinearTransition.duration(500),
  Curved: () => CurvedTransition.duration(500),
  Sequenced: () => SequencedTransition.duration(500),
  Fading: () => FadingTransition.duration(500),
  Jumping: () => JumpingTransition.duration(500),
  EntryExit: () => EntryExitTransition.duration(500),
} as const
type TransitionName = keyof typeof TRANSITIONS
const NAMES = Object.keys(TRANSITIONS) as TransitionName[]

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#27ae60',
  '#3498db', '#8e44ad', '#16a085', '#d35400',
]

export default function LayoutTransitionDemo() {
  const seq = useRef(0)
  const [items, setItems] = useState<number[]>(() => [0, 1, 2, 3])
  const [tName, setTName] = useState<TransitionName>('Linear')

  const layout = TRANSITIONS[tName]()

  const addItem = () => setItems((p) => [...p, (seq.current += 1) + 100])
  const removeRandom = () =>
    setItems((p) =>
      p.length ? p.filter((_, i) => i !== Math.floor(Math.random() * p.length)) : p,
    )
  const shuffle = () =>
    setItems((p) => [...p].sort(() => Math.random() - 0.5))
  const cycleTransition = () =>
    setTName((n) => NAMES[(NAMES.indexOf(n) + 1) % NAMES.length])

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🧩 레이아웃 트랜지션</Text>
      <Text style={styles.hint}>
        현재: <Text style={styles.bold}>{tName}</Text> · {items.length}개
      </Text>

      <View style={styles.grid}>
        {items.map((id) => (
          <Animated.View
            key={id}
            layout={layout}
            entering={FadeIn}
            exiting={FadeOut}
            style={[styles.box, { backgroundColor: COLORS[id % COLORS.length] }]}
          >
            <Text style={styles.boxText}>{id}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={styles.row}>
        <Button title="추가" onPress={addItem} />
        <Button title="랜덤 제거" onPress={removeRandom} />
        <Button title="섞기" onPress={shuffle} />
      </View>
      <View style={styles.btn}>
        <Button title={`트랜지션 전환 (→ 다음)`} onPress={cycleTransition} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 8, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 14, color: '#555' },
  bold: { fontWeight: '700', color: '#111' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    minHeight: 140,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  box: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { marginTop: 4 },
})
