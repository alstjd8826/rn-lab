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

// clip-borders: inset(2.8% 4% round ...) — 얇은 테두리를 뺀 영역
float tghBorders(float2 uv) {
  float x = uv.x * 100.0;
  float y = uv.y * 100.0;
  float e = 0.3;
  float mx = smoothstep(4.0 - e, 4.0 + e, x) * (1.0 - smoothstep(96.0 - e, 96.0 + e, x));
  float my = smoothstep(2.8 - e, 2.8 + e, y) * (1.0 - smoothstep(97.2 - e, 97.2 + e, y));
  return mx * my;
}

float3 hxEffect(float3 col, float2 xy, float2 uv) {
  float m = tghBorders(uv);
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

/** 효과별로 필요한 텍스처 URL. texA / texB / texC 순서로 바인딩된다. */
const IMG = 'https://poke-holo.simey.me/img'
export const EFFECT_TEXTURES: Partial<Record<EffectKey, string[]>> = {
  'v-full-art': [`${IMG}/illusion.png`],
  'trainer-full-art': [`${IMG}/trainerbg.png`],
  'tg-v': [`${IMG}/illusion.png`],
}

const BODIES: Partial<Record<EffectKey, string>> = {
  basic: BASIC,
  'regular-holo': REGULAR_HOLO,
  'reverse-holo': REVERSE_HOLO,
  'v-full-art': V_FULL_ART,
  'trainer-full-art': TRAINER_FULL_ART,
  'tg-v': TG_V,
  'trainer-gallery-holo': TRAINER_GALLERY_HOLO,
}

/** 아직 옮기지 않은 효과. basic 으로 대체하고 화면에 표시한다. */
export const isPorted = (k: EffectKey) => k in BODIES

export function buildShader(k: EffectKey) {
  const body = BODIES[k] ?? BASIC
  return SHELL_HEAD + SKSL_PRELUDE + CLIP_HELPERS + body + SHELL_TAIL
}
