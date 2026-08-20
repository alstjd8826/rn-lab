import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  useImage,
} from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { buildShader, EFFECT_TEXTURES, type EffectKey } from './effects'

// 홀로그램 표면. 포켓몬 카드와 무관한 범용 컴포넌트다.
//
//  이미지 세 장만 주면 어떤 사물에든 걸린다:
//   · image  사물 본체
//   · mask   반짝일 영역의 알파. 흰 곳만 홀로가 흐른다.
//   · foil   그 영역의 포일 무늬
//  mask 를 안 주면 효과별 폴백(사각 클립 + 텍스처 타일)으로 떨어진다.
//
//  상호작용은 poke-holo 의 Card.svelte 를 그대로 옮긴 것이다.
//  포인터 → rotate / glare / background / opacity 네 값이 스프링으로 따라간다.
//  원본 계수: stiffness .066 / damping .25 (추적), .01 / .06 (놓을 때)

const SPRING = { mass: 1, damping: 22, stiffness: 140 } as const
const SNAP = { mass: 1, damping: 30, stiffness: 45 } as const

/** 마스크가 없을 때 쓰는 사각 클립 종류. 포일 마스크가 있으면 안 쓰인다. */
export type ClipKind =
  | 'art' // 위쪽 그림창 (inset 9.85% 8% 52.85% 8%)
  | 'art-stage' // 그림창인데 왼쪽 위가 계단으로 깎임
  | 'art-trainer' // 조금 더 아래에서 시작하는 그림창

const CLIP_CODE: Record<ClipKind, number> = {
  art: 0,
  'art-stage': 1,
  'art-trainer': 2,
}

export type HoloSurfaceProps = {
  /** 사물 본체 이미지 URL 또는 로컬 require */
  image: string
  /** 반짝일 영역의 알파 마스크. 없으면 효과별 폴백. */
  mask?: string
  /** 포일 무늬. mask 와 짝으로 준다. */
  foil?: string
  /** 효과가 요구하는 텍스처를 직접 지정할 때. 안 주면 효과 기본값. */
  textures?: string[]
  effect: EffectKey
  /** 표시 폭(pt). 높이는 aspect 로 계산한다. */
  width: number
  /** 가로/세로 비. 1 = 정사각형. 기본값은 포켓몬 카드 비율. */
  aspect?: number
  /** 모서리 라운드(pt). 기본은 폭의 4.55% (카드 규격). */
  radius?: number
  /** 발광색 0..1. radiant 계열이 쓴다. */
  glow?: [number, number, number]
  /** 포일 밝기. reverse 계열이 쓴다. 기본 0.55. */
  foilBright?: number
  /** 마스크 없을 때의 클립 모양 */
  clip?: ClipKind
  /** 기울기 최대 각도. 기본 ±14.3° (원본 = 포인터/3.5) */
  tiltLimit?: number
  /** 검증용. 주면 홀로를 켜고 포인터를 그 위치에 고정한다 (0..1). */
  probe?: { x: number; y: number }
}

export default function HoloSurface({
  image,
  mask,
  foil,
  textures,
  effect,
  width,
  aspect = 0.718,
  radius,
  glow = [0.8, 1.0, 0.9833],
  foilBright = 0.55,
  clip = 'art',
  tiltLimit = 100 / 3.5 / 2,
  probe,
}: HoloSurfaceProps) {
  const W = width
  const H = Math.round(W / aspect)
  const R = radius ?? W * 0.0455

  const img = useImage(image)
  const maskImg = useImage(mask ?? image)
  const foilImg = useImage(foil ?? image)

  // 효과별 텍스처. uniform shader 슬롯 3개는 항상 채워야 하므로 없으면 본체로 대신한다.
  const texUrls = textures ?? EFFECT_TEXTURES[effect] ?? []
  const texA = useImage(texUrls[0] ?? image)
  const texB = useImage(texUrls[1] ?? image)
  const texC = useImage(texUrls[2] ?? image)

  const source = useMemo(
    () => Skia.RuntimeEffect.Make(buildShader(effect)),
    [effect],
  )

  const px = useSharedValue(probe ? probe.x : 0.5)
  const py = useSharedValue(probe ? probe.y : 0.5)
  const rotX = useSharedValue(0)
  const rotY = useSharedValue(0)
  const opacity = useSharedValue(probe ? 1 : 0)

  // 제스처 콜백 안의 로직은 인라인으로 둔다. 별도 'worklet' 함수로 빼서
  // 호출하면 UI 스레드에서 undefined is not a function 으로 터진다.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      opacity.value = withSpring(1, SPRING)
      const nx = Math.min(Math.max(e.x / W, 0), 1)
      const ny = Math.min(Math.max(e.y / H, 0), 1)
      px.value = withSpring(nx, SPRING)
      py.value = withSpring(ny, SPRING)
      rotY.value = withSpring(-(nx * 2 - 1) * tiltLimit, SPRING)
      rotX.value = withSpring((ny * 2 - 1) * tiltLimit, SPRING)
    })
    .onUpdate((e) => {
      const nx = Math.min(Math.max(e.x / W, 0), 1)
      const ny = Math.min(Math.max(e.y / H, 0), 1)
      px.value = withSpring(nx, SPRING)
      py.value = withSpring(ny, SPRING)
      // 원본: rotate.x = -(center.x/3.5) → rotateY, rotate.y = center.y/3.5 → rotateX
      rotY.value = withSpring(-(nx * 2 - 1) * tiltLimit, SPRING)
      rotX.value = withSpring((ny * 2 - 1) * tiltLimit, SPRING)
    })
    .onFinalize(() => {
      // 놓으면 훨씬 느린 스프링으로 천천히 눕는다 (원본 snapStiff/snapDamp)
      opacity.value = withSpring(0, SNAP)
      rotX.value = withSpring(0, SNAP)
      rotY.value = withSpring(0, SNAP)
      px.value = withSpring(0.5, SNAP)
      py.value = withSpring(0.5, SNAP)
    })

  const hasFoil = Boolean(mask && foil) && maskImg !== null && foilImg !== null
  const texAW = texA?.width() ?? 1
  const texAH = texA?.height() ?? 1
  const clipCode = CLIP_CODE[clip]

  const uniforms = useDerivedValue(() => {
    const cx = px.value * 100 - 50
    const cy = py.value * 100 - 50
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
      foilBright,
      stage: clipCode,
      glow,
      texASize: [texAW, texAH],
    }
  })

  const tilt = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 }, // 원본 base.css
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
    ],
  }))

  return (
    <GestureDetector gesture={pan}>
      {/* 기울지 않는 히트 영역. 기울면 박스를 넘어 나오니 여백을 준다. */}
      <View style={{ width: W, height: H, marginVertical: 16 }}>
        <Animated.View style={[{ width: W, height: H }, tilt]}>
          <Canvas style={{ width: W, height: H, borderRadius: R }}>
            {img && source && (
              <Fill>
                <Shader source={source} uniforms={uniforms}>
                  <ImageShader
                    image={img}
                    x={0} y={0} width={W} height={H}
                    fit="fill" tx="clamp" ty="clamp"
                  />
                  {/* 마스크/포일이 없어도 uniform shader 슬롯은 채워야 한다 */}
                  <ImageShader
                    image={maskImg ?? img}
                    x={0} y={0} width={W} height={H}
                    fit="fill" tx="clamp" ty="clamp"
                  />
                  <ImageShader
                    image={foilImg ?? img}
                    x={0} y={0} width={W} height={H}
                    fit="fill" tx="clamp" ty="clamp"
                  />
                  {/* 효과별 텍스처는 원본 크기로 두고 셰이더에서 타일링한다 */}
                  <ImageShader image={texA ?? img} fit="none" tx="repeat" ty="repeat" />
                  <ImageShader image={texB ?? img} fit="none" tx="repeat" ty="repeat" />
                  <ImageShader image={texC ?? img} fit="none" tx="repeat" ty="repeat" />
                </Shader>
              </Fill>
            )}
          </Canvas>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}
