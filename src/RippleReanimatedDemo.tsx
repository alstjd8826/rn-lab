import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

// A안: 순수 Reanimated 4. 터치 지점에 링(동심원)이 퍼지며 흐려짐.
// 여러 번 누르면 반투명 링이 겹쳐 물결처럼 보임. (진짜 파동 간섭은 아님)
const RING_MAX = 240 // 링 최대 지름(px)
const DURATION = 1100

type Ripple = { id: number; x: number; y: number }

function RippleRing({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const progress = useSharedValue(0)
  // 마운트되면 0→1 로 진행, 끝나면 스스로 제거
  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION }, (finished) => {
      if (finished) runOnJS(onDone)()
    })
  }, [progress, onDone])

  const style = useAnimatedStyle(() => ({
    width: RING_MAX * progress.value,
    height: RING_MAX * progress.value,
    borderRadius: (RING_MAX * progress.value) / 2,
    opacity: 1 - progress.value,
    // 링 중심을 터치 지점에 맞춤
    left: x - (RING_MAX * progress.value) / 2,
    top: y - (RING_MAX * progress.value) / 2,
  }))

  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />
}

export default function RippleReanimatedDemo() {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const seq = useRef(0)

  const addRipple = (x: number, y: number) => {
    const id = (seq.current += 1)
    setRipples((prev) => [...prev, { id, x, y }])
  }
  const removeRipple = (id: number) =>
    setRipples((prev) => prev.filter((r) => r.id !== id))

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌊 A · Reanimated 링 리플</Text>
      <Text style={styles.hint}>탭하면 링이 퍼짐 · 여러 번 = 겹침</Text>
      <Pressable
        style={styles.stage}
        onPressIn={(e) =>
          addRipple(e.nativeEvent.locationX, e.nativeEvent.locationY)
        }
      >
        {ripples.map((r) => (
          <RippleRing
            key={r.id}
            x={r.x}
            y={r.y}
            onDone={() => removeRipple(r.id)}
          />
        ))}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 13, color: '#555' },
  stage: {
    alignSelf: 'stretch',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#0a1a2f',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4fc3f7',
    backgroundColor: 'rgba(79,195,247,0.08)',
  },
})
