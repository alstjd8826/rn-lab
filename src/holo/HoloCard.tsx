import type { HoloCard as CardData } from './cards'
import HoloSurface, { type ClipKind } from './HoloSurface'

// 포켓몬 카드 → HoloSurface 매핑만 하는 얇은 래퍼.
//  홀로 계산은 전부 HoloSurface / effects.ts 에 있고 여기엔 포켓몬 규칙만 남긴다.

/** 포켓몬 카드 비율 (원본 --card-aspect) */
export const CARD_ASPECT = 0.718

/** base.css 의 --card-glow. 카드 타입에 따라 발광색이 다르다. */
const GLOW: Record<string, [number, number, number]> = {
  water: [0.212, 0.8328, 0.988],
  fire: [0.9221, 0.3575, 0.2579],
  grass: [0.5933, 0.9335, 0.3665],
  lightning: [0.9519, 0.8875, 0.3081],
  psychic: [0.6755, 0.3196, 0.8404],
  fighting: [0.5686, 0.3529, 0.1529],
  darkness: [0.0621, 0.4155, 0.4779],
  metal: [0.64, 0.752, 0.76],
  dragon: [0.56, 0.497, 0.14],
  fairy: [1.0, 0.78, 0.9157],
}
const GLOW_DEFAULT: [number, number, number] = [0.8, 1.0, 0.9833]

function cardGlow(types: string[]): [number, number, number] {
  for (const t of types) {
    const g = GLOW[t.toLowerCase()]
    if (g) return g
  }
  return GLOW_DEFAULT
}

/** 카드 타입별 --foil-brightness (reverse-holo.css) */
function foilBrightness(types: string[]) {
  const t = types.join(' ').toLowerCase()
  if (t.includes('lightning')) return 0.7
  if (t.includes('darkness')) return 0.8
  if (t.includes('metal')) return 0.6
  return 0.55
}

/** 마스크가 없는 카드에 쓰는 사각 클립. 진화·트레이너는 그림창 모양이 다르다. */
function cardClip(card: CardData): ClipKind {
  const sub = card.subtypes.join(' ').toLowerCase()
  if (sub.startsWith('stage')) return 'art-stage'
  if (/supporter|item|stadium/.test(sub) || card.supertype === 'Trainer') {
    return 'art-trainer'
  }
  return 'art'
}

export default function HoloCard({
  card,
  width,
  probe,
}: {
  card: CardData
  width: number
  probe?: { x: number; y: number }
}) {
  return (
    <HoloSurface
      image={card.img}
      mask={card.mask || undefined}
      foil={card.foil || undefined}
      effect={card.effect}
      width={width}
      aspect={CARD_ASPECT}
      glow={cardGlow(card.types)}
      foilBright={foilBrightness(card.types)}
      clip={cardClip(card)}
      probe={probe}
    />
  )
}
