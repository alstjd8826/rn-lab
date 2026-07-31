import {
  Canvas,
  Fill,
  Shader,
  Skia,
  useClock,
} from '@shopify/react-native-skia'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useDerivedValue, useSharedValue } from 'react-native-reanimated'

const MAX = 8 // 동시에 살아있는 파원 최대 개수 (링버퍼)
const H = 300

// SkSL 프래그먼트 셰이더: 픽셀마다 활성 파원들의 파동을 "합산" → 겹치면 간섭.
// origins[i]=파원 좌표, starts[i]=발생 시각(초). age로 확장반경/감쇠 계산.
const source = Skia.RuntimeEffect.Make(`
uniform float time;
uniform float2 origins[${MAX}];
uniform float starts[${MAX}];

half4 main(float2 fragCoord) {
  float2 uv = fragCoord;
  float h = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    float age = time - starts[i];
    if (age < 0.0 || age > 4.0) { continue; }   // 비활성/만료
    float d = distance(uv, origins[i]);
    float radius = age * 120.0;                  // 파면이 바깥으로 확장
    float front = exp(-pow((d - radius) / 26.0, 2.0)); // 파면 부근만
    float wave = sin((d - radius) * 0.18);       // 파면 근처 잔물결
    float decay = exp(-age * 1.0);               // 시간 감쇠
    h += front * wave * decay;                   // 합산 = 간섭
  }
  float n = clamp(h, -1.0, 1.0) * 0.5 + 0.5;
  half3 deep = half3(0.03, 0.09, 0.16);
  half3 crest = half3(0.30, 0.72, 0.95);
  half3 col = mix(deep, crest, half(n));
  return half4(col, 1.0);
}
`)!

export default function RippleSkiaDemo() {
  const { width: winW } = useWindowDimensions()
  const W = winW - 48 // 스크롤뷰 padding 24*2 보정

  const clock = useClock() // SharedValue<number> (ms)
  const origins = useSharedValue<number[]>(new Array(MAX * 2).fill(0))
  const starts = useSharedValue<number[]>(new Array(MAX).fill(-999))
  const idx = useSharedValue(0)

  const uniforms = useDerivedValue(() => ({
    time: clock.value / 1000,
    origins: origins.value,
    starts: starts.value,
  }))

  const tap = Gesture.Tap().onStart((e) => {
    const i = idx.value
    const o = [...origins.value]
    o[i * 2] = e.x
    o[i * 2 + 1] = e.y
    origins.value = o
    const s = [...starts.value]
    s[i] = clock.value / 1000
    starts.value = s
    idx.value = (i + 1) % MAX
  })

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌊 B · Skia 셰이더 물결</Text>
      <Text style={styles.hint}>탭한 지점서 파동 발생 · 여러 번 = 실제 간섭</Text>
      <GestureDetector gesture={tap}>
        <Canvas style={{ width: W, height: H, borderRadius: 12 }}>
          <Fill>
            <Shader source={source} uniforms={uniforms} />
          </Fill>
        </Canvas>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 13, color: '#555' },
})
