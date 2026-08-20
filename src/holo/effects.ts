import { BLEND, SKSL_PRELUDE } from './sksl'
import type { EffectKey } from './cards'

export type { EffectKey }

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
// stage uniform 이 클립 종류를 고른다.
//  0 = --clip           inset(9.85% 8% 52.85% 8%)
//  1 = --clip-stage     진화칸에 왼쪽 위가 계단으로 깎인다
//  2 = --clip-trainer   inset(14.5% 8.5% 48.2% 8.5%)
float hxArtMask(float2 uv) {
  float x = uv.x * 100.0;
  float y = uv.y * 100.0;
  float e = 0.25;
  if (stage > 1.5) {
    float mx = smoothstep(8.5 - e, 8.5 + e, x) * (1.0 - smoothstep(91.5 - e, 91.5 + e, x));
    float my = smoothstep(14.5 - e, 14.5 + e, y) * (1.0 - smoothstep(51.8 - e, 51.8 + e, y));
    return mx * my;
  }
  float top = 9.85;
  if (stage > 0.5) {
    top = 16.0;
    top = mix(top, 14.0, clamp((x - 12.0) / 4.0, 0.0, 1.0));
    top = mix(top, 12.0, clamp((x - 16.0) / 1.0, 0.0, 1.0));
    top = mix(top, 9.85, clamp((x - 54.0) / 3.0, 0.0, 1.0));
  }
  float mx = smoothstep(8.0 - e, 8.0 + e, x) * (1.0 - smoothstep(92.0 - e, 92.0 + e, x));
  float my = smoothstep(top - e, top + e, y) * (1.0 - smoothstep(47.15 - e, 47.15 + e, y));
  return mx * my;
}

// 원본 CSS 는 카드 폭이 300pt 라는 걸 전제로 절대 px 값을 몇 군데 쓴다.
//  (grain 타일 500px, radiant 파스텔 주기 1200px, glitter 흔들림 1px)
//  다른 크기 사물에도 같은 비율로 보이게 300 기준으로 환산한다.
float hxPx(float v) { return v * res.x / 300.0; }

// --clip-borders = inset(2.8% 4% round ...) — 얇은 테두리만 뺀 영역
float hxBorders(float2 uv) {
  float x = uv.x * 100.0;
  float y = uv.y * 100.0;
  float e = 0.3;
  float mx = smoothstep(4.0 - e, 4.0 + e, x) * (1.0 - smoothstep(96.0 - e, 96.0 + e, x));
  float my = smoothstep(2.8 - e, 2.8 + e, y) * (1.0 - smoothstep(97.2 - e, 97.2 + e, y));
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

/** 모든 효과가 공유하는 껍데기. 앞에 프렐류드, 뒤에 main 이 붙는다.
 *  texA/texB/texC 는 효과별 텍스처 (EFFECT_TEXTURES 로 선언). 안 쓰면 카드가 들어온다. */
const SHELL_HEAD = `
uniform shader card;
uniform shader maskT;
uniform shader foilT;
uniform shader texA;
uniform shader texB;
uniform shader texC;
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
uniform float2 texASize;   // texA 원본 픽셀 크기 (타일링에 필요)
uniform float3 glow;       // --card-glow (카드 타입별)
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

// ─────────────────────────────────────────────────────────────
// v-full-art (Rare Ultra) — sunpillar 계열의 기준.
//   원본: public/css/cards/v-full-art.css
//   shine 배경이 4겹이다. 아래에서 위로:
//     ④ 포인터 원형 어둠  ③ 133° 청록 띠  ② 0° sunpillar 6색  ① 포일 텍스처
//   블렌드 목록 soft-light, hue, hard-light 는 위 레이어부터 매핑된다.
// ─────────────────────────────────────────────────────────────
const SUNPILLAR = `
const float3 SP1 = float3(1.0000, 0.4780, 0.4600); // hsl(2,100%,73%)
const float3 SP2 = float3(1.0000, 0.9277, 0.3800); // hsl(53,100%,69%)
const float3 SP3 = float3(0.6590, 1.0000, 0.3800); // hsl(93,100%,69%)
const float3 SP4 = float3(0.5200, 1.0000, 0.9680); // hsl(176,100%,76%)
const float3 SP5 = float3(0.4800, 0.5840, 1.0000); // hsl(228,100%,74%)
const float3 SP6 = float3(0.8470, 0.4600, 1.0000); // hsl(283,100%,73%)

// base.css 는 .card__shine / :before / :after 마다 6색 순서를 돌려 쓴다.
//  shine=[1..6], :before=[5,6,1,2,3,4], :after=[6,1,2,3,4,5]
int czMod6(int v) { return v - 6 * (v / 6); }

float3 spPick(int i, int rot) {
  int k = czMod6(i + rot);
  if (k == 0) { return SP1; }
  if (k == 1) { return SP2; }
  if (k == 2) { return SP3; }
  if (k == 3) { return SP4; }
  if (k == 4) { return SP5; }
  return SP6;
}

// repeating-linear-gradient(0deg, clr1 5%, clr2 10% ... clr1 35%)
//  스톱 7개가 5% 간격 → 주기는 30%. 0deg 는 "아래에서 위로".
float3 spRamp(float t, int rot) {
  float u = mod((t - 0.05) / 0.30, 1.0) * 6.0;
  int i = int(floor(u));
  return mix(spPick(i, rot), spPick(i + 1, rot), fract(u));
}
`

const VFA_COMMON = `
const float3 VFA_DARK = float3(0.0549, 0.0824, 0.1804); // #0e152e
const float3 VFA_MID  = float3(0.5600, 0.6400, 0.6400); // hsl(180,10%,60%)
const float3 VFA_HI   = float3(0.5614, 0.7586, 0.7586); // hsl(180,29%,66%)

// repeating-linear-gradient(133deg, #0e152e 0%, mid 3.8%, hi 4.5%, mid 5.2%, #0e152e 10%, #0e152e 12%)
//  주기 12%. 10~12% 구간은 계속 어둡다.
float3 vfaBand(float t) {
  float u = mod(t, 0.12);
  if (u < 0.038) { return mix(VFA_DARK, VFA_MID, u / 0.038); }
  if (u < 0.045) { return mix(VFA_MID, VFA_HI, (u - 0.038) / 0.007); }
  if (u < 0.052) { return mix(VFA_HI, VFA_MID, (u - 0.045) / 0.007); }
  if (u < 0.100) { return mix(VFA_MID, VFA_DARK, (u - 0.052) / 0.048); }
  return VFA_DARK;
}

// shine 배경 4겹 합성. after=1 이면 :after 쪽 위치/크기/색순서를 쓴다.
//  배경 레이어는 아래에서 위로 쌓고, 알파를 끝까지 들고 간다.
//  ④ 는 알파 0.1~0.25 의 검정이라 위 레이어가 대부분 그대로 통과한다.
float4 vfaShineBg(float2 xy, int after) {
  float bx = bgp.x;
  float by = bgp.y;

  // ④ 맨 아래: radial(farthest-corner circle at pointer) size 200% 100%, pos bgx bgy
  float2 s4 = float2(2.0, 1.0);
  float2 q4 = czBgXY(xy, res, s4, float2(bx, by));
  float2 t4box = res * s4;
  float4 r = czGrad3(czRadCircleT(q4, t4box, pointer * t4box),
    float4(0.0, 0.0, 0.0, 0.10), 0.12,
    float4(0.0, 0.0, 0.0, 0.15), 0.20,
    float4(0.0, 0.0, 0.0, 0.25), 1.20);

  // ③ 133° 청록 띠 — size 300%/195% × 100%, pos (bgx + bgy*0.2) bgy  (:after 는 부호 반전)
  float2 s3 = after == 1 ? float2(1.95, 1.0) : float2(3.0, 1.0);
  float px3 = bx + by * 0.2;
  float2 p3 = after == 1 ? float2(-px3, -by) : float2(px3, by);
  float2 q3 = czBgXY(xy, res, s3, p3);
  float3 l3 = vfaBand(czLinT(q3, res * s3, 133.0));
  r = czComposite(${BLEND['hard-light']}, r, float4(l3, 1.0));

  // ② sunpillar 6색 — size 200% × 700%/400%, pos 0% bgy
  float2 s2 = after == 1 ? float2(2.0, 4.0) : float2(2.0, 7.0);
  float2 q2 = czBgXY(xy, res, s2, float2(0.0, by));
  float3 l2 = spRamp(czLinT(q2, res * s2, 0.0), after == 1 ? 5 : 0);
  r = czComposite(${BLEND.hue}, r, float4(l2, 1.0));

  // ① 맨 위: 포일 텍스처. 마스크가 있으면 cover, 없으면 illusion 33% 타일.
  float4 l1 = hasFoil > 0.5
    ? float4(foilT.eval(xy))
    : float4(texA.eval(mod(xy, res * 0.33)));
  int topBlend = hasFoil > 0.5 ? ${BLEND['soft-light']} : ${BLEND.exclusion};
  r = czComposite(topBlend, r, l1);
  return r;
}
`

const V_FULL_ART = `
${SUNPILLAR}
${VFA_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float2 at = pointer * res;

  if (opacity > 0.001 && m > 0.001) {
    // shine 본체
    float4 sh4 = vfaShineBg(xy, 0);
    float3 sh = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.4 + 0.4), 1.4), 2.25)
      : czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.3 + 0.35), 2.0), 1.5);

    // :before — 포인터 흰 점, overlay, opacity .75 (마스크 없을 땐 display:none)
    if (hasFoil > 0.5) {
      float4 gb = czGrad2(czRadCircleT(xy, res, at),
        float4(1.0, 1.0, 1.0, 1.0), 0.00,
        float4(0.0, 0.0, 0.0, 0.0), 0.40);
      sh = czOver(${BLEND.overlay}, sh, gb.rgb, gb.a * 0.75);
    }

    // :after — 같은 4겹을 다른 위치/색순서로 만들어 exclusion
    float4 sa4 = vfaShineBg(xy, 1);
    float3 sa = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.4 + 0.8), 1.5), 1.25)
      : czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.5 + 0.8), 1.6), 1.4);
    sh = czOver(${BLEND.exclusion}, sh, sa, sa4.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }

  // glare — size 120% 150%, hard-light, opacity *.75
  float go = opacity * 0.75;
  if (go > 0.001) {
    float2 sg = float2(1.2, 1.5);
    float2 qg = czBgXY(xy, res, sg, float2(50.0));
    float2 gbox = res * sg;
    float4 g = czGrad3(czRadCircleT(qg, gbox, pointer * gbox),
      float4(0.7500, 0.7500, 0.7500, 1.0), 0.05,
      float4(0.3325, 0.3558, 0.3675, 1.0), 0.60,
      float4(0.1400, 0.0600, 0.1133, 1.0), 1.50);
    float3 cg = czSaturate(czContrast(czBright(g.rgb, 1.0), 1.2), 1.0);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// trainer-full-art — v-full-art 를 상속하고 필터만 다르다.
//   :before 가 다른 그라디언트(80% 까지 퍼지는 흰 점, screen, opacity .5),
//   glare 는 multiply + size 170%.
//   원본: public/css/cards/trainer-full-art.css
// ─────────────────────────────────────────────────────────────
const TRAINER_FULL_ART = `
${SUNPILLAR}
${VFA_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float2 at = pointer * res;

  if (opacity > 0.001 && m > 0.001) {
    float4 sh4 = vfaShineBg(xy, 0);
    float3 sh = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.05 + 0.8), 1.75), 1.2)
      : czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.05 + 0.6), 1.5), 1.2);

    // :before — screen, opacity .5, 80% 까지 퍼진다
    float4 gb = czGrad2(czRadCircleT(xy, res, at),
      float4(1.0, 1.0, 1.0, 1.0), 0.00,
      float4(0.0, 0.0, 0.0, 0.0), 0.80);
    sh = czOver(${BLEND.screen}, sh, gb.rgb, gb.a * 0.5);

    float4 sa4 = vfaShineBg(xy, 1);
    float3 sa = czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.4 + 0.85), 2.0), 0.5);
    sh = czOver(${BLEND.exclusion}, sh, sa, sa4.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }

  // glare — base.css 의 흰 radial 을 size 170% 로, multiply
  float go = opacity * 0.75;
  if (go > 0.001) {
    float2 sg = float2(1.7);
    float2 qg = czBgXY(xy, res, sg, float2(50.0));
    float2 gbox = res * sg;
    float4 g = czGrad3(czRadCircleT(qg, gbox, pointer * gbox),
      float4(1.0, 1.0, 1.0, 0.80), 0.10,
      float4(1.0, 1.0, 1.0, 0.65), 0.20,
      float4(0.0, 0.0, 0.0, 0.50), 0.90);
    float3 cg = czSaturate(czContrast(czBright(g.rgb, 1.5), 1.4), 1.0);
    col = czOver(${BLEND.multiply}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// tg-v (갤러리 V) — shine 은 v-full-art 그대로, glare 만 base.css + opacity ×.4
//   원본: trainer-gallery-v-regular.css (glare 규칙 한 줄뿐)
//   갤러리 카드는 v-full-art 의 :before 선택자에 안 걸려서 흰 점이 없다.
// ─────────────────────────────────────────────────────────────
const TG_V = `
${SUNPILLAR}
${VFA_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  if (opacity > 0.001 && m > 0.001) {
    float4 sh4 = vfaShineBg(xy, 0);
    float3 sh = czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.4 + 0.4), 1.4), 2.25);
    float4 sa4 = vfaShineBg(xy, 1);
    float3 sa = czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.4 + 0.8), 1.5), 1.25);
    sh = czOver(${BLEND.exclusion}, sh, sa, sa4.a);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }

  float go = opacity * 0.4;
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(1.0, 1.0, 1.0, 0.80), 0.10,
      float4(1.0, 1.0, 1.0, 0.65), 0.20,
      float4(0.0, 0.0, 0.0, 0.50), 0.90);
    col = czOver(${BLEND.overlay}, col, g.rgb, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// trainer-gallery-holo — 무지개 띠 -22° 한 겹 + 타원 광택
//   원본: public/css/cards/trainer-gallery-holo.css
//   홀로가 카드 거의 전체에 뜬다 (clip-borders = 얇은 테두리만 뺀 영역).
// ─────────────────────────────────────────────────────────────
const TRAINER_GALLERY_HOLO = `
const float4 TGH1 = float4(0.6849, 0.4040, 0.7960, 0.75);
const float4 TGH2 = float4(0.8934, 0.3068, 0.2866, 0.75);
const float4 TGH3 = float4(0.8449, 0.7714, 0.2151, 0.75);
const float4 TGH4 = float4(0.4931, 0.7888, 0.2512, 0.75);
const float4 TGH5 = float4(0.3100, 0.6900, 0.6647, 0.75);
const float4 TGH6 = float4(0.5400, 0.6320, 1.0000, 0.75);

float4 tghPick(int i) {
  int k = i - 6 * (i / 6);
  if (k == 0) { return TGH1; }
  if (k == 1) { return TGH2; }
  if (k == 2) { return TGH3; }
  if (k == 3) { return TGH4; }
  if (k == 4) { return TGH5; }
  return TGH6;
}

// 스톱 7개가 5% 간격 → 주기 30%
float4 tghRamp(float t) {
  float u = mod((t - 0.05) / 0.30, 1.0) * 6.0;
  int i = int(floor(u));
  return mix(tghPick(i), tghPick(i + 1), fract(u));
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxBorders(uv) * hxMask(xy, uv);  // clip-borders + 카드 마스크
  if (opacity > 0.001 && m > 0.001) {
    // 무지개 띠 — size 300% 400%, pos 0% bgy, -22deg
    float2 sz = float2(3.0, 4.0);
    float2 q = czBgXY(xy, res, sz, float2(0.0, bgp.y));
    float4 rb = tghRamp(czLinT(q, res * sz, -22.0));
    float3 sh = rb.rgb * rb.a; // 알파 .75 를 검정 위에 얹은 셈
    sh = czSaturate(czContrast(czBright(sh, pfc * 0.3 + 0.5), 2.3), 1.0);

    // :after — 타원 광택. 중심이 포인터의 절반만 따라간다 (px*0.5+25%)
    float2 sa = float2(4.0, 5.0);
    float2 qa = czBgXY(xy, res, sa, float2(50.0));
    float2 abox = res * sa;
    float2 aat = float2(pointer.x * 0.5 + 0.25, pointer.y * 0.5 + 0.25) * abox;
    float4 ga = czGrad3(czRadEllipseT(qa, abox, aat),
      float4(1.0000, 1.0000, 1.0000, 1.0), 0.05,
      float4(0.2200, 0.0000, 0.2200, 0.6), 0.40,
      float4(0.2200, 0.2200, 0.2200, 1.0), 1.20);
    float3 caf = czSaturate(czContrast(czBright(ga.rgb, pfc * 0.2 + 0.4), 0.85), 1.1);
    sh = czOver(${BLEND['hard-light']}, sh, caf, ga.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity);
  }

  // glare — soft-light
  if (opacity > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(1.0000, 1.0000, 1.0000, 1.0), 0.10,
      float4(1.0000, 1.0000, 1.0000, 0.6), 0.35,
      float4(0.3115, 0.3885, 0.3885, 1.0), 0.60);
    col = czOver(${BLEND['soft-light']}, col, g.rgb, g.a * opacity);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// v-regular (Rare Holo V) — v-full-art 와 골격이 같고 최상단만 다르다.
//   포일 대신 grain 텍스처를 screen 으로 얹는다. 133° 띠 위치도 다르다.
//   원본: public/css/cards/v-regular.css
// ─────────────────────────────────────────────────────────────
const V_REGULAR = `
${SUNPILLAR}
const float3 VFA_DARK = float3(0.0549, 0.0824, 0.1804);
const float3 VFA_MID  = float3(0.5600, 0.6400, 0.6400);
const float3 VFA_HI   = float3(0.5614, 0.7586, 0.7586);

float3 vfaBand(float t) {
  float u = mod(t, 0.12);
  if (u < 0.038) { return mix(VFA_DARK, VFA_MID, u / 0.038); }
  if (u < 0.045) { return mix(VFA_MID, VFA_HI, (u - 0.038) / 0.007); }
  if (u < 0.052) { return mix(VFA_HI, VFA_MID, (u - 0.045) / 0.007); }
  if (u < 0.100) { return mix(VFA_MID, VFA_DARK, (u - 0.052) / 0.048); }
  return VFA_DARK;
}

// grain — background-size: 500px 100%, position center, 기본 repeat
float4 vrGrain(float2 xy) {
  float2 tile = float2(hxPx(500.0), res.y);
  float2 q = xy - 0.5 * (res - tile);
  return float4(texA.eval(fract(q / tile) * texASize));
}

float4 vrShineBg(float2 xy, int after) {
  float bx = bgp.x;
  float by = bgp.y;

  // ④ 포인터 원형 어둠 — size 200% 100%, pos bgx bgy
  float2 s4 = float2(2.0, 1.0);
  float2 q4 = czBgXY(xy, res, s4, float2(bx, by));
  float2 b4 = res * s4;
  float4 r = czGrad3(czRadCircleT(q4, b4, pointer * b4),
    float4(0.0, 0.0, 0.0, 0.10), 0.12,
    float4(0.0, 0.0, 0.0, 0.15), 0.20,
    float4(0.0, 0.0, 0.0, 0.25), 1.20);

  // ③ 133° 띠 — v-regular 은 위치가 bgx bgy 그대로 (:after 는 부호 반전)
  float2 s3 = after == 1 ? float2(1.95, 1.0) : float2(3.0, 1.0);
  float2 p3 = after == 1 ? float2(-bx, -by) : float2(bx, by);
  float2 q3 = czBgXY(xy, res, s3, p3);
  r = czComposite(${BLEND['hard-light']}, r, float4(vfaBand(czLinT(q3, res * s3, 133.0)), 1.0));

  // ② sunpillar 6색 — size 200% × 700%/400%, pos 0% bgy
  float2 s2 = after == 1 ? float2(2.0, 4.0) : float2(2.0, 7.0);
  float2 q2 = czBgXY(xy, res, s2, float2(0.0, by));
  float3 l2 = spRamp(czLinT(q2, res * s2, 0.0), after == 1 ? 5 : 0);
  r = czComposite(${BLEND.hue}, r, float4(l2, 1.0));

  // ① grain — screen
  r = czComposite(${BLEND.screen}, r, vrGrain(xy));
  return r;
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  if (opacity > 0.001 && m > 0.001) {
    float4 sh4 = vrShineBg(xy, 0);
    float3 sh = czSaturate(czContrast(czBright(sh4.rgb, 0.8), 2.95), 0.65);

    // :after — soft-light
    float4 sa4 = vrShineBg(xy, 1);
    float3 sa = czSaturate(czContrast(czBright(sa4.rgb, 1.0), 2.5), 1.75);
    sh = czOver(${BLEND['soft-light']}, sh, sa, sa4.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }

  // glare — hard-light, opacity ×.5
  float go = opacity * 0.5;
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(1.0000, 1.0000, 1.0000, 1.00), 0.00,
      float4(0.5262, 0.5400, 0.5538, 0.33), 0.45,
      float4(0.2000, 0.2000, 0.2000, 0.90), 1.30);
    float3 cg = czContrast(czBright(g.rgb, 0.9), 1.75);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// v-max (Rare Holo VMAX) — 골격이 v 계열과 다르다.
//   레이어 ④ 가 포인터 기준 파스텔 4색 radial 이고, ② 는 -33° 5색,
//   ③ 은 133° 청록/올리브 띠. :after 는 sunpillar 만 따로 lighten 으로 얹는다.
//   원본: public/css/cards/v-max.css
// ─────────────────────────────────────────────────────────────
const V_MAX = `
${SUNPILLAR}
const float3 VFA_DARK = float3(0.0549, 0.0824, 0.1804);
const float3 VFA_MID  = float3(0.5600, 0.6400, 0.6400);
const float3 VFA_HI   = float3(0.5614, 0.7586, 0.7586);

float3 vfaBand(float t) {
  float u = mod(t, 0.12);
  if (u < 0.038) { return mix(VFA_DARK, VFA_MID, u / 0.038); }
  if (u < 0.045) { return mix(VFA_MID, VFA_HI, (u - 0.038) / 0.007); }
  if (u < 0.052) { return mix(VFA_HI, VFA_MID, (u - 0.045) / 0.007); }
  if (u < 0.100) { return mix(VFA_MID, VFA_DARK, (u - 0.052) / 0.048); }
  return VFA_DARK;
}

const float3 VM_A1 = float3(0.7990, 0.1629, 0.1410); // hsl(2,70%,47%)
const float3 VM_A2 = float3(0.4240, 0.5104, 0.8560); // hsl(228,60%,64%)
const float3 VM_A3 = float3(0.1755, 0.6045, 0.5759); // hsl(176,55%,39%)
const float3 VM_A4 = float3(0.1120, 0.5880, 0.1358); // hsl(123,68%,35%)
const float3 VM_A5 = float3(0.7098, 0.2475, 0.8925); // hsl(283,75%,57%)

// repeating-linear-gradient(-33deg, 6% 간격 6스톱) → 주기 30%
float3 vmRamp(float t) {
  float u = mod((t - 0.06) / 0.30, 1.0) * 5.0;
  int i = int(floor(u));
  float f = fract(u);
  float3 a = i == 0 ? VM_A1 : i == 1 ? VM_A2 : i == 2 ? VM_A3 : i == 3 ? VM_A4 : VM_A5;
  float3 b = i == 0 ? VM_A2 : i == 1 ? VM_A3 : i == 2 ? VM_A4 : i == 3 ? VM_A5 : VM_A1;
  return mix(a, b, f);
}

const float4 VM_B0 = float4(0.0564, 0.0840, 0.1836, 0.5); // hsla(227,53%,12%,.5)
const float3 VM_B1 = float3(0.4500, 0.5500, 0.5500);      // hsl(180,10%,50%)
const float3 VM_B2 = float3(0.3908, 0.5250, 0.1750);      // hsl(83,50%,35%)

// repeating-linear-gradient(133deg, 0% / 2.5% / 5% / 7.5% / 10% .. 15%) → 주기 15%
float4 vmBand(float t) {
  float u = mod(t, 0.15);
  if (u < 0.025) { return mix(VM_B0, float4(VM_B1, 1.0), u / 0.025); }
  if (u < 0.050) { return mix(float4(VM_B1, 1.0), float4(VM_B2, 1.0), (u - 0.025) / 0.025); }
  if (u < 0.075) { return mix(float4(VM_B2, 1.0), float4(VM_B1, 1.0), (u - 0.050) / 0.025); }
  if (u < 0.100) { return mix(float4(VM_B1, 1.0), VM_B0, (u - 0.075) / 0.025); }
  return VM_B0;
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float bx = bgp.x;
  float by = bgp.y;

  if (opacity > 0.001 && m > 0.001) {
    // ④ 맨 아래: 포인터 파스텔 4색 radial — size 200% 200%, pos bgx bgy
    float2 s4 = float2(2.0);
    float2 q4 = czBgXY(xy, res, s4, float2(bx, by));
    float2 b4 = res * s4;
    float4 r = czGrad4(czRadCircleT(q4, b4, pointer * b4),
      float4(0.5952, 0.8924, 0.9448, 0.6), 0.00,
      float4(0.6343, 0.9057, 0.7564, 0.6), 0.25,
      float4(0.6957, 0.5195, 0.8605, 0.6), 0.50,
      float4(0.8768, 0.5632, 0.5893, 0.6), 0.75);

    // ③ 133° 띠 — size 600% 600%, pos bgx bgy → soft-light
    float2 s3 = float2(6.0);
    float2 q3 = czBgXY(xy, res, s3, float2(bx, by));
    r = czComposite(${BLEND['soft-light']}, r, vmBand(czLinT(q3, res * s3, 133.0)));

    // ② -33° 5색 — size 1100% 1100%, pos bgx bgy → luminosity
    float2 s2 = float2(11.0);
    float2 q2 = czBgXY(xy, res, s2, float2(bx, by));
    r = czComposite(${BLEND.luminosity}, r, float4(vmRamp(czLinT(q2, res * s2, -33.0)), 1.0));

    // ① 포일 (cover) 또는 vmaxbg 60% 30% 타일 → difference
    float4 l1 = hasFoil > 0.5
      ? float4(foilT.eval(xy))
      : float4(texA.eval(fract(xy / (res * float2(0.6, 0.3))) * texASize));
    r = czComposite(${BLEND.difference}, r, l1);

    float3 sh = czSaturate(czContrast(czBright(r.rgb, pfc * 0.4 + 0.4), 2.0), 1.0);

    // :after — sunpillar + 133° 띠만. lighten, 자체 opacity.
    float2 as2 = float2(2.0, 7.0);
    float2 aq2 = czBgXY(xy, res, as2, float2(0.0, by));
    // --space 가 6% 이므로 주기는 36%
    float at = czLinT(aq2, res * as2, 0.0);
    float au = mod((at - 0.06) / 0.36, 1.0) * 6.0;
    int ai = int(floor(au));
    float3 al1 = mix(spPick(ai, 5), spPick(ai + 1, 5), fract(au));

    float2 as3 = float2(3.0, 1.0);
    float2 aq3 = czBgXY(xy, res, as3, float2(bx, by));
    float4 ar = float4(vfaBand(czLinT(aq3, res * as3, 133.0)), 1.0);
    ar = czComposite(${BLEND.hue}, ar, float4(al1, 1.0));
    float3 sa = czSaturate(ar.rgb, 1.5);
    float ao = clamp(0.3 * opacity + opacity * pfc * 0.5, 0.0, 1.0);
    sh = czOver(${BLEND.lighten}, sh, sa, ao);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — hard-light, opacity 0.2*co + co*pfc*0.8
  float go = clamp(0.2 * opacity + opacity * pfc * 0.8, 0.0, 1.0);
  if (go > 0.001) {
    float4 g = czGrad2(czRadCircleT(xy, res, pointer * res),
      float4(1.0, 1.0, 1.0, 0.75), 0.00,
      float4(0.0, 0.0, 0.0, 1.00), 1.20);
    col = czOver(${BLEND['hard-light']}, col, g.rgb, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// v-star (Rare Holo VSTAR) — v-full-art 골격 + ::before + 마스크 2겹.
//   마스크가 mask + radial 두 장이고 기본 mask-composite 는 add 라서
//   포인터에서 멀어질수록 알파가 최대 .5 만큼 "더해진다".
//   원본: public/css/cards/v-star.css
// ─────────────────────────────────────────────────────────────
const V_STAR = `
${SUNPILLAR}
${VFA_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  // 마스크 2겹: var(--mask) 와 radial 을 add 로 합친다
  float m = hxMask(xy, uv);
  float4 mg = czGrad2(czRadCircleT(xy, res, pointer * res),
    float4(1.0, 1.0, 1.0, 0.0), 0.00,
    float4(1.0, 1.0, 1.0, 0.5), 1.20);
  m = m + mg.a * (1.0 - m);

  if (opacity > 0.001 && m > 0.001) {
    float4 sh4 = vfaShineBg(xy, 0);
    float3 sh = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.75 + 0.25), 2.0), 1.25)
      : czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.25 + 0.35), 1.8), 1.75);

    // ::before — hard-light, opacity .8
    float4 pb = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(0.7860, 0.8093, 0.8140, 0.75), 0.00,
      float4(0.4883, 0.4650, 0.5350, 0.25), 0.45,
      float4(0.5350, 0.4650, 0.5233, 1.00), 1.20);
    sh = czOver(${BLEND['hard-light']}, sh, pb.rgb, pb.a * 0.8);

    // :after — exclusion
    float4 sa4 = vfaShineBg(xy, 1);
    float3 sa = czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.75 + 0.5), 1.5), 1.5);
    sh = czOver(${BLEND.exclusion}, sh, sa, sa4.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }

  // glare — hard-light, opacity co*(pfc*.75)
  float go = clamp(opacity * (pfc * 0.75), 0.0, 1.0);
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(0.8100, 0.9450, 0.9900, 1.0), 0.05,
      float4(0.6120, 0.5880, 0.6120, 1.0), 0.60,
      float4(0.1500, 0.1500, 0.1500, 1.0), 1.50);
    float3 cg = hasFoil > 0.5
      ? czContrast(czBright(g.rgb, 0.7), 2.0)
      : czContrast(czBright(g.rgb, 0.55), 2.0);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// 레인보우 계열 공용 — r-clr 7색 램프와 glitter 타일.
//   원본은 7색을 3번 늘어놓아 스톱 22개를 만든다 (반복 그라디언트가 아니다).
//   clr-4 와 clr-5 가 같은 색이라 중간에 평평한 구간이 생긴다.
// ─────────────────────────────────────────────────────────────
const RAINBOW_COMMON = `
const float3 RC1 = float3(0.5809, 0.1591, 0.1591); // hsl(0,57%,37%)
const float3 RC2 = float3(0.5967, 0.4589, 0.1833); // hsl(40,53%,39%)
const float3 RC3 = float3(0.3500, 0.5600, 0.1400); // hsl(90,60%,35%)
const float3 RC4 = float3(0.1400, 0.5600, 0.5600); // hsl(180,60%,35%)
const float3 RC6 = float3(0.1677, 0.3900, 0.6123); // hsl(210,57%,39%)
const float3 RC7 = float3(0.3668, 0.1395, 0.4805); // hsl(280,55%,31%)

float3 rcPick(int i) {
  int k = i - 7 * (i / 7);
  if (k == 0) { return RC1; }
  if (k == 1) { return RC2; }
  if (k == 2) { return RC3; }
  if (k == 3) { return RC4; }
  if (k == 4) { return RC4; }   // clr-5 는 clr-4 와 같은 색
  if (k == 5) { return RC6; }
  return RC7;
}

// 스톱 22개가 0~100% 에 균등 배치 → 세그먼트 21개
float3 rcRamp(float t) {
  float u = clamp(t, 0.0, 1.0) * 21.0;
  int i = int(floor(min(u, 20.999)));
  return mix(rcPick(i), rcPick(i + 1), fract(u));
}

// glitter — background-size: 25% 25%, position 은 효과마다 다르다
float4 rcGlitter(float2 xy, float2 posPct) {
  float2 tile = res * 0.25;
  float2 q = xy - posPct / 100.0 * (res - tile);
  return float4(texA.eval(fract(q / tile) * texASize));
}
`

// ─────────────────────────────────────────────────────────────
// rainbow-holo (Rare Rainbow) — 파스텔 무지개 + 반짝이.
//   원본: public/css/cards/rainbow-holo.css
//   :after 와 :before 는 mask-image: none 이라 카드 전체에 뜬다.
// ─────────────────────────────────────────────────────────────
const RAINBOW_HOLO = `
${RAINBOW_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float2 at = pointer * res;

  if (opacity > 0.001 && m > 0.001) {
    // .card__shine 은 filter + mix-blend-mode 로 스태킹 컨텍스트를 만든다.
    //  → :before / :after 는 카드가 아니라 "shine 의 배경" 위에 먼저 합성되고,
    //    그 결과 전체에 shine 의 필터가 걸린 뒤에야 카드에 color-dodge 된다.
    // ③ 맨 아래: -30° 무지개 램프, size 400%, pos (25 + px/2, 25 + py/2)
    float2 s3 = float2(4.0);
    float2 p3 = float2(25.0 + pointer.x * 100.0 * 0.5, 25.0 + pointer.y * 100.0 * 0.5);
    float2 q3 = czBgXY(xy, res, s3, p3);
    float4 r = float4(rcRamp(czLinT(q3, res * s3, -30.0)), 1.0);

    // ② glitter, center → soft-light
    r = czComposite(${BLEND['soft-light']}, r, rcGlitter(xy, float2(50.0)));

    // ① -45° 2색, size 200%, pos (25 + 50*pfl, 25 + 50*pft) → luminosity
    float2 s1 = float2(2.0);
    float2 p1 = float2(25.0 + 50.0 * pfl, 25.0 + 50.0 * pft);
    float2 q1 = czBgXY(xy, res, s1, p1);
    float4 g1 = czGrad2(czLinT(q1, res * s1, -45.0),
      float4(RC1, 1.0), 0.0, float4(RC4, 1.0), 1.0);
    r = czComposite(${BLEND.luminosity}, r, g1);

    // :before — 포일을 darken 으로 shine 배경 위에 (opacity (pfc+.4)*.6)
    float4 fb = hasFoil > 0.5
      ? float4(foilT.eval(xy))
      : float4(texB.eval(fract(xy / (res * 0.33)) * texASize));
    float3 fbc = czContrast(czBright(fb.rgb, 2.5), 1.0);
    float fo = clamp((pfc + 0.4) * 0.6, 0.0, 1.0);
    r = float4(czOver(${BLEND.darken}, r.rgb, fbc, fo), r.a);

    // :after — glitter + -60° 램프를 color-dodge 로
    float2 s4 = float2(4.0);
    float2 q4 = czBgXY(xy, res, s4, pointer * 100.0);
    float4 ra = float4(rcRamp(czLinT(q4, res * s4, -60.0)), 1.0);
    ra = czComposite(${BLEND['soft-light']}, ra, rcGlitter(xy, float2(50.0)));
    float3 sa = czSaturate(czContrast(czBright(ra.rgb, pfc * 0.3 + 0.55), 2.0), 1.0);
    r = float4(czOver(${BLEND['color-dodge']}, r.rgb, sa, ra.a), r.a);

    // shine 전체 필터 → 카드에 color-dodge
    float3 sh = czSaturate(czContrast(czBright(r.rgb, pfc * 0.25 + 0.6), 2.2), 0.75);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — hard-light, opacity pfc*0.9
  float go = clamp(pfc * 0.9, 0.0, 1.0) * opacity;
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, at),
      float4(0.8000, 0.8000, 0.8000, 1.00), 0.00,
      float4(0.8350, 0.8615, 0.8650, 0.25), 0.30,
      float4(0.2350, 0.2565, 0.2650, 1.00), 1.20);
    float3 cg = czContrast(czBright(g.rgb, 0.9), 1.75);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// rainbow-alt (Rare Rainbow Alt / 갤러리 VMAX) — 133° 파스텔 띠 + 무지개 + 반짝이.
//   원본: public/css/cards/rainbow-alt.css
// ─────────────────────────────────────────────────────────────
const rainbowAlt = (glare: string) => `
${RAINBOW_COMMON}

const float4 RA1 = float4(0.6849, 0.4040, 0.7960, 0.75);
const float4 RA2 = float4(0.8740, 0.3056, 0.2860, 0.75);
const float4 RA3 = float4(0.8449, 0.7714, 0.2151, 0.75);
const float4 RA4 = float4(0.4931, 0.7888, 0.2512, 0.75);
const float4 RA5 = float4(0.3100, 0.6900, 0.6647, 0.75);
const float4 RA6 = float4(0.5400, 0.6320, 1.0000, 0.75);

float4 raPick(int i) {
  int k = i - 6 * (i / 6);
  if (k == 0) { return RA1; }
  if (k == 1) { return RA2; }
  if (k == 2) { return RA3; }
  if (k == 3) { return RA4; }
  if (k == 4) { return RA5; }
  return RA6;
}

// repeating-linear-gradient(133deg, 5% 간격 7스톱) → 주기 30%
float4 raBand(float t) {
  float u = mod((t - 0.05) / 0.30, 1.0) * 6.0;
  int i = int(floor(u));
  return mix(raPick(i), raPick(i + 1), fract(u));
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);

  if (opacity > 0.001) {
    // ③ 맨 아래: -30° 무지개, size 400%, pos (bgx*1.5, bgy*1.5)
    float2 s3 = float2(4.0);
    float2 q3 = czBgXY(xy, res, s3, bgp * 1.5);
    float4 r = float4(rcRamp(czLinT(q3, res * s3, -30.0)), 1.0);

    // ② glitter, center → overlay
    r = czComposite(${BLEND.overlay}, r, rcGlitter(xy, float2(50.0)));

    // ① 133° 파스텔 띠, size 200% 400%, pos 0% bgy → luminosity
    float2 s1 = float2(2.0, 4.0);
    float2 q1 = czBgXY(xy, res, s1, float2(0.0, bgp.y));
    r = czComposite(${BLEND.luminosity}, r, raBand(czLinT(q1, res * s1, 133.0)));

    // :before — 포일을 color-dodge 로 shine 배경 위에. 마스크 없는 카드는 --foil: none.
    if (hasFoil > 0.5) {
      float4 fb = float4(foilT.eval(xy));
      float3 fbc = czContrast(czBright(fb.rgb, 1.5), 1.5);
      float fo = clamp((pfc + 0.6) * 0.4, 0.0, 1.0);
      r = float4(czOver(${BLEND['color-dodge']}, r.rgb, fbc, fo), r.a);
    }

    // :after — glitter + -60° 램프를 color-dodge 로
    float2 s4 = float2(4.0);
    float2 q4 = czBgXY(xy, res, s4, bgp * -1.5);
    float4 ra = float4(rcRamp(czLinT(q4, res * s4, -60.0)), 1.0);
    ra = czComposite(${BLEND.overlay}, ra, rcGlitter(xy, float2(50.0)));
    float3 sa = czSaturate(czContrast(czBright(ra.rgb, pfc * 0.5 + 0.6), 3.0), 1.0);
    float ao = clamp(1.2 - pfc * 0.5, 0.0, 1.0);
    r = float4(czOver(${BLEND['color-dodge']}, r.rgb, sa, ao * ra.a), r.a);

    float3 sh = czSaturate(czContrast(czBright(r.rgb, pfc * 0.3 + 0.3), 3.0), 1.8);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

${glare}
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// amazing-rare (Amazing Rare) — 반짝이 두 겹을 서로 어긋나게 깔고 color-burn.
//   원본: public/css/cards/amazing-rare.css
//   :after 가 sunpillar 를 saturation 으로 얹어 색만 입힌다.
// ─────────────────────────────────────────────────────────────
const AMAZING_RARE = `
${SUNPILLAR}
${RAINBOW_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  // 마스크 없는 카드는 clip-path: var(--clip) = 그림창
  float m = hasFoil > 0.5 ? float(maskT.eval(xy).a) : hxArtMask(uv);
  float2 at = pointer * res;
  float t = czRadCircleT(xy, res, at);

  if (opacity > 0.001) {
    // ── shine ── 반짝이 2겹 (40%/45%, 55%/55%) + 포인터 radial
    float4 r = czGrad3(t,
      float4(0.0800, 0.1200, 0.1000, 1.00), 0.10,
      float4(0.7560, 0.8440, 0.8396, 0.10), 0.50,
      float4(0.9500, 0.9500, 0.9500, 0.98), 0.90);
    r = czComposite(${BLEND['color-burn']}, r, rcGlitter(xy, float2(55.0, 55.0)));
    r = czComposite(${BLEND['soft-light']}, r, rcGlitter(xy, float2(40.0, 45.0)));
    // :before — 포일 + radial 을 color-burn 한 뒤 shine 배경 위에 lighten (opacity .5)
    float4 pb = czGrad3(t,
      float4(0.9200, 0.9133, 0.8800, 0.95), 0.10,
      float4(0.7098, 0.5451, 0.6431, 0.50), 0.50,
      float4(0.0000, 0.0000, 0.0000, 1.00), 0.60);
    float4 fb = hasFoil > 0.5 ? float4(foilT.eval(xy)) : float4(0.0, 0.0, 0.0, 0.0);
    if (fb.a > 0.001) { pb = czComposite(${BLEND['color-burn']}, pb, fb); }
    r = float4(czOver(${BLEND.lighten}, r.rgb, pb.rgb, pb.a * 0.5), r.a);

    // :after — sunpillar 를 saturation 으로. shine 의 채도만 바꾼다.
    float2 s4 = float2(4.0, 8.0);
    float2 p4 = float2(50.0 + (50.0 - bgp.x) * 3.0, 50.0 + (50.0 - bgp.y) * 3.0);
    float2 q4 = czBgXY(xy, res, s4, p4);
    float3 sp = spRamp(czLinT(q4, res * s4, 133.0), 5);
    float3 spf = czBright(sp, clamp(0.75 - pfc * 0.5, 0.0, 1.0));
    r = float4(czBlend(${BLEND.saturation}, r.rgb, spf), r.a);

    float3 sh = czSaturate(czContrast(czBright(r.rgb, 1.0), 1.0), 0.9);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — 마스크 있으면 2겹, 없으면 multiply 한 겹
  if (opacity > 0.001) {
    if (hasFoil > 0.5) {
      float4 gb = czGrad3(t,
        float4(0.9200, 0.9133, 0.8800, 0.45), 0.00,
        float4(0.2400, 0.3600, 0.3000, 0.45), 0.45,
        float4(0.0000, 0.0000, 0.0000, 0.90), 1.20);
      float3 cb = czContrast(czBright(gb.rgb, 0.9), 2.0);
      float4 ga = czGrad3(t,
        float4(0.9200, 0.9133, 0.8800, 0.75), 0.00,
        float4(0.2400, 0.3600, 0.3000, 0.65), 0.45,
        float4(0.0000, 0.0000, 0.0000, 1.00), 0.90);
      float3 ca = czContrast(czBright(ga.rgb, 1.0), 1.5);
      float as = ga.a * m;
      float ao = as + gb.a * (1.0 - as);
      float3 co = as * (1.0 - gb.a) * ca
                + as * gb.a * czBlend(${BLEND.overlay}, cb, ca)
                + (1.0 - as) * gb.a * cb;
      float3 cg = ao > 0.0 ? co / ao : float3(0.0);
      col = czOver(${BLEND.overlay}, col, cg, ao * opacity);
    } else {
      float4 g = czGrad3(t,
        float4(1.0, 1.0, 1.0, 1.00), 0.10,
        float4(1.0, 1.0, 1.0, 0.85), 0.20,
        float4(0.0, 0.0, 0.0, 0.35), 0.90);
      col = czOver(${BLEND.multiply}, col, g.rgb, g.a * opacity);
    }
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// tg-vmax (갤러리 VMAX) — shine 은 rainbow-alt 그대로,
//   glare 는 trainer-gallery-v-max.css 의 radial 한 겹.
// ─────────────────────────────────────────────────────────────
const RA_GLARE = `
  // glare — base 의 overlay 유지
  float go = opacity * 0.75;
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(0.9200, 0.9133, 0.8800, 0.75), 0.00,
      float4(0.2400, 0.3600, 0.3000, 0.65), 0.45,
      float4(0.0000, 0.0000, 0.0000, 1.00), 1.00);
    float3 cg = czContrast(czBright(g.rgb, 0.9), 2.0);
    col = czOver(${BLEND.overlay}, col, cg, g.a * go);
  }`

// trainer-gallery-v-max.css — radial 한 겹, opacity co*pfc*.85
const TGM_GLARE = `
  float go = clamp(opacity * pfc * 0.85, 0.0, 1.0);
  if (go > 0.001) {
    float4 g = czGrad3(czRadCircleT(xy, res, pointer * res),
      float4(0.9300, 0.9200, 0.8700, 1.0), 0.00,
      float4(0.3800, 0.4200, 0.4080, 1.0), 0.50,
      float4(0.0000, 0.0000, 0.0000, 1.0), 1.20);
    col = czOver(${BLEND.overlay}, col, g.rgb, g.a * go);
  }`

const RAINBOW_ALT = rainbowAlt(RA_GLARE)
const TG_VMAX = rainbowAlt(TGM_GLARE)

// ─────────────────────────────────────────────────────────────
// secret-rare (Rare Secret / 골드) — 21종 중 유일하게 conic-gradient 를 쓴다.
//   금색이 카드 중심을 축으로 빙 돈다.
//   원본: public/css/cards/secret-rare.css
// ─────────────────────────────────────────────────────────────
const secretRare = (extraFilter: string) => `
${SUNPILLAR}
${RAINBOW_COMMON}

const float3 SR_Y1 = float3(0.9750, 0.7533, 0.0250); // hsl(46,95%,50%)
const float3 SR_Y2 = float3(1.0000, 0.9173, 0.3800); // hsl(52,100%,69%)

// conic-gradient(clr-4, clr-5, clr-6, clr-1, clr-4) — 스톱 5개 = 4구간
float3 srConic(float2 xy) {
  float t = czConT(xy, res * 0.5, 0.0) * 4.0;
  int i = int(floor(min(t, 3.999)));
  float f = fract(t);
  float3 a = i == 0 ? SP4 : i == 1 ? SP5 : i == 2 ? SP6 : SP1;
  float3 b = i == 0 ? SP5 : i == 1 ? SP6 : i == 2 ? SP1 : SP4;
  return mix(a, b, f);
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001) {
    // ── shine ── ④ 포인터 radial → ③ conic(overlay) → ② glitter(hard-light) → ① glitter(soft-light)
    float4 r = czGrad2(t,
      float4(0.0000, 0.0000, 0.0000, 0.98), 0.10,
      float4(0.9500, 0.9500, 0.9500, 0.15), 0.90);
    r = czComposite(${BLEND.overlay}, r, float4(srConic(xy), 1.0));
    r = czComposite(${BLEND['hard-light']}, r, rcGlitter(xy, float2(55.0, 55.0)));
    r = czComposite(${BLEND['soft-light']}, r, rcGlitter(xy, float2(45.0, 45.0)));
    // :before — 포일 + 금색 + radial 을 합쳐 shine 배경 위에 lighten (opacity .8)
    float4 pb = czGrad2(t,
      float4(0.9200, 0.8867, 0.8800, 0.95), 0.10,
      float4(0.0000, 0.0000, 0.0000, 1.00), 0.70);
    float3 gold = mix(SR_Y1, SR_Y2, clamp(czLinT(xy, res, 45.0), 0.0, 1.0));
    pb = czComposite(${BLEND.multiply}, pb, float4(gold, 1.0));
    float4 fb = hasFoil > 0.5
      ? float4(foilT.eval(xy))
      : float4(texB.eval(fract(xy / (res * 0.33)) * texASize));
    pb = czComposite(${BLEND['hard-light']}, pb, fb);
    float3 pbf = czSaturate(czContrast(czBright(pb.rgb, 1.25), 1.25), 0.35);
    r = float4(czOver(${BLEND.lighten}, r.rgb, pbf, pb.a * 0.8), r.a);

    // :after — glitter 를 포인터에 따라 1px 어긋나게 깔고 overlay
    float2 tile = res * 0.25;
    float2 q = xy - 0.5 * (res - tile)
             - (float2(1.0) - 2.0 * float2(pfl, pft)) * hxPx(1.0);
    float4 ga = float4(texA.eval(fract(q / tile) * texASize));
    float3 gaf = czContrast(czBright(ga.rgb, pfc * 0.6 + 0.6), 1.5);
    r = float4(czOver(${BLEND.overlay}, r.rgb, gaf, ga.a), r.a);

    float3 sh = ${extraFilter};
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — hard-light
  if (opacity > 0.001) {
    float4 g = czGrad2(t,
      float4(0.8160, 0.8080, 0.7840, 0.3), 0.00,
      float4(0.1380, 0.1152, 0.1020, 1.0), 1.80);
    float3 cg = czContrast(czBright(g.rgb, 1.3), 1.5);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * opacity);
  }
  return col;
}
`

// 마스크 있으면 brightness(0.4 + pfc*0.2) contrast(1) saturate(2.7),
// 없으면 brightness(pfc*0.3 + 0.2) contrast(2) saturate(0.75)
const SECRET_RARE = secretRare(
  'hasFoil > 0.5' +
    ' ? czSaturate(czContrast(czBright(r.rgb, 0.4 + pfc * 0.2), 1.0), 2.7)' +
    ' : czSaturate(czContrast(czBright(r.rgb, pfc * 0.3 + 0.2), 2.0), 0.75)'
)

// ─────────────────────────────────────────────────────────────
// cosmos-holo (Rare Holo Cosmos / 갤럭시) — 성단 텍스처 3겹을 각각
//   같은 82° 무지개와 합성해 쌓는다. 겹마다 포인터 추종 비율이 달라
//   층이 서로 다른 속도로 움직인다(시차).
//   원본: public/css/cards/cosmos-holo.css
// ─────────────────────────────────────────────────────────────
const COSMOS_HOLO = `
const float3 CM1 = float3(0.8600, 0.7993, 0.3400); // hsl(53,65%,60%)
const float3 CM2 = float3(0.4720, 0.7800, 0.2200); // hsl(93,56%,50%)
const float3 CM3 = float3(0.2254, 0.7546, 0.7193); // hsl(176,54%,49%)
const float3 CM4 = float3(0.2845, 0.3907, 0.8155); // hsl(228,59%,55%)
const float3 CM5 = float3(0.6670, 0.2800, 0.8200); // hsl(283,60%,55%)
const float3 CM6 = float3(0.7991, 0.2209, 0.5485); // hsl(326,59%,51%)

// 스톱 12개가 4% 간격 (팰린드롬: 1,2,3,4,5,6,6,5,4,3,2,1) → 주기 44%
float3 cmPick(int i) {
  int k = i - 12 * (i / 12);
  if (k == 0 || k == 11) { return CM1; }
  if (k == 1 || k == 10) { return CM2; }
  if (k == 2 || k == 9)  { return CM3; }
  if (k == 3 || k == 8)  { return CM4; }
  if (k == 4 || k == 7)  { return CM5; }
  return CM6;
}

float3 cmRamp(float t) {
  float u = mod((t - 0.04) / 0.44, 1.0) * 11.0;
  int i = int(floor(min(u, 10.999)));
  return mix(cmPick(i), cmPick(i + 1), fract(u));
}

// 82° 무지개 한 겹. size 400% 900%, 위치는 겹마다 다르다.
float3 cmBand(float2 xy, float base, float span) {
  float2 sz = float2(4.0, 9.0);
  float2 pos = float2(base + pfl * span, base + pft * span);
  float2 q = czBgXY(xy, res, sz, pos);
  return cmRamp(czLinT(q, res * sz, 82.0));
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  // clip-path: var(--clip) 과 마스크가 둘 다 걸린다
  float m = hxArtMask(uv) * (hasFoil > 0.5 ? float(maskT.eval(xy).a) : 1.0);
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001 && m > 0.001) {
    // ── shine ── radial(맨아래) → 무지개(multiply) → cosmos-bottom(color-burn)
    float4 r = czGrad3(t,
      float4(0.7800, 1.0000, 1.0000, 0.5), 0.05,
      float4(0.5098, 0.6302, 0.6302, 0.3), 0.40,
      float4(0.0000, 0.0000, 0.0000, 1.0), 1.30);
    r = czComposite(${BLEND.multiply}, r, float4(cmBand(xy, 10.0, 80.0), 1.0));
    r = czComposite(${BLEND['color-burn']}, r, float4(texA.eval(uv * texASize)));
    float3 sh = czSaturate(czContrast(czBright(r.rgb, 1.0), 1.0), 0.8);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);

    // ── :before ── cosmos-middle(lighten) + 무기개(multiply) → overlay
    float4 b = float4(cmBand(xy, 15.0, 70.0), 1.0);
    b = czComposite(${BLEND.lighten}, b, float4(texB.eval(uv * texASize)));
    float3 bf = czSaturate(czContrast(czBright(b.rgb, 1.25), 1.75), 0.8);
    col = czOver(${BLEND.overlay}, col, bf, m * opacity * b.a);

    // ── :after ── cosmos-top(multiply) + 무지개(multiply) → multiply
    float4 a = float4(cmBand(xy, 20.0, 60.0), 1.0);
    a = czComposite(${BLEND.multiply}, a, float4(texC.eval(uv * texASize)));
    float3 af = czSaturate(czContrast(czBright(a.rgb, 1.25), 1.75), 0.8);
    col = czOver(${BLEND.multiply}, col, af, m * opacity * a.a);
  }

  // glare — overlay, opacity co*(0.25 + pfc)
  float go = clamp(opacity * (0.25 + pfc), 0.0, 1.0);
  if (go > 0.001) {
    float4 g = czGrad2(t,
      float4(0.9000, 0.9600, 1.0000, 0.8), 0.05,
      float4(0.1800, 0.1700, 0.2300, 1.0), 1.50);
    float3 cg = czSaturate(czContrast(czBright(g.rgb, 0.75), 2.0), 2.0);
    col = czOver(${BLEND.overlay}, col, cg, g.a * go);

    // glare:after — soft-light, opacity 1 - pft*.75
    float4 ga = czGrad2(t,
      float4(0.9733, 0.9200, 1.0000, 1.0), 0.05,
      float4(0.1000, 0.1000, 0.1000, 1.0), 0.60);
    float3 caf = czSaturate(czContrast(czBright(ga.rgb, 0.75), 2.5), 2.0);
    float ao = clamp(1.0 - pft * 0.75, 0.0, 1.0);
    col = czOver(${BLEND['soft-light']}, col, caf, ga.a * ao * opacity * m);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// shiny-rare / shiny-v (샤이니 볼트) — shine 은 v-full-art 와 완전히 같다.
//   원본 CSS 를 diff 해보면 다른 건 clip-path 와 glare 뿐이다.
//   원본: public/css/cards/shiny-rare.css, shiny-v.css
// ─────────────────────────────────────────────────────────────
const shinyFamily = (useClip: boolean, glare: string) => `
${SUNPILLAR}
${VFA_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  ${useClip ? 'm = m * hxArtMask(uv);  // clip-path: var(--clip) / var(--clip-stage)' : ''}

  if (opacity > 0.001 && m > 0.001) {
    float4 sh4 = vfaShineBg(xy, 0);
    float3 sh = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.4 + 0.4), 1.4), 2.25)
      : czSaturate(czContrast(czBright(sh4.rgb, pfc * 0.3 + 0.35), 2.0), 1.5);

    // :before — 포인터 흰 점, overlay, opacity .75
    float4 gb = czGrad2(czRadCircleT(xy, res, pointer * res),
      float4(1.0, 1.0, 1.0, 1.0), 0.00,
      float4(0.0, 0.0, 0.0, 0.0), 0.40);
    sh = czOver(${BLEND.overlay}, sh, gb.rgb, gb.a * 0.75);

    float4 sa4 = vfaShineBg(xy, 1);
    float3 sa = hasFoil > 0.5
      ? czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.4 + 0.8), 1.5), 1.25)
      : czSaturate(czContrast(czBright(sa4.rgb, pfc * 0.4 + 0.5), 1.4), 1.2);
    // 마스크 없을 때는 :after 가 difference 로 바뀐다
    int afterBlend = hasFoil > 0.5 ? ${BLEND.exclusion} : ${BLEND.difference};
    sh = czOver(afterBlend, sh, sa, sa4.a);

    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * sh4.a);
  }
${glare}
  return col;
}
`

// shiny-rare: multiply, cover, opacity co*pfc
const SHINY_RARE = shinyFamily(
  true,
  `
  float go = clamp(opacity * pfc, 0.0, 1.0);
  if (go > 0.001) {
    float4 g = czGrad2(czRadCircleT(xy, res, pointer * res),
      float4(1.0000, 1.0000, 1.0000, 1.0), 0.00,
      float4(0.1575, 0.1425, 0.1525, 1.0), 1.50);
    float3 cg = czSaturate(czContrast(czBright(g.rgb, 1.2), 1.0), 0.7);
    col = czOver(${BLEND.multiply}, col, cg, g.a * go);
  }`
)

// shiny-v: darken, size 120% 140%, opacity co*pfc*.75
const SHINY_V = shinyFamily(
  false,
  `
  float go = clamp(opacity * pfc * 0.75, 0.0, 1.0);
  if (go > 0.001) {
    float2 sg = float2(1.2, 1.4);
    float2 qg = czBgXY(xy, res, sg, float2(50.0));
    float2 gbox = res * sg;
    float4 g = czGrad3(czRadCircleT(qg, gbox, pointer * gbox),
      float4(0.9000, 0.9000, 0.9000, 1.0), 0.05,
      float4(0.4275, 0.4575, 0.4725, 1.0), 0.80,
      float4(0.1400, 0.0600, 0.1133, 1.0), 1.50);
    float3 cg = czSaturate(czContrast(czBright(g.rgb, 0.88), 2.25), 0.7);
    col = czOver(${BLEND.darken}, col, cg, g.a * go);
  }`
)

// ─────────────────────────────────────────────────────────────
// swsh-pikachu (쇼케이스 피카츄 swsh12pt5-160) — 카드 한 장 전용 규칙.
//   rainbow-holo 와 레이어는 같고, glitter 를 포인터에 따라 ±1px 어긋나게
//   깔아 미세하게 반짝이며, 필터가 더 밝다.
//   원본: public/css/cards/swsh-pikachu.css
// ─────────────────────────────────────────────────────────────
const SWSH_PIKACHU = `
${RAINBOW_COMMON}

// glitter 를 px 단위로 미세 이동시켜 깐다 (--shift: 1px)
float4 pkGlitter(float2 xy, float sign) {
  float2 tile = res * 0.25;
  float2 q = xy - 0.5 * (res - tile)
           - (float2(1.0) - 2.0 * float2(pfl, pft)) * sign * hxPx(1.0);
  return float4(texA.eval(fract(q / tile) * texASize));
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001) {
    // ③ -30° 무지개 → ② glitter(soft-light) → ① -45° 2색(luminosity)
    float2 s3 = float2(4.0);
    float2 p3 = float2(25.0 + pointer.x * 50.0, 25.0 + pointer.y * 50.0);
    float2 q3 = czBgXY(xy, res, s3, p3);
    float4 r = float4(rcRamp(czLinT(q3, res * s3, -30.0)), 1.0);
    r = czComposite(${BLEND['soft-light']}, r, pkGlitter(xy, 1.0));
    float2 s1 = float2(2.0);
    float2 p1 = float2(25.0 + 50.0 * pfl, 25.0 + 50.0 * pft);
    float2 q1 = czBgXY(xy, res, s1, p1);
    float4 g1 = czGrad2(czLinT(q1, res * s1, -45.0),
      float4(RC1, 1.0), 0.0, float4(RC4, 1.0), 1.0);
    r = czComposite(${BLEND.luminosity}, r, g1);

    // :before — 포일(또는 illusion-mask) 을 shine 배경 위에 darken
    float4 fb = hasFoil > 0.5
      ? float4(foilT.eval(xy))
      : float4(texB.eval(fract(xy / (res * 0.33)) * texASize));
    float3 fbc = czContrast(czBright(fb.rgb, 2.5), 1.0);
    r = float4(czOver(${BLEND.darken}, r.rgb, fbc,
      clamp((pfc + 0.4) * 0.6, 0.0, 1.0)), r.a);

    // :after — glitter 를 반대쪽으로 1px 밀고 -60° 램프, color-dodge
    float2 s4 = float2(4.0);
    float2 q4 = czBgXY(xy, res, s4, pointer * 100.0);
    float4 ra = float4(rcRamp(czLinT(q4, res * s4, -60.0)), 1.0);
    ra = czComposite(${BLEND['soft-light']}, ra, pkGlitter(xy, -1.0));
    float3 sa = czSaturate(czContrast(czBright(ra.rgb, pfc * 0.3 + 0.55), 2.0), 1.0);
    r = float4(czOver(${BLEND['color-dodge']}, r.rgb, sa, ra.a), r.a);

    float3 sh = czSaturate(czContrast(czBright(r.rgb, pfc * 0.5 + 0.75), 2.0), 1.0);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — rainbow-holo 와 같다
  float go = clamp(pfc * 0.9, 0.0, 1.0) * opacity;
  if (go > 0.001) {
    float4 g = czGrad3(t,
      float4(0.8000, 0.8000, 0.8000, 1.00), 0.00,
      float4(0.8350, 0.8615, 0.8650, 0.25), 0.30,
      float4(0.2350, 0.2565, 0.2650, 1.00), 1.20);
    float3 cg = czContrast(czBright(g.rgb, 0.9), 1.75);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * go);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// radiant-holo (Radiant Rare) — 45°/-45° 회색 계단 띠를 교차시켜 금속 결을 만들고
//   그 위에 카드 타입 색(--card-glow)으로 물든 타원 광택을 얹는다.
//   원본: public/css/cards/radiant-holo.css
// ─────────────────────────────────────────────────────────────
const RADIANT_HOLO = `
${RAINBOW_COMMON}

// repeating-linear-gradient — 1.2% 폭 계단 10개, 각 칸이 평평하다.
//  밝기: 10 → 20 → 35 → 42.5 → 50 → 42.5 → 35 → 20 → 10 → 0 (%)
float rdBar(float t) {
  float u = mod(t * 100.0, 12.0) / 1.2;
  int i = int(floor(min(u, 9.999)));
  if (i == 0 || i == 8) { return 0.100; }
  if (i == 1 || i == 7) { return 0.200; }
  if (i == 2 || i == 6) { return 0.350; }
  if (i == 3 || i == 5) { return 0.425; }
  if (i == 4)           { return 0.500; }
  return 0.0;
}

const float3 RD1 = float3(0.9925, 0.7218, 0.7075); // hsl(3,95%,85%)
const float3 RD2 = float3(0.6800, 0.8560, 1.0000); // hsl(207,100%,84%)
const float3 RD3 = float3(1.0000, 0.8450, 0.7000); // hsl(29,100%,85%)
const float3 RD4 = float3(0.7200, 1.0000, 0.9067); // hsl(160,100%,86%)
const float3 RD5 = float3(0.9922, 0.7478, 0.9555); // hsl(309,94%,87%)
const float3 RD6 = float3(0.7075, 0.9545, 0.9925); // hsl(188,95%,85%)

float3 rdPick(int i) {
  int k = i - 6 * (i / 6);
  if (k == 0) { return RD1; }
  if (k == 1) { return RD2; }
  if (k == 2) { return RD3; }
  if (k == 3) { return RD4; }
  if (k == 4) { return RD5; }
  return RD6;
}

// --space 가 200px (퍼센트가 아니다) → 그라디언트 선 위 200px 간격, 주기 1200px
float3 rdPastel(float len, float t) {
  float px = t * len;
  float u = mod((px - hxPx(200.0)) / hxPx(1200.0), 1.0) * 6.0;
  int i = int(floor(min(u, 5.999)));
  return mix(rdPick(i), rdPick(i + 1), fract(u));
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  // 포인터의 절반만 따라가는 타원 중심 (px*0.5 + 25%)
  float2 halfPt = float2(pointer.x * 0.5 + 0.25, pointer.y * 0.5 + 0.25);
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001) {
    // ── shine (clip-borders) ──
    float mb = hxBorders(uv) * hxMask(xy, uv);  // clip-borders + 카드 마스크
    if (mb > 0.001) {
      // ③ 맨 아래: -45° 계단 띠 (color-dodge 로 아래에 얹히지만 최하단이라 그대로)
      float2 sz = float2(2.1);
      float2 bp = (bgp - 50.0) * 1.5 + 50.0;
      float2 q = czBgXY(xy, res, sz, bp);
      float2 box = res * sz;
      float4 r = float4(float3(rdBar(czLinT(q, box, -45.0))), 1.0);
      // ② 45° 계단 띠 → darken
      r = czComposite(${BLEND.darken}, r, float4(float3(rdBar(czLinT(q, box, 45.0))), 1.0));
      // ① 타원 광택 (카드 타입 색) → exclusion
      float4 g1 = czGrad2(czRadEllipseT(xy, res, halfPt * res),
        float4(0.95, 0.95, 0.95, 1.0), 0.20,
        float4(glow, 1.0), 1.30);
      r = czComposite(${BLEND.exclusion}, r, g1);
      float3 sh = czSaturate(czContrast(czBright(r.rgb, 0.5), 2.0), 1.75);
      col = czOver(${BLEND['color-dodge']}, col, sh, mb * opacity * r.a);
    }

    // ── :after (clip = 그림창) — 포일 + 55° 파스텔 띠 ──
    float ma = hxArtMask(uv) * hxMask(xy, uv);  // clip + 카드 마스크
    if (ma > 0.001) {
      float2 sz2 = float2(4.0, 1.0);
      float2 bp2 = (bgp - 50.0) * -2.5 + 50.0;
      float2 q2 = czBgXY(xy, res, sz2, bp2);
      float2 box2 = res * sz2;
      float3 pastel = rdPastel(czLinLen(box2, 55.0), czLinT(q2, box2, 55.0));
      float4 a = float4(pastel, 1.0);
      // 포일 (cover) 또는 trainerbg 25% 타일. 마스크 있으면 hard-light, 없으면 difference
      float4 fb = hasFoil > 0.5
        ? float4(foilT.eval(xy))
        : float4(texB.eval(fract(xy / (res * 0.25)) * texASize));
      int fbBlend = hasFoil > 0.5 ? ${BLEND['hard-light']} : ${BLEND.difference};
      a = czComposite(fbBlend, a, fb);
      float3 af = czSaturate(czContrast(czBright(a.rgb, 0.6), 3.0), 2.0);
      col = czOver(${BLEND['color-dodge']}, col, af, ma * opacity * a.a);
    }

    // ── :before — glitter(15%) + 타원 radial, overlay ──
    float2 tile = res * 0.15;
    float2 gq = xy - 0.5 * (res - tile);
    float4 gl = float4(texA.eval(fract(gq / tile) * texASize));
    float2 sz3 = float2(3.5);
    float2 q3 = czBgXY(xy, res, sz3, float2(50.0));
    float2 box3 = res * sz3;
    float4 b = czGrad3(czRadEllipseT(q3, box3, halfPt * box3),
      float4(0.5800, 0.5800, 0.5800, 0.8), 0.10,
      float4(0.2000, 0.2000, 0.2000, 0.9), 0.20,
      float4(0.2000, 0.2000, 0.2000, 0.5), 0.50);
    b = czComposite(${BLEND['color-dodge']}, b, gl);
    float3 bf = czSaturate(czContrast(czBright(b.rgb, 0.66), 2.0), 0.5);
    col = czOver(${BLEND.overlay}, col, bf, b.a * opacity);
  }

  // glare — hard-light
  if (opacity > 0.001) {
    float4 g = czGrad2(t,
      float4(1.0000, 1.0000, 1.0000, 0.33), 0.00,
      float4(0.2500, 0.2500, 0.2500, 1.00), 1.10);
    float3 cg = czContrast(czBright(g.rgb, 1.0), 1.5);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * opacity);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// shiny-vmax (Rare Shiny VMAX) — amazing-rare 골격에 -30° 무지개 한 겹을 더한 것.
//   반짝이 색이 무채색(248/206 계열)이라 어메이징보다 차갑다.
//   :after 는 sunpillar 를 hue 로 얹는다 (amazing 은 saturation).
//   원본: public/css/cards/shiny-vmax.css
// ─────────────────────────────────────────────────────────────
const SHINY_VMAX = `
${SUNPILLAR}
${RAINBOW_COMMON}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = hxMask(xy, uv);
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001) {
    // ── shine ── ④ 포인터 radial → ③ -30° 무지개(color-burn)
    //             → ② glitter 55%(overlay) → ① glitter 40/45%(soft-light)
    float4 r = czGrad3(t,
      float4(0.0963, 0.0950, 0.1050, 1.00), 0.10,
      float4(0.7900, 0.8013, 0.8100, 0.10), 0.50,
      float4(0.9500, 0.9500, 0.9500, 0.98), 0.90);
    float2 sz = float2(4.0);
    float2 q = czBgXY(xy, res, sz, bgp * 1.5);
    r = czComposite(${BLEND['color-burn']}, r, float4(rcRamp(czLinT(q, res * sz, -30.0)), 1.0));
    r = czComposite(${BLEND.overlay}, r, rcGlitter(xy, float2(55.0, 55.0)));
    r = czComposite(${BLEND['soft-light']}, r, rcGlitter(xy, float2(40.0, 45.0)));
    // :before — 포일 + radial 을 color-burn 한 뒤 shine 배경 위에 lighten (opacity .35)
    float4 pb = czGrad3(t,
      float4(0.9067, 0.9055, 0.9145, 0.95), 0.10,
      float4(0.6640, 0.6821, 0.6960, 0.50), 0.50,
      float4(0.0000, 0.0000, 0.0000, 1.00), 1.20);
    if (hasFoil > 0.5) {
      pb = czComposite(${BLEND['color-burn']}, pb, float4(foilT.eval(xy)));
    }
    float3 pbf = czSaturate(czContrast(czBright(pb.rgb, 1.0), 1.0), 0.4);
    r = float4(czOver(${BLEND.lighten}, r.rgb, pbf, pb.a * 0.35), r.a);

    // :after — sunpillar 를 hue 로. shine 의 색상만 바꾼다.
    float2 s4 = float2(4.0, 8.0);
    float2 p4 = float2(50.0 + (50.0 - bgp.x) * 3.0, 50.0 + (50.0 - bgp.y) * 3.0);
    float2 q4 = czBgXY(xy, res, s4, p4);
    float3 sp = spRamp(czLinT(q4, res * s4, -30.0), 5);
    float3 spf = czBright(sp, clamp(0.75 - pfc * 0.5, 0.0, 1.0));
    r = float4(czBlend(${BLEND.hue}, r.rgb, spf), r.a);

    float3 sh = czSaturate(czContrast(czBright(r.rgb, 1.0), 1.0), 0.85);
    col = czOver(${BLEND['color-dodge']}, col, sh, m * opacity * r.a);
  }

  // glare — 부모 + :after(마스크 적용, overlay)
  if (opacity > 0.001) {
    float4 gb = czGrad3(t,
      float4(0.8963, 0.8950, 0.9050, 0.45), 0.00,
      float4(0.2850, 0.3020, 0.3150, 0.45), 0.45,
      float4(0.0000, 0.0000, 0.0000, 0.33), 1.20);
    float3 cb = czContrast(czBright(gb.rgb, 1.0), 1.25);
    float4 ga = czGrad3(t,
      float4(0.8963, 0.8950, 0.9050, 0.75), 0.00,
      float4(0.2850, 0.3020, 0.3150, 0.65), 0.45,
      float4(0.0000, 0.0000, 0.0000, 0.75), 1.00);
    float3 ca = czContrast(czBright(ga.rgb, 1.0), 1.25);
    float as = ga.a * m;
    float ao = as + gb.a * (1.0 - as);
    float3 co = as * (1.0 - gb.a) * ca
              + as * gb.a * czBlend(${BLEND.overlay}, cb, ca)
              + (1.0 - as) * gb.a * cb;
    float3 cg = ao > 0.0 ? co / ao : float3(0.0);
    col = czOver(${BLEND.overlay}, col, cg, ao * opacity);
  }
  return col;
}
`

// ─────────────────────────────────────────────────────────────
// trainer-gallery-secret-rare (갤러리 골드) — secret-rare 에서 conic 을 빼고
//   금색 45° 그라디언트를 맨 아래에 깔고 radial 을 color 로 얹는다.
//   shine / :before / :after 전부 mask-image: none 이라 마스크를 안 탄다.
//   원본: public/css/cards/trainer-gallery-secret-rare.css
// ─────────────────────────────────────────────────────────────
const TG_SECRET_RARE = `
${SUNPILLAR}
${RAINBOW_COMMON}

const float3 SR_Y1 = float3(0.9750, 0.7533, 0.0250); // hsl(46,95%,50%)
const float3 SR_Y2 = float3(1.0000, 0.9173, 0.3800); // hsl(52,100%,69%)

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float t = czRadCircleT(xy, res, pointer * res);

  if (opacity > 0.001) {
    // ── shine (마스크 없음) ──
    // ④ 맨 아래: 금색 45° 그라디언트
    float3 gold = mix(SR_Y1, SR_Y2, clamp(czLinT(xy, res, 45.0), 0.0, 1.0));
    float4 r = float4(gold, 1.0);
    // ③ 포인터 radial → color (색상만 가져간다)
    float4 g3 = czGrad3(t,
      float4(0.0784, 0.1216, 0.1019, 1.00), 0.10,
      float4(0.7560, 0.8440, 0.8396, 0.10), 0.50,
      float4(0.9500, 0.9500, 0.9500, 0.98), 0.90);
    r = czComposite(${BLEND.color}, r, g3);
    // ② glitter 55% → darken
    r = czComposite(${BLEND.darken}, r, rcGlitter(xy, float2(55.0, 55.0)));
    // ① glitter 40/45% → soft-light
    r = czComposite(${BLEND['soft-light']}, r, rcGlitter(xy, float2(40.0, 45.0)));
    // :before / :after 는 secret-rare 를 물려받고, shine 배경 위에 합성한다
    float4 pb = czGrad2(t,
      float4(0.9200, 0.8867, 0.8800, 0.95), 0.10,
      float4(0.0000, 0.0000, 0.0000, 1.00), 0.70);
    pb = czComposite(${BLEND.multiply}, pb, float4(gold, 1.0));
    float4 fb = hasFoil > 0.5
      ? float4(foilT.eval(xy))
      : float4(texB.eval(fract(xy / (res * 0.33)) * texASize));
    pb = czComposite(${BLEND['hard-light']}, pb, fb);
    float3 pbf = czSaturate(czContrast(czBright(pb.rgb, 1.25), 1.25), 0.35);
    r = float4(czOver(${BLEND.lighten}, r.rgb, pbf, pb.a * 0.8), r.a);

    float2 tile = res * 0.25;
    float2 q = xy - 0.5 * (res - tile)
             - (float2(1.0) - 2.0 * float2(pfl, pft)) * hxPx(1.0);
    float4 ga = float4(texA.eval(fract(q / tile) * texASize));
    float3 gaf = czContrast(czBright(ga.rgb, pfc * 0.6 + 0.6), 1.5);
    r = float4(czOver(${BLEND.overlay}, r.rgb, gaf, ga.a), r.a);

    float3 sh = hasFoil > 0.5
      ? r.rgb
      : czSaturate(czContrast(czBright(r.rgb, pfc * 0.3 + 0.2), 2.0), 0.75);
    col = czOver(${BLEND['color-dodge']}, col, sh, opacity * r.a);
  }

  // glare — secret-rare 와 같고, 마스크 없는 카드는 brightness(.5) contrast(1)
  if (opacity > 0.001) {
    float4 g = czGrad2(t,
      float4(0.8160, 0.8080, 0.7840, 0.3), 0.00,
      float4(0.1380, 0.1152, 0.1020, 1.0), 1.80);
    float3 cg = hasFoil > 0.5
      ? czContrast(czBright(g.rgb, 1.3), 1.5)
      : czContrast(czBright(g.rgb, 0.5), 1.0);
    col = czOver(${BLEND['hard-light']}, col, cg, g.a * opacity);
  }
  return col;
}
`

/** 효과별로 필요한 텍스처 URL. texA / texB / texC 순서로 바인딩된다. */
const IMG = 'https://poke-holo.simey.me/img'
export const EFFECT_TEXTURES: Partial<Record<EffectKey, string[]>> = {
  'v-full-art': [`${IMG}/illusion.png`],
  'trainer-full-art': [`${IMG}/trainerbg.png`],
  'tg-v': [`${IMG}/illusion.png`],
  'v-regular': [`${IMG}/grain.webp`],
  'rainbow-holo': [`${IMG}/glitter.png`, `${IMG}/illusion-mask.png`],
  'rainbow-alt': [`${IMG}/glitter.png`],
  'tg-vmax': [`${IMG}/glitter.png`],
  'amazing-rare': [`${IMG}/glitter.png`],
  'secret-rare': [`${IMG}/glitter.png`, `${IMG}/geometric.png`],
  // 세 장 모두 734x1024 로 같아서 texASize 하나로 매핑한다
  'shiny-rare': [`${IMG}/illusion.png`],
  'radiant-holo': [`${IMG}/glitter.png`, `${IMG}/trainerbg.png`],
  'shiny-vmax': [`${IMG}/glitter.png`],
  'trainer-gallery-secret-rare': [`${IMG}/glitter.png`, `${IMG}/geometric.png`],
  'swsh-pikachu': [`${IMG}/glitter.png`, `${IMG}/illusion-mask.png`],
  'shiny-v': [`${IMG}/illusion.png`],
  'cosmos-holo': [
    `${IMG}/cosmos-bottom.png`,
    `${IMG}/cosmos-middle-trans.png`,
    `${IMG}/cosmos-top-trans.png`,
  ],
  'v-max': [`${IMG}/vmaxbg.jpg`],
  'v-star': [`${IMG}/ancient.png`],
}

const BODIES: Partial<Record<EffectKey, string>> = {
  basic: BASIC,
  'regular-holo': REGULAR_HOLO,
  'reverse-holo': REVERSE_HOLO,
  'v-full-art': V_FULL_ART,
  'trainer-full-art': TRAINER_FULL_ART,
  'tg-v': TG_V,
  'trainer-gallery-holo': TRAINER_GALLERY_HOLO,
  'v-regular': V_REGULAR,
  'v-max': V_MAX,
  'v-star': V_STAR,
  'rainbow-holo': RAINBOW_HOLO,
  'rainbow-alt': RAINBOW_ALT,
  'tg-vmax': TG_VMAX,
  'amazing-rare': AMAZING_RARE,
  'secret-rare': SECRET_RARE,
  'cosmos-holo': COSMOS_HOLO,
  'shiny-rare': SHINY_RARE,
  'shiny-v': SHINY_V,
  'swsh-pikachu': SWSH_PIKACHU,
  'radiant-holo': RADIANT_HOLO,
  'shiny-vmax': SHINY_VMAX,
  'trainer-gallery-secret-rare': TG_SECRET_RARE,
}

/** 아직 옮기지 않은 효과. basic 으로 대체하고 화면에 표시한다. */
export const isPorted = (k: EffectKey) => k in BODIES

export function buildShader(k: EffectKey) {
  const body = BODIES[k] ?? BASIC
  return SHELL_HEAD + SKSL_PRELUDE + CLIP_HELPERS + body + SHELL_TAIL
}
