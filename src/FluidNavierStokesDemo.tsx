import {
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";

// 유체 1단계: advection (속도장 + 다이).
//  ⚠️ 프레임당 GPU 서피스/셰이더를 새로 만들되 즉시 dispose 한다.
//     안 하면 GPU 네이티브 메모리가 JS GC보다 빨리 쌓여 앱이 크래시.
const H = 320;
const VS = 24.0;

const SPLAT_VEL = `
uniform shader vel; uniform float2 point; uniform float2 dir;
half4 main(float2 xy) {
  half4 c = vel.eval(xy);
  float2 v = (float2(c.rg) - 0.5) * (2.0 * ${VS});
  float d = distance(xy, point);
  float w = exp(-d * d / 900.0);
  v += dir * w;
  float2 e = v / (2.0 * ${VS}) + 0.5;
  return half4(half2(e), 0.0, 1.0);
}`;

const SPLAT_DYE = `
uniform shader dye; uniform float2 point; uniform float3 color;
half4 main(float2 xy) {
  half4 c = dye.eval(xy);
  float d = distance(xy, point);
  float w = exp(-d * d / 900.0);
  float3 col = float3(c.rgb) + color * w;
  return half4(half3(col), 1.0);
}`;

const ADVECT_VEL = `
uniform shader vel;
half4 main(float2 xy) {
  half4 c = vel.eval(xy);
  float2 v = (float2(c.rg) - 0.5) * (2.0 * ${VS});
  float2 pos = xy - v;
  half4 s = vel.eval(pos);
  float2 sv = (float2(s.rg) - 0.5) * (2.0 * ${VS});
  sv *= 0.997;
  float2 e = sv / (2.0 * ${VS}) + 0.5;
  return half4(half2(e), 0.0, 1.0);
}`;

const ADVECT_DYE = `
uniform shader dye; uniform shader vel;
half4 main(float2 xy) {
  half4 c = vel.eval(xy);
  float2 v = (float2(c.rg) - 0.5) * (2.0 * ${VS});
  float2 pos = xy - v;
  half4 d = dye.eval(pos);
  return half4(d.rgb * 0.994, 1.0);
}`;

const splatVel = Skia.RuntimeEffect.Make(SPLAT_VEL)!;
const splatDye = Skia.RuntimeEffect.Make(SPLAT_DYE)!;
const advectVel = Skia.RuntimeEffect.Make(ADVECT_VEL)!;
const advectDye = Skia.RuntimeEffect.Make(ADVECT_DYE)!;

export default function FluidNavierStokesDemo() {
  const { width: winW } = useWindowDimensions();
  const W = Math.floor(winW - 48);

  const velImage = useSharedValue<SkImage | null>(null);
  const dyeImage = useSharedValue<SkImage | null>(null);
  const touch = useSharedValue<number[]>([-1, -1, 0, 0, 0]); // x,y,dx,dy,on
  const frame = useSharedValue(0);

  useFrameCallback(() => {
    "worklet";
    // 한 패스: 서피스/셰이더/페인트를 만들고 즉시 dispose, 결과 이미지만 반환
    const pass = (
      effect: SkRuntimeEffect,
      uniforms: number[],
      imgs: SkImage[],
    ): SkImage | null => {
      const s = Skia.Surface.MakeOffscreen(W, H);
      if (!s) return null;
      const children = imgs.map((img) =>
        img.makeShaderOptions(
          TileMode.Clamp,
          TileMode.Clamp,
          FilterMode.Linear,
          MipmapMode.None,
        ),
      );
      const shader = effect.makeShaderWithChildren(uniforms, children);
      const p = Skia.Paint();
      p.setShader(shader);
      s.getCanvas().drawPaint(p);
      s.flush();
      const out = s.makeImageSnapshot();
      p.dispose();
      shader.dispose();
      children.forEach((c) => c.dispose());
      s.dispose();
      return out;
    };
    const clear = (color: string): SkImage | null => {
      const s = Skia.Surface.MakeOffscreen(W, H);
      if (!s) return null;
      s.getCanvas().clear(Skia.Color(color));
      s.flush();
      const out = s.makeImageSnapshot();
      s.dispose();
      return out;
    };

    if (!velImage.value) velImage.value = clear("rgb(128, 128, 0)");
    if (!dyeImage.value) dyeImage.value = clear("black");
    const prevVel = velImage.value;
    const prevDye = dyeImage.value;
    if (!prevVel || !prevDye) return;

    let vel = prevVel;
    let dye = prevDye;
    const created: SkImage[] = [];
    const run = (e: SkRuntimeEffect, u: number[], imgs: SkImage[]) => {
      const o = pass(e, u, imgs);
      if (o) created.push(o);
      return o;
    };

    frame.value += 1;
    const t = frame.value * 0.04;
    const color = [
      0.5 + 0.5 * Math.sin(t),
      0.5 + 0.5 * Math.sin(t + 2.1),
      0.5 + 0.5 * Math.sin(t + 4.2),
    ];

    const tv = touch.value;
    if (tv[4] > 0.5) {
      const sv = run(splatVel, [tv[0], tv[1], tv[2], tv[3]], [vel]);
      if (sv) vel = sv;
      const sd = run(
        splatDye,
        [tv[0], tv[1], color[0], color[1], color[2]],
        [dye],
      );
      if (sd) dye = sd;
    }
    const av = run(advectVel, [], [vel]);
    if (av) vel = av;
    const ad = run(advectDye, [], [dye, vel]);
    if (ad) dye = ad;

    velImage.value = vel;
    dyeImage.value = dye;

    // 최종 2장(vel, dye) 빼고 전부 해제: 이전 상태 + 중간 산출물
    if (prevVel !== vel) prevVel.dispose();
    if (prevDye !== dye) prevDye.dispose();
    created.forEach((img) => {
      if (img !== vel && img !== dye) img.dispose();
    });
  });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      touch.value = [e.x, e.y, 0, 0, 1];
    })
    .onChange((e) => {
      touch.value = [e.x, e.y, e.changeX, e.changeY, 1];
    })
    .onFinalize(() => {
      touch.value = [touch.value[0], touch.value[1], 0, 0, 0];
    });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌊 2a · Skia 유체 (advection)</Text>
      <Text style={styles.hint}>드래그 = 다이 밀기 · pressure는 2단계</Text>
      <GestureDetector gesture={pan}>
        <Canvas
          style={{
            width: W,
            height: H,
            borderRadius: 12,
            backgroundColor: "#000",
          }}
        >
          <Image image={dyeImage} x={0} y={0} width={W} height={H} fit="none" />
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
