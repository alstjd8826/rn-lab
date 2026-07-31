import {
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
} from "@shopify/react-native-skia";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useFrameCallback, useSharedValue } from "react-native-reanimated";

// GPU ping-pong 원시 테스트.
//  워클릿(UI 스레드)에서 매 프레임 GPU 서피스를 만들고, 이전 프레임 스냅샷을
//  피드백 입력(uniform shader)으로 넣어 위로 드리프트 + 페이드.
//  → 빛이 번지며 흐르면 = GPU 피드백 루프가 RN Skia 워클릿에서 동작(다음: NS 얹기).
//  → 빈/정지면 = 워클릿 GPU 서피스가 막힌 것.
const H = 300;

const FEEDBACK = `
uniform shader tex;
uniform float2 touch;
uniform float touchOn;
half4 main(float2 xy) {
  half4 prev = tex.eval(xy + float2(0.0, 0.6)); // 위로 드리프트
  half3 col = prev.rgb * 0.98;                   // 서서히 페이드
  if (touchOn > 0.5) {
    float d = distance(xy, touch);
    col += half3(exp(-d * d / 80.0)) * half3(0.3, 0.7, 1.0);
  }
  return half4(col, 1.0);
}`;

const feedback = Skia.RuntimeEffect.Make(FEEDBACK)!;

export default function GpuPingPongTest() {
  const { width: winW } = useWindowDimensions();
  const W = Math.floor(winW - 48);
  const stateImage = useSharedValue<SkImage | null>(null);
  const touch = useSharedValue<[number, number, number]>([-1, -1, 0]);
  const logged = useSharedValue(false);

  // runOnJS 에 console.log 를 직접 넘기면 "locally defined function" 에러가 난다.
  // RN 런타임에 정의한 래퍼를 참조로 넘겨야 함.
  const jsLog = (m: string) => console.log(m);
  const jsWarn = (m: string) => console.warn(m);

  useFrameCallback(() => {
    "worklet";
    const surface = Skia.Surface.MakeOffscreen(W, H);
    if (!surface) {
      if (!logged.value) {
        logged.value = true;
        runOnJS(jsWarn)("[gpupp] 워클릿에서 GPU 서피스 생성 실패");
      }
      return;
    }
    const canvas = surface.getCanvas();
    const prev = stateImage.value;
    if (!prev) {
      canvas.clear(Skia.Color("black"));
    } else {
      const child = prev.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None,
      );
      const paint = Skia.Paint();
      paint.setShader(
        feedback.makeShaderWithChildren(
          [touch.value[0], touch.value[1], touch.value[2]],
          [child],
        ),
      );
      canvas.drawPaint(paint);
    }
    surface.flush();
    stateImage.value = surface.makeImageSnapshot();
    if (touch.value[2] > 0) {
      touch.value = [touch.value[0], touch.value[1], 0];
    }
    if (!logged.value) {
      logged.value = true;
      runOnJS(jsLog)("[gpupp] 워클릿 GPU 루프 정상 — 첫 프레임");
    }
  });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      touch.value = [e.x, e.y, 1];
    })
    .onChange((e) => {
      touch.value = [e.x, e.y, 1];
    });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🧪 GPU ping-pong 원시</Text>
      <Text style={styles.hint}>드래그 = 빛 주입 · 흐르며 페이드면 피드백 OK</Text>
      <GestureDetector gesture={pan}>
        <Canvas
          style={{
            width: W,
            height: H,
            borderRadius: 12,
            backgroundColor: "#000",
          }}
        >
          <Image image={stateImage} x={0} y={0} width={W} height={H} fit="none" />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: 6, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 13, color: "#555" },
});
