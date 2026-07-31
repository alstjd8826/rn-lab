import {
  Canvas,
  Fill,
  FilterMode,
  ImageShader,
  MipmapMode,
  Shader,
  Skia,
  TileMode,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";

// ① height-field 물결 시뮬 (GPU ping-pong).
//  상태 텍스처: R=수면 높이, G=속도 (둘 다 [-1,1]을 [0,1]로 인코딩).
//  매 프레임: 이웃 4방향 높이로 라플라시안 → 속도 갱신(감쇠) → 높이 갱신.
//  탭 지점엔 가우시안으로 높이 주입 → 상태가 누적되어 파동이 겹치고 벽에 반사.
//  ⚠️ 루프는 JS 스레드 rAF에서 돈다 — 오프스크린 서피스가 JS 스레드에서
//     생성되므로, UI 스레드 워클릿(useFrameCallback)에서 접근하면 빈 화면이 된다.
const H = 300;

// 시뮬 진행 셰이더: 이전 상태(tex)를 읽어 다음 상태를 씀.
const SIM = `
uniform shader tex;
uniform float2 touch;   // 탭 좌표(px)
uniform float touchOn;  // 1이면 이번 프레임에 주입

half4 main(float2 xy) {
  half4 c = tex.eval(xy);
  half h = c.r * 2.0 - 1.0;
  half v = c.g * 2.0 - 1.0;
  half hL = tex.eval(xy + float2(-1.0, 0.0)).r * 2.0 - 1.0;
  half hR = tex.eval(xy + float2( 1.0, 0.0)).r * 2.0 - 1.0;
  half hU = tex.eval(xy + float2(0.0, -1.0)).r * 2.0 - 1.0;
  half hD = tex.eval(xy + float2(0.0,  1.0)).r * 2.0 - 1.0;
  half lap = (hL + hR + hU + hD) - 4.0 * h;
  v += lap * 0.28;   // 파동 속도
  v *= 0.985;        // 감쇠
  half hn = h + v;
  if (touchOn > 0.5) {
    float d = distance(xy, touch);
    hn += half(exp(-d * d / 10.0)) * 0.9;
  }
  hn = clamp(hn, -1.0, 1.0);
  v = clamp(v, -1.0, 1.0);
  return half4(hn * 0.5 + 0.5, v * 0.5 + 0.5, 0.0, 1.0);
}`;

// 렌더 셰이더: 상태 텍스처의 높이/기울기로 물색 + 하이라이트.
const RENDER = `
uniform shader tex;
half4 main(float2 xy) {
  half h  = tex.eval(xy).r * 2.0 - 1.0;
  half hx = tex.eval(xy + float2(1.0,0.0)).r - tex.eval(xy + float2(-1.0,0.0)).r;
  half hy = tex.eval(xy + float2(0.0,1.0)).r - tex.eval(xy + float2(0.0,-1.0)).r;
  half3 n = normalize(half3(-hx, -hy, 0.12));
  half light = clamp(dot(n, normalize(half3(0.5, 0.6, 1.0))), 0.0, 1.0);
  half3 deep  = half3(0.03, 0.10, 0.18);
  half3 crest = half3(0.35, 0.75, 0.95);
  half3 col = mix(deep, crest, clamp(h * 0.5 + 0.5, 0.0, 1.0));
  col += light * 0.25;
  return half4(col, 1.0);
}`;

const simEffect = Skia.RuntimeEffect.Make(SIM);
const renderEffect = Skia.RuntimeEffect.Make(RENDER);
// 진단: 셰이더 컴파일 실패면 여기서 경고 (원인 ②)
if (!simEffect || !renderEffect) {
  console.warn(
    "[fluid] SkSL 컴파일 실패 — sim:",
    !!simEffect,
    "render:",
    !!renderEffect,
  );
}

export default function FluidHeightFieldDemo() {
  const { width: winW } = useWindowDimensions();
  const W = Math.floor(winW - 48);

  // ping-pong 서피스 2장 (시뮬 해상도 = 표시 해상도, 좌표 변환 없음)
  // ⚠️ Make(=CPU 서피스)를 쓴다. MakeOffscreen(GPU)의 스냅샷은 GPU 컨텍스트에
  //    묶여 UI 스레드 Canvas가 샘플하면 빈 화면이 된다. CPU 이미지는 스레드를 넘나든다.
  const surfaces = useMemo(
    () => [Skia.Surface.Make(W, H), Skia.Surface.Make(W, H)],
    [W],
  );

  const stateImage = useSharedValue<SkImage | null>(null);
  const curRef = useRef(0);
  // 탭 주입 상태 (JS 스레드 ref — 루프가 JS 스레드라 ref로 충분)
  const touchRef = useRef({ x: -1, y: -1, on: false });

  useEffect(() => {
    if (!simEffect || !renderEffect) return;
    // 서피스 초기값은 검정(0,0,0) → 셰이더에서 h=v=-1 로 바닥 포화되어 파동이
    // 안 퍼진다. 평수면(h=0,v=0 → R=G=0.5 → 128,128,0)으로 clear 해서 시작.
    const flat = Skia.Color("rgb(128, 128, 0)");
    surfaces.forEach((s) => s?.getCanvas().clear(flat));
    // 첫 렌더에서 ImageShader가 null을 받지 않도록 시드 이미지 주입
    if (surfaces[0]) stateImage.value = surfaces[0].makeImageSnapshot();
    let running = true;
    let raf = 0;
    let logged = false;

    const loop = () => {
      if (!running) return;
      const src = surfaces[curRef.current];
      const dst = surfaces[1 - curRef.current];
      if (src && dst) {
        const prev = src.makeImageSnapshot();
        const child = prev.makeShaderOptions(
          TileMode.Clamp,
          TileMode.Clamp,
          FilterMode.Nearest,
          MipmapMode.None,
        );
        const t = touchRef.current;
        const paint = Skia.Paint();
        paint.setShader(
          simEffect.makeShaderWithChildren(
            [t.x, t.y, t.on ? 1 : 0],
            [child],
          ),
        );
        dst.getCanvas().drawPaint(paint);
        dst.flush();
        stateImage.value = dst.makeImageSnapshot();
        curRef.current = 1 - curRef.current;
        if (t.on) touchRef.current = { ...t, on: false };
        if (!logged) {
          logged = true;
          console.log("[fluid] 루프 정상 — 첫 프레임 렌더됨");
        }
      } else if (!logged) {
        logged = true;
        console.warn("[fluid] 오프스크린 서피스 생성 실패 (원인 ①)");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [surfaces, stateImage]);

  const injectTouch = (x: number, y: number) => {
    touchRef.current = { x, y, on: true };
  };
  const tap = Gesture.Tap().onStart((e) => {
    runOnJS(injectTouch)(e.x, e.y);
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>💧 ① Skia height-field 물결</Text>
      <Text style={styles.hint}>탭 = 파동 주입 · 상태 누적 → 반사/간섭</Text>
      <GestureDetector gesture={tap}>
        <Canvas style={{ width: W, height: H, borderRadius: 12 }}>
          {/* 폴백: 이미지 아직 없거나 셰이더 문제여도 최소 딥블루가 보임
              → 완전 검정이면 Canvas 자체 문제, 딥블루면 루프/셰이더 문제 */}
          <Fill color="#0a1a2f" />
          {renderEffect && (
            <Fill>
              <Shader source={renderEffect}>
                <ImageShader
                  image={stateImage}
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fit="none"
                  tx="clamp"
                  ty="clamp"
                />
              </Shader>
            </Fill>
          )}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    gap: 6,
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  hint: { fontSize: 13, color: "#555" },
});
