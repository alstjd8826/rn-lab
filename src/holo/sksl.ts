// CSS 블렌드 모드와 필터를 SkSL 로 옮긴 공용 프렐류드.
//
//  근거 문서
//   · 블렌드 공식      W3C Compositing and Blending Level 1  §blending
//   · 필터 공식        W3C Filter Effects Level 1            §funcdef-filter-*
//
//  포켓몬 홀로 카드 CSS 가 실제로 쓰는 것만 담았다 (조사 결과):
//   · 블렌드 15종 — hard-light, soft-light, overlay, color-dodge, hue, exclusion,
//                   multiply, luminosity, difference, color-burn, lighten, darken,
//                   screen, saturation, color
//   · 필터 3종   — brightness, contrast, saturate
//
//  이름은 전부 cz 접두어를 붙였다. 효과별 셰이더에서 지역 변수와 부딪히지 않게.

/** 블렌드 모드 번호. CSS Compositing 스펙의 나열 순서를 그대로 따른다. */
export const BLEND = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'color-dodge': 6,
  'color-burn': 7,
  'hard-light': 8,
  'soft-light': 9,
  difference: 10,
  exclusion: 11,
  hue: 12,
  saturation: 13,
  color: 14,
  luminosity: 15,
} as const

export type BlendName = keyof typeof BLEND

export const BLEND_NAMES = Object.keys(BLEND) as BlendName[]

export const SKSL_PRELUDE = `
// ================= 휘도·채도 (비분리형 블렌드용) =================
//  CSS 스펙의 Lum() 은 0.3/0.59/0.11 을 쓴다. 필터의 saturate 계수와 다르다.
float czLum(float3 c) { return dot(c, float3(0.3, 0.59, 0.11)); }

float3 czClip(float3 c) {
  float l = czLum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / max(l - n, 1e-6); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6); }
  return c;
}

float3 czSetLum(float3 c, float l) { return czClip(c + (l - czLum(c))); }

float czSat(float3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

// 스펙의 SetSat 은 최소→0, 최대→s, 중간은 비례. 한 줄로 떨어진다.
float3 czSetSat(float3 c, float s) {
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  return x > n ? (c - n) * s / (x - n) : float3(0.0);
}

// ================= 분리형 블렌드 (채널 하나씩) =================
float czMul(float b, float s) { return b * s; }
float czScr(float b, float s) { return b + s - b * s; }

float czHard(float b, float s) {
  return s <= 0.5 ? czMul(b, 2.0 * s) : czScr(b, 2.0 * s - 1.0);
}

// 스펙: Cb==0 이면 0, Cs==1 이면 1, 그 외 min(1, Cb/(1-Cs))
float czDodge(float b, float s) {
  if (b <= 0.0) { return 0.0; }
  if (s >= 1.0) { return 1.0; }
  return min(1.0, b / (1.0 - s));
}

// 스펙: Cb==1 이면 1, Cs==0 이면 0, 그 외 1-min(1, (1-Cb)/Cs)
float czBurn(float b, float s) {
  if (b >= 1.0) { return 1.0; }
  if (s <= 0.0) { return 0.0; }
  return 1.0 - min(1.0, (1.0 - b) / s);
}

float czSoft(float b, float s) {
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5
    ? b - (1.0 - 2.0 * s) * b * (1.0 - b)
    : b + (2.0 * s - 1.0) * (d - b);
}

float3 czV(float f0, float f1, float f2) { return float3(f0, f1, f2); }

// ================= 통합 진입점 =================
//  m = BLEND 상수. b = 아래(backdrop), s = 위(source). 둘 다 알파 없는 0..1 색.
float3 czBlend(int m, float3 b, float3 s) {
  if (m == 1)  { return b * s; }
  if (m == 2)  { return czV(czScr(b.r, s.r), czScr(b.g, s.g), czScr(b.b, s.b)); }
  if (m == 3)  { return czV(czHard(s.r, b.r), czHard(s.g, b.g), czHard(s.b, b.b)); }
  if (m == 4)  { return min(b, s); }
  if (m == 5)  { return max(b, s); }
  if (m == 6)  { return czV(czDodge(b.r, s.r), czDodge(b.g, s.g), czDodge(b.b, s.b)); }
  if (m == 7)  { return czV(czBurn(b.r, s.r), czBurn(b.g, s.g), czBurn(b.b, s.b)); }
  if (m == 8)  { return czV(czHard(b.r, s.r), czHard(b.g, s.g), czHard(b.b, s.b)); }
  if (m == 9)  { return czV(czSoft(b.r, s.r), czSoft(b.g, s.g), czSoft(b.b, s.b)); }
  if (m == 10) { return abs(b - s); }
  if (m == 11) { return b + s - 2.0 * b * s; }
  if (m == 12) { return czSetLum(czSetSat(s, czSat(b)), czLum(b)); }
  if (m == 13) { return czSetLum(czSetSat(b, czSat(s)), czLum(b)); }
  if (m == 14) { return czSetLum(s, czLum(b)); }
  if (m == 15) { return czSetLum(b, czLum(s)); }
  return s;
}

// 알파를 가진 source 를 backdrop 위에 얹는다 (backdrop 은 불투명).
float3 czOver(int m, float3 b, float3 s, float a) {
  return mix(b, czBlend(m, b, s), a);
}

// 둘 다 알파를 가질 때의 정식 합성 (CSS Compositing §general-formula).
//  background-image 레이어를 쌓을 때 이걸 써야 한다.
//  배경이 반투명하면 위 레이어가 그만큼 "그대로 통과"한다 —
//  배경을 불투명 검정으로 취급하면 전부 어두워진다.
float4 czComposite(int m, float4 b, float4 s) {
  float ao = s.a + b.a * (1.0 - s.a);
  float3 co = s.a * (1.0 - b.a) * s.rgb
            + s.a * b.a * czBlend(m, b.rgb, s.rgb)
            + (1.0 - s.a) * b.a * b.rgb;
  return float4(ao > 0.0 ? co / ao : float3(0.0), ao);
}

// ================= 필터 =================
//  스펙상 필터 함수는 각 단계마다 0..1 로 클램프된다. 체인 끝에서 한 번이 아니다.
float3 czBright(float3 c, float k) { return clamp(c * k, 0.0, 1.0); }
float3 czContrast(float3 c, float k) { return clamp((c - 0.5) * k + 0.5, 0.0, 1.0); }

// saturate 는 feColorMatrix 계수 0.213/0.715/0.072 를 쓴다.
// 행렬을 펼치면 정확히 mix(휘도, 원색, k) 와 같아진다.
float3 czSaturate(float3 c, float k) {
  float l = dot(c, float3(0.213, 0.715, 0.072));
  return clamp(mix(float3(l), c, k), 0.0, 1.0);
}

// ================= background-size / position =================
//  CSS 는 요소보다 큰 타일을 만들어 % 로 밀어 넣는다.
//  sizeMul = background-size 배수 (400% → 4), posPct = background-position %.
//  돌려주는 값은 "타일 안에서의 좌표".
float2 czBgXY(float2 xy, float2 res, float2 sizeMul, float2 posPct) {
  float2 tile = res * sizeMul;
  return xy - posPct / 100.0 * (res - tile);
}

// ================= 그라디언트 좌표 =================
//  전부 0..1 로 정규화된 위치 t 를 돌려준다. 스톱 보간은 효과별로 한다.

// linear-gradient(<deg>) — CSS 각도는 "위쪽 0도, 시계방향".
//  그라디언트 선은 박스 중심을 지나고 길이는 |W·sinθ| + |H·cosθ|.
float czLinLen(float2 box, float deg) {
  float a = radians(deg);
  return abs(box.x * sin(a)) + abs(box.y * cos(a));
}

float czLinT(float2 q, float2 box, float deg) {
  float a = radians(deg);
  float2 dir = float2(sin(a), -cos(a));
  float L = czLinLen(box, deg);
  return (dot(q - box * 0.5, dir) + L * 0.5) / L;
}

// radial-gradient(farthest-corner circle at <at>) — at 은 px.
float czRadCircleT(float2 q, float2 box, float2 at) {
  float2 d = max(at, box - at);
  return length(q - at) / max(length(d), 1e-6);
}

// radial-gradient(circle at <at>) 처럼 반지름을 직접 줄 때.
float czRadT(float2 q, float2 at, float r) {
  return length(q - at) / max(r, 1e-6);
}

// radial-gradient(farthest-corner ellipse at <at>) — 축별 반지름.
float czRadEllipseT(float2 q, float2 box, float2 at) {
  float2 r = max(max(at, box - at), float2(1e-6));
  return length((q - at) / r);
}

// conic-gradient(from <fromDeg> at <at>) — 위쪽에서 시작해 시계방향.
float czConT(float2 q, float2 at, float fromDeg) {
  float2 v = q - at;
  float a = atan(v.x, -v.y) - radians(fromDeg);
  return fract(a / 6.28318531 + 1.0);
}

// ================= 스톱 보간 =================
//  CSS 는 알파를 곱한 상태로 보간한다. 결과는 알파를 되돌려 돌려준다.
float4 czPm(float4 c) { return float4(c.rgb * c.a, c.a); }
float4 czUnpm(float4 p) { return float4(p.a > 0.0 ? p.rgb / p.a : float3(0.0), p.a); }

float4 czGrad2(float t, float4 c0, float p0, float4 c1, float p1) {
  float4 a = czPm(c0);
  float4 b = czPm(c1);
  if (t <= p0) { return czUnpm(a); }
  if (t >= p1) { return czUnpm(b); }
  return czUnpm(mix(a, b, (t - p0) / (p1 - p0)));
}

float4 czGrad3(float t, float4 c0, float p0, float4 c1, float p1, float4 c2, float p2) {
  if (t < p1) { return czGrad2(t, c0, p0, c1, p1); }
  return czGrad2(t, c1, p1, c2, p2);
}

float4 czGrad4(float t, float4 c0, float p0, float4 c1, float p1,
               float4 c2, float p2, float4 c3, float p3) {
  if (t < p2) { return czGrad3(t, c0, p0, c1, p1, c2, p2); }
  return czGrad2(t, c2, p2, c3, p3);
}

// 반복 그라디언트용. 스톱 구간 [first, last] 를 주기로 감는다.
float czRepeatT(float t, float first, float last) {
  float period = last - first;
  return first + mod(t - first, period);
}
`
