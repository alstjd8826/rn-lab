import { BLEND, SKSL_PRELUDE } from './sksl'
import type { EffectKey } from './cards'

// 등급별 홀로 효과. 각 효과는 hxEffect() 하나를 정의한다.
//  원본 CSS 한 파일 = 여기 한 항목. 레이어 순서·블렌드·필터를 그대로 옮긴다.
//
//  쓸 수 있는 uniform (아래 SHELL 에서 선언)
//   res        캔버스 크기
//   pointer    포인터 0..1
//   bgp        --background-x/y (%)
//   opacity    --card-opacity
//   pfc        --pointer-from-center 0..1
//   pfl, pft   --pointer-from-left / -from-top 0..1
//   hasFoil    1 = 카드별 마스크/포일 이미지가 있음
//   foilBright --foil-brightness (카드 타입별)
//   stage      1 = 진화 카드 (클립 모양이 다름)

/** 마스크가 없을 때 쓰는 클립. 원본 cards.css 의 --clip / --clip-stage. */
const CLIP_HELPERS = `
// inset(9.85% 8% 52.85% 8%) = 카드 그림창.
// Stage 카드는 왼쪽 위가 진화칸에 가려 계단으로 깎인다(--clip-stage).
float hxArtMask(float2 uv) {
  float x = uv.x * 100.0;
  float y = uv.y * 100.0;
  float top = 9.85;
  if (stage > 0.5) {
    top = 16.0;
    top = mix(top, 14.0, clamp((x - 12.0) / 4.0, 0.0, 1.0));
    top = mix(top, 12.0, clamp((x - 16.0) / 1.0, 0.0, 1.0));
    top = mix(top, 9.85, clamp((x - 54.0) / 3.0, 0.0, 1.0));
  }
  float e = 0.25;
  float mx = smoothstep(8.0 - e, 8.0 + e, x) * (1.0 - smoothstep(92.0 - e, 92.0 + e, x));
  float my = smoothstep(top - e, top + e, y) * (1.0 - smoothstep(47.15 - e, 47.15 + e, y));
  return mx * my;
}

// --clip-invert = 카드 전체에서 그림창만 뺀 부분 (리버스 홀로가 쓴다).
float hxArtMaskInv(float2 uv) { return 1.0 - hxArtMask(uv); }

// 카드별 마스크가 있으면 그 알파, 없으면 클립으로 대체.
float hxMask(float2 xy, float2 uv) {
  if (hasFoil > 0.5) { return float(maskT.eval(xy).a); }
  return hxArtMask(uv);
}
`

/** 모든 효과가 공유하는 껍데기. 앞에 프렐류드, 뒤에 main 이 붙는다. */
const SHELL_HEAD = `
uniform shader card;
uniform shader maskT;
uniform shader foilT;
uniform float2 res;
uniform float2 pointer;
uniform float2 bgp;
uniform float opacity;
uniform float pfc;
uniform float pfl;
uniform float pft;
uniform float hasFoil;
uniform float foilBright;
uniform float stage;
`

const SHELL_TAIL = `
half4 main(float2 xy) {
  float4 base = float4(card.eval(xy));
  float2 uv = xy / res;
  float3 c = hxEffect(base.rgb, xy, uv);
  return half4(half3(clamp(c, 0.0, 1.0)), half(base.a));
}
`

// ─────────────────────────────────────────────────────────────
// basic — 홀로 없음. 기울기 + 표면 광택만 (base.css 의 .card__glare).
// ─────────────────────────────────────────────────────────────
const BASIC = `
float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float go = opacity;
  if (go <= 0.001) { return col; }
  float2 at = pointer * res;
  float t = czRadCircleT(xy, res, at);
  float4 g = czGrad3(t,
    float4(1.0, 1.0, 1.0, 0.80), 0.10,
    float4(1.0, 1.0, 1.0, 0.65), 0.20,
    float4(0.0, 0.0, 0.0, 0.50), 0.90);
  return czOver(${BLEND.overlay}, col, g.rgb, g.a * go);
}
`

// ─────────────────────────────────────────────────────────────
// regular-holo — 무지개 띠 110° + 세로 스캔라인 + 세로 바 + 포인터 광택
//   원본: public/css/cards/regular-holo.css
// ─────────────────────────────────────────────────────────────
const REGULAR_HOLO = `
const float3 RH_VIOLET = float3(0.7882, 0.1608, 0.9451); // #c929f1
const float3 RH_BLUE   = float3(0.0510, 0.7412, 0.9137); // #0dbde9
const float3 RH_GREEN  = float3(0.1294, 0.9137, 0.5216); // #21e985
const float3 RH_YELLOW = float3(0.9333, 0.8745, 0.0627); // #eedf10
const float3 RH_RED    = float3(0.9725, 0.0549, 0.2078); // #f80e35

// 무지개 5색 순환. 스톱 15개가 균등 배치되므로 한 바퀴는 선 길이의 5/14.
float3 rhRainbow(float t) {
  float u = fract(t) * 5.0;
  int i = int(floor(u));
  float f = fract(u);
  float3 a = i == 0 ? RH_VIOLET : i == 1 ? RH_BLUE : i == 2 ? RH_GREEN : i == 3 ? RH_YELLOW : RH_RED;
  float3 b = i == 0 ? RH_BLUE : i == 1 ? RH_GREEN : i == 2 ? RH_YELLOW : i == 3 ? RH_RED : RH_VIOLET;
  return mix(a, b, f);
}

// :before 의 세로 바 한 겹. 3% 단위 스톱, background-size 200%.
float rhBar(float x, float pos, float period) {
  float q = x + res.x * pos / 100.0;
  float u = mod(q / (2.0 * res.x) * 100.0 - 6.0, period);
  if (u < 3.0) { return mix(0.0, 0.7, u / 3.0); }
  if (u < 4.5) { return mix(0.7, 0.0, (u - 3.0) / 1.5); }
  if (u < 6.0) { return mix(0.0, 0.7, (u - 4.5) / 1.5); }
  if (u < 9.0) { return mix(0.7, 0.0, (u - 6.0) / 3.0); }
  return 0.0;
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float2 at = pointer * res;
  float t = czRadCircleT(xy, res, at);
  float m = hxMask(xy, uv);

  // ── shine ──
  if (m > 0.001 && opacity > 0.001) {
    // ① 무지개 (110deg, size 400%, position 배율 2.6 / 3.5)
    float px = (50.0 - bgp.x) * 2.6 + 50.0;
    float py = (50.0 - bgp.y) * 3.5 + 50.0;
    float2 q = czBgXY(xy, res, float2(4.0), float2(px, py));
    float3 rb = rhRainbow(czLinT(q, res * 4.0, 110.0) * 2.8);

    // ② 스캔라인 (black / #666, 모바일 .5px 간격) 을 아래 두고 overlay
    float scan = 0.5;
    float s = mod(xy.x, scan * 4.0) < scan * 2.0 ? 0.0 : 0.4;
    float3 shine = czBlend(${BLEND.overlay}, float3(s), rb);

    // ③ :before — 세로 바 2겹을 screen 으로 합쳐 hard-light
    float p1x = (50.0 - bgp.x) * 1.65 + 50.0 + bgp.y * 0.5;
    float p2x = (50.0 - bgp.x) * -0.9 + 50.0 - bgp.y * 0.75;
    float3 bars = czBlend(${BLEND.screen},
      float3(rhBar(xy.x, p2x, 24.0)), float3(rhBar(xy.x, p1x, 36.0)));
    bars = czContrast(czBright(bars, 1.15), 1.1);
    shine = czBlend(${BLEND['hard-light']}, shine, bars);

    // ④ :after — 포인터 광택을 luminosity 로
    float4 g = czGrad3(t,
      float4(0.90, 0.90, 0.90, 0.80), 0.00,
      float4(0.78, 0.78, 0.78, 0.10), 0.25,
      float4(0.00, 0.00, 0.00, 1.00), 0.90);
    float3 gf = czContrast(czBright(g.rgb, 0.6), 4.0);
    shine = czOver(${BLEND.luminosity}, shine, gf, g.a);

    // ⑤ shine 필터 → color-dodge
    shine = czSaturate(czContrast(czBright(shine, 1.1), 1.1), 1.2);
    col = czOver(${BLEND['color-dodge']}, col, shine, m * opacity);
  }

  // ── glare ── (:after 를 부모 배경과 먼저 합성한 뒤 통째로 얹는다)
  float go = opacity * 0.8;
  if (go > 0.001) {
    float4 gb = czGrad3(t,
      float4(1.0, 1.0, 1.0, 0.80), 0.10,
      float4(1.0, 1.0, 1.0, 0.65), 0.20,
      float4(0.0, 0.0, 0.0, 0.50), 0.90);
    float4 ga = czGrad3(t,
      float4(0.90, 1.00, 1.00, 1.00), 0.05,
      float4(0.39, 0.39, 0.39, 0.25), 0.55,
      float4(0.00, 0.00, 0.00, 0.36), 1.10);
    float3 cs = czContrast(czBright(ga.rgb, 0.6), 3.0);
    float as = ga.a * m;
    float ab = gb.a;
    float ao = as + ab * (1.0 - as);
    float3 co = as * (1.0 - ab) * cs
              + as * ab * czBlend(${BLEND.overlay}, gb.rgb, cs)
              + (1.0 - as) * ab * gb.rgb;
    float3 cg = ao > 0.0 ? co / ao : float3(0.0);
    cg = czContrast(czBright(cg, 0.8), 1.5);
    col = czOver(${BLEND.overlay}, col, cg, ao * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// reverse-holo — 포일 텍스처를 밑에 깔고 그 위에 대각선/원형 그라디언트
//   원본: public/css/cards/reverse-holo.css
//   특징: 포일 이미지 자체가 레이어다. 그림창 "바깥"이 반짝인다.
// ─────────────────────────────────────────────────────────────
const REVERSE_HOLO = `
float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float2 at = pointer * res;
  float t = czRadCircleT(xy, res, at);

  // ── shine ──
  //  opacity: 1.5*card-opacity - pointer-from-center
  float so = clamp(1.5 * opacity - pfc, 0.0, 1.0);
  // 마스크가 없으면 --foil: none + clip-path: var(--clip-invert)
  float m = hasFoil > 0.5 ? float(maskT.eval(xy).a) : hxArtMaskInv(uv);
  if (so > 0.001 && m > 0.001) {
    // 맨 아래: 포일 텍스처 (cover). 마스크 없으면 이 레이어가 없다.
    float3 layer = hasFoil > 0.5 ? float3(foilT.eval(xy).rgb) : float3(0.0);

    // 중간: linear-gradient(-45deg, #000 15%, #fff 50%, #000 85%), size 200%,
    //       position (100%*pfl, 100%*pft) → difference
    float2 q2 = czBgXY(xy, res, float2(2.0), float2(pfl * 100.0, pft * 100.0));
    float t2 = czLinT(q2, res * 2.0, -45.0);
    float4 g2 = czGrad3(t2,
      float4(0.0, 0.0, 0.0, 1.0), 0.15,
      float4(1.0, 1.0, 1.0, 1.0), 0.50,
      float4(0.0, 0.0, 0.0, 1.0), 0.85);
    layer = czBlend(${BLEND.difference}, layer, g2.rgb);

    // 위: radial-gradient(circle at pointer, #fff 5%, #000 50%, #fff 80%),
    //     size 120%, center → soft-light
    float2 tile1 = res * 1.2;
    float2 q1 = czBgXY(xy, res, float2(1.2), float2(50.0));
    float t1 = czRadCircleT(q1, tile1, pointer * tile1);
    float4 g1 = czGrad3(t1,
      float4(1.0, 1.0, 1.0, 1.0), 0.05,
      float4(0.0, 0.0, 0.0, 1.0), 0.50,
      float4(1.0, 1.0, 1.0, 1.0), 0.80);
    layer = czBlend(${BLEND['soft-light']}, layer, g1.rgb);

    // filter: brightness(--foil-brightness) contrast(1.5) saturate(1)
    layer = czSaturate(czContrast(czBright(layer, foilBright), 1.5), 1.0);
    col = czOver(${BLEND['color-dodge']}, col, layer, m * so);
  }

  // ── glare ── 부모 + :after 둘 다 opacity: var(--card-opacity)
  if (opacity > 0.001) {
    float4 gb = czGrad3(t,
      float4(1.0, 1.0, 1.0, 0.80), 0.10,
      float4(1.0, 1.0, 1.0, 0.50), 0.20,
      float4(0.0, 0.0, 0.0, 0.75), 0.90);
    float3 cb = czContrast(czBright(gb.rgb, 0.7), 1.5);

    float4 ga = czGrad3(t,
      float4(1.0, 1.0, 1.0, 1.00), 0.10,
      float4(1.0, 1.0, 1.0, 0.50), 0.20,
      float4(0.0, 0.0, 0.0, 0.50), 1.20);
    float3 ca = czContrast(czBright(ga.rgb, 1.0), 1.5);

    // :after 는 부모 배경 위에 normal 합성 (blend 지정 없음)
    float as = ga.a * opacity;
    float ab = gb.a;
    float ao = as + ab * (1.0 - as);
    float3 co = as * ca + (1.0 - as) * ab * cb;
    float3 cg = ao > 0.0 ? co / ao : float3(0.0);
    col = czOver(${BLEND.overlay}, col, cg, ao * opacity);
  }
  return col;
}
`

const BODIES: Partial<Record<EffectKey, string>> = {
  basic: BASIC,
  'regular-holo': REGULAR_HOLO,
  'reverse-holo': REVERSE_HOLO,
}

/** 아직 옮기지 않은 효과. basic 으로 대체하고 화면에 표시한다. */
export const isPorted = (k: EffectKey) => k in BODIES

export function buildShader(k: EffectKey) {
  const body = BODIES[k] ?? BASIC
  return SHELL_HEAD + SKSL_PRELUDE + CLIP_HELPERS + body + SHELL_TAIL
}
