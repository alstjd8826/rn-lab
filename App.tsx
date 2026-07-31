import { StatusBar } from 'expo-status-bar'
import { useRef, useState } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import { add, delay, hello } from 'react-native-nitro-lab'
import {
  endTimer,
  isTimerActivitySupported,
  startTimer,
} from 'react-native-nitro-timer-activity'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import GestureDemo from './src/GestureDemo'
import LayoutTransitionDemo from './src/LayoutTransitionDemo'
import ReanimatedDemo from './src/ReanimatedDemo'
import FluidHeightFieldDemo from './src/FluidHeightFieldDemo'
import RippleReanimatedDemo from './src/RippleReanimatedDemo'
import RippleSkiaDemo from './src/RippleSkiaDemo'

export default function App() {
  const [greeting] = useState(() => hello('Nitro'))
  const [sum] = useState(() => add(2, 3))
  const [delayMsg, setDelayMsg] = useState('아직 안 함')

  const [timerIds, setTimerIds] = useState<string[]>([])
  const [timerMsg, setTimerMsg] = useState(
    isTimerActivitySupported() ? '지원됨' : '미지원(iOS 16.2+/활성화 필요)',
  )
  const seqRef = useRef(0)

  const runDelay = async () => {
    setDelayMsg('대기 중…')
    const start = Date.now()
    await delay(800)
    setDelayMsg(`delay(800) 완료 · 실측 ${Date.now() - start}ms`)
  }

  // 다중: 누를 때마다 새 타이머 추가 (서로 다른 길이/이름으로 구분)
  const addTimer = async () => {
    try {
      const n = (seqRef.current += 1)
      const seconds = 20 + n * 10 // 30, 40, 50…
      const id = await startTimer({
        title: `타이머 ${n}`,
        endTimeEpochMs: Date.now() + seconds * 1000,
      })
      setTimerIds((prev) => [...prev, id])
      setTimerMsg(`타이머 ${n} 시작 (${seconds}초)`)
      // 0초 도달 시 자동 종료 (앱이 떠 있을 때만 fire).
      // 앱이 완전 종료 상태면 안 불림 → 네이티브 staleDate 로 보완(아래 설명).
      setTimeout(() => {
        endTimer(id)
        setTimerIds((prev) => prev.filter((x) => x !== id))
      }, seconds * 1000)
    } catch (e) {
      setTimerMsg(`실패: ${String(e)}`)
    }
  }

  const stopAll = async () => {
    await Promise.all(timerIds.map((id) => endTimer(id)))
    setTimerIds([])
    setTimerMsg('전체 종료됨')
  }

  return (
    <GestureHandlerRootView style={styles.scroll}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>🧪 Nitro Lab</Text>
      <Text style={styles.line}>hello: {greeting}</Text>
      <Text style={styles.line}>add(2,3): {sum}</Text>
      <Text style={styles.line}>delay: {delayMsg}</Text>
      <View style={styles.btn}>
        <Button title="delay(800) 실행" onPress={runDelay} />
      </View>

      <View style={styles.divider} />

      <Text style={styles.title}>⏱️ Live Timer (다중)</Text>
      <Text style={styles.line}>{timerMsg}</Text>
      <Text style={styles.line}>활성: {timerIds.length}개</Text>
      <View style={styles.btn}>
        <Button title="타이머 추가" onPress={addTimer} />
      </View>
      <View style={styles.btn}>
        <Button title="전체 종료" color="#c0392b" onPress={stopAll} />
      </View>

      <View style={styles.divider} />

      <ReanimatedDemo />

      <View style={styles.divider} />

      <GestureDemo />

      <View style={styles.divider} />

      <LayoutTransitionDemo />

      <View style={styles.divider} />

      <RippleReanimatedDemo />

      <View style={styles.divider} />

      <RippleSkiaDemo />

      <View style={styles.divider} />

      <FluidHeightFieldDemo />

      <StatusBar style="auto" />
      </ScrollView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 64,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  line: { fontSize: 16, textAlign: 'center' },
  btn: { marginTop: 8 },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: '#eee',
    marginVertical: 20,
  },
})
