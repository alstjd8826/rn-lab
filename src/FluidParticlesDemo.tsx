import { Canvas, Points, type SkPoint } from "@shopify/react-native-skia";
import { Accelerometer } from "expo-sensors";
import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

// #3: 입자 물 (SPH-lite).
//  중력 + 이웃 반발(O(n²)) + 벽 충돌 + 드래그 밀기. 워클릿에서 시뮬, Skia Points로 그림.
//  ※ sensor(기울기) 없이 고정 중력 first cut. 입자 수는 성능 위해 250개.
const H = 360;
const N = 250;
const R = 16; // 반발 반경(px)
const RAD = 5; // 입자 반지름(px)
const G = 0.35; // 기본 중력(센서 오기 전 폴백)
const GT = 0.4; // 기울기 중력 강도
const REP = 0.6; // 반발 강도
const DAMP = 0.99;

export default function FluidParticlesDemo() {
  const { width: winW } = useWindowDimensions();
  const W = Math.floor(winW - 48);

  // 입자 상태 (워클릿에서 in-place 갱신)
  const px = useSharedValue<number[]>([]);
  const py = useSharedValue<number[]>([]);
  const vx = useSharedValue<number[]>([]);
  const vy = useSharedValue<number[]>([]);
  const tick = useSharedValue(0);
  const touch = useSharedValue<number[]>([-1, -1, 0, 0, 0]); // x,y,dx,dy,on
  const grav = useSharedValue<number[]>([0, G]); // 화면좌표 중력벡터

  // 가속도계로 기울기 → 중력 방향. 화면: +x 오른쪽, +y 아래.
  // 인버트 느낌이면 부호(gx/gy) 뒤집으면 됨.
  useEffect(() => {
    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(({ x, y }) => {
      grav.value = [x * GT, -y * GT];
    });
    return () => sub.remove();
  }, [grav]);

  const points = useDerivedValue<SkPoint[]>(() => {
    tick.value; // 매 프레임 재계산 트리거
    const x = px.value;
    const y = py.value;
    const out: SkPoint[] = [];
    for (let i = 0; i < x.length; i++) out.push({ x: x[i], y: y[i] });
    return out;
  });

  useFrameCallback(() => {
    "worklet";
    // 최초 시드: 상단에 격자로 흩뿌림
    if (px.value.length === 0) {
      const nx: number[] = [];
      const ny: number[] = [];
      const nvx: number[] = [];
      const nvy: number[] = [];
      const cols = Math.floor(Math.sqrt(N));
      for (let i = 0; i < N; i++) {
        nx.push(20 + (i % cols) * ((W - 40) / cols) + Math.random() * 2);
        ny.push(20 + Math.floor(i / cols) * 10);
        nvx.push(0);
        nvy.push(0);
      }
      px.value = nx;
      py.value = ny;
      vx.value = nvx;
      vy.value = nvy;
    }

    const X = px.value;
    const Y = py.value;
    const VX = vx.value;
    const VY = vy.value;
    const n = X.length;

    // 기울기 중력
    const gx = grav.value[0];
    const gy = grav.value[1];
    for (let i = 0; i < n; i++) {
      VX[i] += gx;
      VY[i] += gy;
    }

    // 이웃 반발 (O(n²))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = X[j] - X[i];
        const dy = Y[j] - Y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = ((R - d) / R) * REP;
          const nx = dx / d;
          const ny = dy / d;
          VX[i] -= nx * f;
          VY[i] -= ny * f;
          VX[j] += nx * f;
          VY[j] += ny * f;
        }
      }
    }

    // 드래그 밀기
    const t = touch.value;
    if (t[4] > 0.5) {
      for (let i = 0; i < n; i++) {
        const dx = X[i] - t[0];
        const dy = Y[i] - t[1];
        const d2 = dx * dx + dy * dy;
        if (d2 < 60 * 60) {
          VX[i] += t[2] * 0.6;
          VY[i] += t[3] * 0.6;
        }
      }
    }

    // 적분 + 벽 충돌
    for (let i = 0; i < n; i++) {
      VX[i] *= DAMP;
      VY[i] *= DAMP;
      X[i] += VX[i];
      Y[i] += VY[i];
      if (X[i] < RAD) {
        X[i] = RAD;
        VX[i] = -VX[i] * 0.4;
      } else if (X[i] > W - RAD) {
        X[i] = W - RAD;
        VX[i] = -VX[i] * 0.4;
      }
      if (Y[i] < RAD) {
        Y[i] = RAD;
        VY[i] = -VY[i] * 0.4;
      } else if (Y[i] > H - RAD) {
        Y[i] = H - RAD;
        VY[i] = -VY[i] * 0.4;
      }
    }

    tick.value += 1;
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
      <Text style={styles.title}>💦 #3 · 입자 물 (SPH-lite)</Text>
      <Text style={styles.hint}>중력으로 쌓임 · 드래그로 휘젓기</Text>
      <GestureDetector gesture={pan}>
        <Canvas
          style={{
            width: W,
            height: H,
            borderRadius: 12,
            backgroundColor: "#04121f",
          }}
        >
          <Points
            points={points}
            mode="points"
            color="#4fc3f7"
            style="stroke"
            strokeWidth={RAD * 2}
            strokeCap="round"
          />
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
