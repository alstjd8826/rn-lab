import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  useImage,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { HoloCard as CardData } from "./cards";
import { buildShader, EFFECT_TEXTURES } from "./effects";

// 카드 한 장. 원본 Card.svelte 의 상호작용을 그대로 옮겼다.
//   포인터 → rotate / glare / background / opacity 네 값이 스프링으로 따라간다.
//   원본 계수: stiffness .066 / damping .25 (추적), .01 / .06 (놓을 때)

export const CARD_ASPECT = 0.718; // 원본 --card-aspect

const SPRING = { mass: 1, damping: 22, stiffness: 140 } as const;
const SNAP = { mass: 1, damping: 30, stiffness: 45 } as const;

/** 카드 타입별 --foil-brightness (reverse-holo.css) */
function foilBrightness(types: string[]) {
  const t = types.join(" ").toLowerCase();
  if (t.includes("lightning")) return 0.7;
  if (t.includes("darkness")) return 0.8;
  if (t.includes("metal")) return 0.6;
  return 0.55;
}

export default function HoloCard({
  card,
  width,
}: {
  card: CardData;
  width: number;
}) {
  const W = width;
  const H = Math.round(W / CARD_ASPECT);

  const img = useImage(card.img);
  const mask = useImage(card.mask);
  const foil = useImage(card.foil);

  // 효과별 텍스처. 슬롯 3개는 항상 채워야 하므로 없으면 카드로 대신한다.
  const texUrls = EFFECT_TEXTURES[card.effect] ?? [];
  const texA = useImage(texUrls[0] ?? card.img);
  const texB = useImage(texUrls[1] ?? card.img);
  const texC = useImage(texUrls[2] ?? card.img);

  const source = useMemo(
    () => Skia.RuntimeEffect.Make(buildShader(card.effect)),
    [card.effect],
  );

  const px = useSharedValue(0.5);
  const py = useSharedValue(0.5);
  const rotX = useSharedValue(0);
  const rotY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      opacity.value = withSpring(1, SPRING);
      const nx = Math.min(Math.max(e.x / W, 0), 1);
      const ny = Math.min(Math.max(e.y / H, 0), 1);
      px.value = withSpring(nx, SPRING);
      py.value = withSpring(ny, SPRING);
      rotY.value = withSpring(-((nx * 100 - 50) / 3.5), SPRING);
      rotX.value = withSpring((ny * 100 - 50) / 3.5, SPRING);
    })
    .onUpdate((e) => {
      const nx = Math.min(Math.max(e.x / W, 0), 1);
      const ny = Math.min(Math.max(e.y / H, 0), 1);
      px.value = withSpring(nx, SPRING);
      py.value = withSpring(ny, SPRING);
      // 원본: rotate.x = -(center.x/3.5) → rotateY, rotate.y = center.y/3.5 → rotateX
      rotY.value = withSpring(-((nx * 100 - 50) / 3.5), SPRING);
      rotX.value = withSpring((ny * 100 - 50) / 3.5, SPRING);
    })
    .onFinalize(() => {
      // 놓으면 훨씬 느린 스프링으로 천천히 눕는다 (원본 snapStiff/snapDamp)
      opacity.value = withSpring(0, SNAP);
      rotX.value = withSpring(0, SNAP);
      rotY.value = withSpring(0, SNAP);
      px.value = withSpring(0.5, SNAP);
      py.value = withSpring(0.5, SNAP);
    });

  const hasFoil = mask !== null && foil !== null;
  const texAW = texA?.width() ?? 1;
  const texAH = texA?.height() ?? 1;
  const fb = foilBrightness(card.types);
  const isStage = card.subtypes.join(" ").toLowerCase().startsWith("stage");

  const uniforms = useDerivedValue(() => {
    const cx = px.value * 100 - 50;
    const cy = py.value * 100 - 50;
    return {
      res: [W, H],
      pointer: [px.value, py.value],
      // 원본 adjust(): 포인터 0~100 → background 37~63 / 33~67
      bgp: [37 + px.value * 26, 33 + py.value * 34],
      opacity: opacity.value,
      pfc: Math.min(Math.sqrt(cx * cx + cy * cy) / 50, 1),
      pfl: px.value,
      pft: py.value,
      hasFoil: hasFoil ? 1 : 0,
      foilBright: fb,
      stage: isStage ? 1 : 0,
      texASize: [texAW, texAH],
    };
  });

  const tilt = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 }, // 원본 base.css
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* 기울지 않는 히트 영역. 기울면 박스를 넘어 나오니 여백을 준다. */}
      <View style={{ width: W, height: H, marginVertical: 16 }}>
        <Animated.View style={[{ width: W, height: H }, tilt]}>
          <Canvas style={{ width: W, height: H, borderRadius: W * 0.0455 }}>
            {img && source && (
              <Fill>
                <Shader source={source} uniforms={uniforms}>
                  <ImageShader
                    image={img}
                    x={0}
                    y={0}
                    width={W}
                    height={H}
                    fit="fill"
                    tx="clamp"
                    ty="clamp"
                  />
                  {/* 마스크/포일이 없는 카드도 uniform shader 3개는 채워야 한다 */}
                  <ImageShader
                    image={mask ?? img}
                    x={0}
                    y={0}
                    width={W}
                    height={H}
                    fit="fill"
                    tx="clamp"
                    ty="clamp"
                  />
                  <ImageShader
                    image={foil ?? img}
                    x={0}
                    y={0}
                    width={W}
                    height={H}
                    fit="fill"
                    tx="clamp"
                    ty="clamp"
                  />
                  {/* 효과별 텍스처는 원본 크기로 두고 셰이더에서 타일링한다 */}
                  <ImageShader
                    image={texA ?? img}
                    fit="none"
                    tx="repeat"
                    ty="repeat"
                  />
                  <ImageShader
                    image={texB ?? img}
                    fit="none"
                    tx="repeat"
                    ty="repeat"
                  />
                  <ImageShader
                    image={texC ?? img}
                    fit="none"
                    tx="repeat"
                    ty="repeat"
                  />
                </Shader>
              </Fill>
            )}
          </Canvas>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export const cardStyles = StyleSheet.create({
  placeholder: { backgroundColor: "#eee", borderRadius: 8 },
});
