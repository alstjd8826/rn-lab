import { useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

export default function ReanimatedDemo() {
  // ── 1) 클래식 워클릿 API: 탭하면 스프링으로 좌우 이동 ──
  const offset = useSharedValue(0)
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }))
  const toggleSlide = () => {
    offset.value = withSpring(offset.value === 0 ? 120 : 0, {
      damping: 12,
      stiffness: 120,
    })
  }

  // ── 2) 워클릿 + 무한 반복: 계속 회전 ──
  const rot = useSharedValue(0)
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 2000 }), -1, false)
  }, [rot])
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }))

  // ── 3) RN4 CSS 애니메이션: style 에 키프레임 직접 선언 ──
  const [pulsing, setPulsing] = useState(true)

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌀 Reanimated 4</Text>

      <Text style={styles.label}>① 워클릿 스프링 (탭)</Text>
      <View style={styles.stage}>
        <Animated.View style={[styles.box, styles.blue, slideStyle]} />
      </View>
      <View style={styles.btn}>
        <Button title="이동/복귀" onPress={toggleSlide} />
      </View>

      <Text style={styles.label}>② 워클릿 무한 회전</Text>
      <View style={styles.stage}>
        <Animated.View style={[styles.box, styles.green, spinStyle]} />
      </View>

      <Text style={styles.label}>③ RN4 CSS 키프레임 애니메이션</Text>
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.box,
            styles.purple,
            pulsing && {
              animationName: {
                '0%': { transform: [{ scale: 1 }], opacity: 1 },
                '50%': { transform: [{ scale: 1.4 }], opacity: 0.5 },
                '100%': { transform: [{ scale: 1 }], opacity: 1 },
              },
              animationDuration: '1.2s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            },
          ]}
        />
      </View>
      <View style={styles.btn}>
        <Button
          title={pulsing ? '펄스 정지' : '펄스 시작'}
          onPress={() => setPulsing((p) => !p)}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 14, color: '#555', marginTop: 8 },
  stage: {
    alignSelf: 'stretch',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: { width: 56, height: 56, borderRadius: 12 },
  blue: { backgroundColor: '#3498db' },
  green: { backgroundColor: '#27ae60' },
  purple: { backgroundColor: '#8e44ad' },
  btn: { marginTop: 4 },
})
