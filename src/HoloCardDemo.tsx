import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  useImage,
} from '@shopify/react-native-skia'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

// 포켓몬 홀로 카드 (rare holo) — poke-holo.simey.me 를 RN 으로 옮긴 것.
//
//  원본은 CSS 다.  레이어를 5겹 쌓고 각 겹에 filter + mix-blend-mode 를 걸어서
//  홀로그램을 만든다.  RN 의 View 에는 blend-mode 가 없어서 그 방식은 못 쓴다.
//  대신 Skia 의 SkSL 프래그먼트 셰이더 하나에 5겹을 전부 계산해 넣었다.
//  → CSS 는 "레이어를 쌓아 합성", 여기는 "픽셀 하나의 최종 색을 직접 계산".
//
//  원본에서 그대로 가져온 수치 (public/css/cards/regular-holo.css, base.css, cards.css):
//   · 무지개 5색       #c929f1 #0dbde9 #21e985 #eedf10 #f80e35
//   · 무지개 각도/배율  110deg, background-size 400%, position 배율 2.6 / 3.5
//   · 스캔라인         1px 간격 black/#666  (모바일은 .5px)
//   · shine 필터       brightness(1.1) contrast(1.1) saturate(1.2) → color-dodge
//   · 세로 바 (:before) 3% 단위, screen → brightness(1.15) contrast(1.1) → hard-light
//   · 광택 (:after)    포인터 기준 radial → brightness(.6) contrast(4) → luminosity
//   · glare            포인터 기준 radial → overlay ×2겹
//   · 홀로 영역        inset(9.85% 8% 52.85% 8%)  = 카드 그림창만
//   · 기울기           rotate = (포인터 - 50) / 3.5, perspective 600px
const ASPECT = 0.718 // 원본 --card-aspect

const SOURCE = Skia.RuntimeEffect.Make(`
uniform shader card;
uniform float2 res;      // 캔버스 크기(px)
uniform float2 pointer;  // 포인터 위치 0..1
uniform float2 bgp;      // --background-x/y (퍼센트, 37~63 / 33~67)
uniform float opacity;   // --card-opacity 0..1 — 0이면 평범한 카드
uniform float scan;      // 스캔라인 간격(px)
uniform float stage;     // 1 = 진화(Stage) 카드용 계단 클립

const float3 VIOLET = float3(0.7882, 0.1608, 0.9451);
const float3 BLUE   = float3(0.0510, 0.7412, 0.9137);
const float3 GREEN  = float3(0.1294, 0.9137, 0.5216);
const float3 YELLOW = float3(0.9333, 0.8745, 0.0627);
const float3 RED    = float3(0.9725, 0.0549, 0.2078);

// ---- CSS 블렌드 모드 ----
float3 bScreen(float3 b, float3 s) { return b + s - b * s; }

float cd(float b, float s) { return s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float3 bColorDodge(float3 b, float3 s) {
  return float3(cd(b.r, s.r), cd(b.g, s.g), cd(b.b, s.b));
}

float hl(float b, float s) {
  return s <= 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
}
float3 bHardLight(float3 b, float3 s) {
  return float3(hl(b.r, s.r), hl(b.g, s.g), hl(b.b, s.b));
}
// overlay 는 hard-light 의 인자를 뒤집은 것
float3 bOverlay(float3 b, float3 s) { return bHardLight(s, b); }

float lum(float3 c) { return dot(c, float3(0.3, 0.59, 0.11)); }
float3 clipColor(float3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / max(l - n, 1e-6); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6); }
  return c;
}
float3 bLuminosity(float3 b, float3 s) {
  return clipColor(b + (lum(s) - lum(b)));
}

// ---- CSS 필터 ----
float3 fBright(float3 c, float k) { return c * k; }
float3 fContrast(float3 c, float k) { return (c - 0.5) * k + 0.5; }
float3 fSat(float3 c, float k) {
  float l = dot(c, float3(0.2126, 0.7152, 0.0722));
  return mix(float3(l), c, k);
}

// 무지개: 5색이 순환. t 1당 한 바퀴.
float3 rainbow(float t) {
  float u = fract(t) * 5.0;
  int i = int(floor(u));
  float f = fract(u);
  float3 a = i == 0 ? VIOLET : i == 1 ? BLUE : i == 2 ? GREEN : i == 3 ? YELLOW : RED;
  float3 b = i == 0 ? BLUE : i == 1 ? GREEN : i == 2 ? YELLOW : i == 3 ? RED : VIOLET;
  return mix(a, b, f);
}

// 3스톱 그라디언트. CSS 처럼 알파를 곱한 상태로 보간한다.
float4 grad3(float t, float4 c0, float p0, float4 c1, float p1, float4 c2, float p2) {
  float4 a = float4(c0.rgb * c0.a, c0.a);
  float4 b = float4(c1.rgb * c1.a, c1.a);
  float4 c = float4(c2.rgb * c2.a, c2.a);
  float4 pm;
  if (t <= p0)      { pm = a; }
  else if (t < p1)  { pm = mix(a, b, (t - p0) / (p1 - p0)); }
  else if (t < p2)  { pm = mix(b, c, (t - p1) / (p2 - p1)); }
  else              { pm = c; }
  return float4(pm.a > 0.0 ? pm.rgb / pm.a : float3(0.0), pm.a);
}

// radial-gradient(farthest-corner circle at ...) 의 반지름
float farCorner(float2 p, float2 r) {
  float2 d = max(p, r - p);
  return length(d);
}

// 홀로가 보이는 영역 = 카드 그림창.
//  기본은 inset(9.85% 8% 52.85% 8%).
//  Stage 카드는 왼쪽 위가 진화칸에 가려서 계단으로 깎인다(--clip-stage).
float artMask(float2 uv) {
  float x = uv.x * 100.0;
  float y = uv.y * 100.0;
  float top = 9.85;
  if (stage > 0.5) {
    top = 16.0;
    top = mix(top, 14.0, clamp((x - 12.0) / 4.0, 0.0, 1.0));
    top = mix(top, 12.0, clamp((x - 16.0) / 1.0, 0.0, 1.0));
    top = mix(top, 9.85, clamp((x - 54.0) / 3.0, 0.0, 1.0));
  }
  float e = 0.25; // 경계 안티에일리어싱
  float mx = smoothstep(8.0 - e, 8.0 + e, x) * (1.0 - smoothstep(92.0 - e, 92.0 + e, x));
  float my = smoothstep(top - e, top + e, y) * (1.0 - smoothstep(47.15 - e, 47.15 + e, y));
  return mx * my;
}

// :before 의 세로 바 한 겹.
//  repeating-linear-gradient(90deg, ...) 를 3% 단위 스톱으로 되살린 것.
//  background-size 가 200% 라서 그라디언트 선 길이 = res.x * 2.
float barLayer(float x, float pos, float period) {
  float q = x + res.x * pos / 100.0;
  float u = mod(q / (2.0 * res.x) * 100.0 - 6.0, period);
  if (u < 3.0) { return mix(0.0, 0.7, u / 3.0); }
  if (u < 4.5) { return mix(0.7, 0.0, (u - 3.0) / 1.5); }
  if (u < 6.0) { return mix(0.0, 0.7, (u - 4.5) / 1.5); }
  if (u < 9.0) { return mix(0.7, 0.0, (u - 6.0) / 3.0); }
  return 0.0;
}

half4 main(float2 xy) {
  float2 uv = xy / res;
  float4 base = float4(card.eval(xy));
  float3 col = base.rgb;

  // 포인터 기준 radial 의 공통 거리값 (0 = 포인터, 1 = 가장 먼 꼭짓점)
  float2 pp = pointer * res;
  float t = length(xy - pp) / max(farCorner(pp, res), 1.0);

  float mask = artMask(uv);

  // ================= shine (홀로그램) =================
  if (mask > 0.001 && opacity > 0.001) {
    // ① 무지개 — background-position 배율 2.6 / 3.5, size 400%
    float px = (50.0 - bgp.x) * 2.6 + 50.0;
    float py = (50.0 - bgp.y) * 3.5 + 50.0;
    float2 tile = res * 4.0;
    // background-position → 타일 좌표. 타일 중심을 원점으로 옮긴다.
    float2 q = xy + 3.0 * res * float2(px, py) / 100.0 - tile * 0.5;
    float2 dir = float2(0.93969262, 0.34202014); // 110deg
    // CSS 그라디언트 선 길이 = |W·sinθ| + |H·cosθ|
    float len = tile.x * dir.x + tile.y * dir.y;
    // 선은 중심을 지나므로 0% 지점은 중심에서 -len/2 만큼 간 곳
    float tn = (dot(q, dir) + len * 0.5) / len;
    // 스톱 15개가 균등 배치 → 세그먼트 14개 → 5색 사이클이 14/5 = 2.8 바퀴
    float3 rb = rainbow(tn * 2.8);

    // ② 스캔라인 (black / #666) 을 무지개 아래에 두고 overlay
    float s = mod(xy.x, scan * 4.0) < scan * 2.0 ? 0.0 : 0.4;
    float3 shine = bOverlay(float3(s), rb);

    // ③ :before — 세로 바 2겹을 screen 으로 합쳐 hard-light
    float p1x = (50.0 - bgp.x) * 1.65 + 50.0 + bgp.y * 0.5;
    float p2x = (50.0 - bgp.x) * -0.9 + 50.0 - bgp.y * 0.75;
    float3 bars = bScreen(
      float3(barLayer(xy.x, p2x, 24.0)),
      float3(barLayer(xy.x, p1x, 36.0))
    );
    bars = clamp(fContrast(fBright(bars, 1.15), 1.1), 0.0, 1.0);
    shine = bHardLight(shine, bars);

    // ④ :after — 포인터 광택을 luminosity 로. 손가락 근처만 밝게 살아난다.
    float4 g = grad3(
      t,
      float4(0.90, 0.90, 0.90, 0.80), 0.00,
      float4(0.78, 0.78, 0.78, 0.10), 0.25,
      float4(0.00, 0.00, 0.00, 1.00), 0.90
    );
    float3 gf = clamp(fContrast(fBright(g.rgb, 0.6), 4.0), 0.0, 1.0);
    shine = mix(shine, bLuminosity(shine, gf), g.a);

    // ⑤ shine 전체 필터 → color-dodge 로 카드에 얹기
    shine = clamp(fSat(fContrast(fBright(shine, 1.1), 1.1), 1.2), 0.0, 1.0);
    col = mix(col, bColorDodge(col, shine), mask * opacity);
  }

  // ================= glare (표면 반사) =================
  //  원본은 .card__glare 안에 :after 가 들어있고, 부모에 filter/opacity 가 걸려 있다.
  //  → :after 는 카드가 아니라 "부모의 배경" 과 먼저 합성되고,
  //    그 결과 전체에 필터·투명도가 걸린 뒤에야 카드에 overlay 된다.
  float go = opacity * 0.8;
  if (go > 0.001) {
    // 부모 배경
    float4 gb = grad3(
      t,
      float4(1.0, 1.0, 1.0, 0.80), 0.10,
      float4(1.0, 1.0, 1.0, 0.65), 0.20,
      float4(0.0, 0.0, 0.0, 0.50), 0.90
    );
    // :after — 청록빛 하이라이트. clip 때문에 그림창 안쪽만 존재한다.
    float4 ga = grad3(
      t,
      float4(0.90, 1.00, 1.00, 1.00), 0.05,
      float4(0.39, 0.39, 0.39, 0.25), 0.55,
      float4(0.00, 0.00, 0.00, 0.36), 1.10
    );
    float3 Cs = clamp(fContrast(fBright(ga.rgb, 0.6), 3.0), 0.0, 1.0);

    // 알파를 가진 두 레이어를 overlay 로 정식 합성 (CSS compositing)
    float as = ga.a * mask;
    float ab = gb.a;
    float ao = as + ab * (1.0 - as);
    float3 co = as * (1.0 - ab) * Cs
              + as * ab * bOverlay(gb.rgb, Cs)
              + (1.0 - as) * ab * gb.rgb;
    float3 Cg = ao > 0.0 ? co / ao : float3(0.0);

    // 부모 filter → opacity → 카드에 overlay
    Cg = clamp(fContrast(fBright(Cg, 0.8), 1.5), 0.0, 1.0);
    col = mix(col, bOverlay(col, Cg), ao * go);
  }

  return half4(half3(clamp(col, 0.0, 1.0)), half(base.a));
}
`)

type Card = { name: string; url: string; stage: boolean }

// 원본과 같이 런타임에 pokemontcg.io 에서 받는다 (카드 아트를 repo 에 넣지 않으려고).
const CARDS: Card[] = [
  { name: '리자몽', url: 'https://images.pokemontcg.io/base1/4_hires.png', stage: true },
  { name: '뮤츠', url: 'https://images.pokemontcg.io/base1/10_hires.png', stage: false },
  { name: '썬더', url: 'https://images.pokemontcg.io/base1/16_hires.png', stage: false },
  { name: '거북왕', url: 'https://images.pokemontcg.io/base1/2_hires.png', stage: true },
]

// 원본 spring: stiffness .066 / damping .25 — Reanimated 로 옮긴 근사값
const SPRING = { mass: 1, damping: 22, stiffness: 140 } as const

export default function HoloCardDemo() {
  const { width: screenW } = useWindowDimensions()
  const W = Math.min(300, screenW - 60)
  const H = Math.round(W / ASPECT)

  const [idx, setIdx] = useState(0)
  const cardDef = CARDS[idx]
  const image = useImage(cardDef.url)

  // 포인터(0..1) · 회전(deg) · 홀로 세기 — 전부 UI 스레드
  const px = useSharedValue(0.5)
  const py = useSharedValue(0.5)
  const rotX = useSharedValue(0)
  const rotY = useSharedValue(0)
  const opacity = useSharedValue(0)

  // 포인터 이동 처리는 제스처 콜백 안에 그대로 적는다.
  //  별도 'worklet' 함수로 빼서 호출하면 이 프로젝트에선 UI 스레드에서
  //  "undefined is not a function" 으로 터진다 (React Compiler 가 켜져 있어
  //  함수 선언이 변형되면서 워클릿 캡처가 깨진다 — ⑩편과 같은 계열의 충돌).
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      opacity.value = withSpring(1, SPRING)
      const nx = Math.min(Math.max(e.x / W, 0), 1)
      const ny = Math.min(Math.max(e.y / H, 0), 1)
      px.value = withSpring(nx, SPRING)
      py.value = withSpring(ny, SPRING)
      rotY.value = withSpring(-((nx * 100 - 50) / 3.5), SPRING)
      rotX.value = withSpring((ny * 100 - 50) / 3.5, SPRING)
    })
    .onUpdate((e) => {
      const nx = Math.min(Math.max(e.x / W, 0), 1)
      const ny = Math.min(Math.max(e.y / H, 0), 1)
      px.value = withSpring(nx, SPRING)
      py.value = withSpring(ny, SPRING)
      // 원본: rotate.x = -(center.x/3.5) → rotateY, rotate.y = center.y/3.5 → rotateX
      rotY.value = withSpring(-((nx * 100 - 50) / 3.5), SPRING)
      rotX.value = withSpring((ny * 100 - 50) / 3.5, SPRING)
    })
    .onFinalize(() => {
      // 손을 떼면 평범한 카드로 돌아간다 (원본과 동일)
      opacity.value = withSpring(0, SPRING)
      rotX.value = withSpring(0, SPRING)
      rotY.value = withSpring(0, SPRING)
      px.value = withSpring(0.5, SPRING)
      py.value = withSpring(0.5, SPRING)
    })

  const uniforms = useDerivedValue(() => ({
    res: [W, H],
    pointer: [px.value, py.value],
    // 원본 adjust(): 포인터 0~100 → background 37~63 / 33~67
    bgp: [37 + px.value * 26, 33 + py.value * 34],
    opacity: opacity.value,
    scan: 0.5, // 모바일 미디어쿼리 값
    stage: cardDef.stage ? 1 : 0,
  }))

  const tilt = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 }, // 원본 base.css
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
    ],
  }))

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>✨ 포켓몬 홀로 카드</Text>
      <Text style={styles.hint}>카드를 드래그 — 손을 떼면 홀로가 사라진다</Text>

      <GestureDetector gesture={pan}>
        {/* 기울지 않는 히트 영역. 안쪽 카드만 3D 로 돈다.
            기울면 레이아웃 박스를 넘어 나오니 위아래 여백을 준다. */}
        <View style={{ width: W, height: H, marginVertical: 18 }}>
          <Animated.View style={[{ width: W, height: H }, tilt]}>
            <Canvas
              style={{
                width: W,
                height: H,
                borderRadius: W * 0.0455, // 원본 --card-radius
              }}
            >
              {image && SOURCE && (
                <Fill>
                  <Shader source={SOURCE} uniforms={uniforms}>
                    <ImageShader
                      image={image}
                      x={0}
                      y={0}
                      width={W}
                      height={H}
                      fit="fill"
                      tx="clamp"
                      ty="clamp"
                    />
                  </Shader>
                </Fill>
              )}
            </Canvas>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.row}>
        {CARDS.map((c, i) => (
          <Pressable
            key={c.url}
            onPress={() => setIdx(i)}
            style={[styles.chip, i === idx && styles.chipOn]}
          >
            <Text style={[styles.chipText, i === idx && styles.chipTextOn]}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {!image && <Text style={styles.hint}>카드 불러오는 중…</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 13, color: '#555' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  chipTextOn: { color: '#fff' },
})
