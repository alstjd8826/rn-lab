import { StatusBar } from 'expo-status-bar'
import {
  useCallback,
  useRef,
  useState,
  type ComponentRef,
  type ComponentType,
} from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import FluidHeightFieldDemo from './src/FluidHeightFieldDemo'
import FluidNavierStokesDemo from './src/FluidNavierStokesDemo'
import FluidParticlesDemo from './src/FluidParticlesDemo'
import FluidWebViewDemo from './src/FluidWebViewDemo'
import GestureDemo from './src/GestureDemo'
import GpuPingPongTest from './src/GpuPingPongTest'
import LayoutTransitionDemo from './src/LayoutTransitionDemo'
import LearnHome from './src/learn/LearnHome'
import { ScrollToTopContext } from './src/learn/scrollContext'
import NitroLabDemo from './src/NitroLabDemo'
import ReanimatedDemo from './src/ReanimatedDemo'
import RippleReanimatedDemo from './src/RippleReanimatedDemo'
import RippleSkiaDemo from './src/RippleSkiaDemo'

// 한 번에 하나만 마운트 → 데모별 per-frame 루프가 동시에 안 돌아 크래시 방지.
const DEMOS: { title: string; Component: ComponentType }[] = [
  { title: '📚 RN 학습 — 새 구조 익히기', Component: LearnHome },
  { title: '🧪 Nitro Lab + Live Timer', Component: NitroLabDemo },
  { title: '🌀 Reanimated 4', Component: ReanimatedDemo },
  { title: '👆 제스처 드래그+스프링', Component: GestureDemo },
  { title: '🧩 레이아웃 트랜지션', Component: LayoutTransitionDemo },
  { title: '🌊 A · Reanimated 링 리플', Component: RippleReanimatedDemo },
  { title: '🌊 B · Skia 셰이더 물결', Component: RippleSkiaDemo },
  { title: '💧 ① Skia height-field 물결', Component: FluidHeightFieldDemo },
  { title: '🧪 GPU ping-pong 원시', Component: GpuPingPongTest },
  { title: '🌊 2a · Skia 유체 (advection)', Component: FluidNavierStokesDemo },
  { title: '🌫️ 2b · WebView 유체', Component: FluidWebViewDemo },
  { title: '💦 #3 · 입자 물 (SPH-lite)', Component: FluidParticlesDemo },
]

export default function App() {
  const [active, setActive] = useState<number | null>(null)
  const current = active === null ? null : DEMOS[active]

  // 데모 슬롯의 ScrollView 는 화면이 바뀌어도 재사용된다.
  // 안쪽에서 화면을 전환할 때(예: 학습 목차 → 레슨) 스크롤을 올릴 수 있게 내려준다.
  const demoScroll = useRef<ComponentRef<typeof ScrollView> | null>(null)
  const scrollToTop = useCallback(() => {
    demoScroll.current?.scrollTo({ y: 0, animated: false })
  }, [])

  return (
    <GestureHandlerRootView style={styles.root}>
      {current === null ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.menu}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.header}>🧪 RN Lab</Text>
          {DEMOS.map((d, i) => (
            <Pressable
              key={d.title}
              style={styles.item}
              onPress={() => setActive(i)}
            >
              <Text style={styles.itemText}>{d.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          ref={demoScroll}
          style={styles.root}
          contentContainerStyle={styles.demo}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.back} onPress={() => setActive(null)}>
            <Text style={styles.backText}>← 목록</Text>
          </Pressable>
          <ScrollToTopContext.Provider value={scrollToTop}>
            <current.Component />
          </ScrollToTopContext.Provider>
        </ScrollView>
      )}
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  menu: { padding: 20, paddingTop: 64, gap: 10 },
  header: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  item: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  itemText: { fontSize: 17, fontWeight: '600' },
  demo: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 56,
    gap: 8,
  },
  back: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  backText: { fontSize: 17, fontWeight: '600', color: '#2563eb' },
})
