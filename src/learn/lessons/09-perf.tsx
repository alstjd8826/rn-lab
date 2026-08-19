import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { installJsiLab, type JsiLab } from 'react-native-jsi-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Window = { ms: number; uiFps: number; jsFps: number }

// 두 스레드의 프레임을 각각 세고, JS 를 막았을 때 어떻게 갈라지는지 본다.
function TwoFpsDemo() {
  // UI 스레드에서 증가 — 워클릿
  const uiFrames = useSharedValue(0)
  // JS 스레드에서 증가 — requestAnimationFrame
  const jsFrames = useRef(0)

  const [live, setLive] = useState<{ ui: number; js: number } | null>(null)
  const [blocked, setBlocked] = useState<Window | null>(null)
  const [lab, setLab] = useState<JsiLab | null>(null)

  useFrameCallback(() => {
    'worklet'
    uiFrames.value += 1
  })

  // UI 스레드에서만 도는 애니메이션 (JS 가 막혀도 계속 움직인다)
  const spin = useSharedValue(0)
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [spin])
  const uiBox = useAnimatedStyle(() => ({
    transform: [{ translateX: spin.value * 120 }],
  }))

  // JS 스레드가 매 프레임 setState 로 움직이는 상자
  const [jsX, setJsX] = useState(0)
  useEffect(() => {
    let raf = 0
    let dir = 1
    let x = 0
    const tick = () => {
      jsFrames.current += 1
      x += dir * 3
      if (x > 120 || x < 0) dir = -dir
      setJsX(x)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 1초마다 두 카운터를 표본으로 찍는다
  useEffect(() => {
    let lastUi = uiFrames.value
    let lastJs = jsFrames.current
    const id = setInterval(() => {
      const ui = uiFrames.value
      const js = jsFrames.current
      setLive({ ui: ui - lastUi, js: js - lastJs })
      lastUi = ui
      lastJs = js
    }, 1000)
    return () => clearInterval(id)
  }, [uiFrames])

  const block = useCallback(() => {
    let l = lab
    if (!l) {
      try {
        l = installJsiLab()
        setLab(l)
      } catch {
        return
      }
    }
    // 막기 직전 두 카운터를 찍는다
    const t0 = performance.now()
    const u0 = uiFrames.value
    const j0 = jsFrames.current

    l.blockJsThread(2000) // ← JS 스레드 정지

    const ms = performance.now() - t0
    const sec = ms / 1000
    setBlocked({
      ms,
      uiFps: (uiFrames.value - u0) / sec,
      jsFps: (jsFrames.current - j0) / sec,
    })
  }, [lab, uiFrames])

  return (
    <View style={d.wrap}>
      <View style={d.track}>
        <Text style={d.trackLabel}>UI 스레드가 움직이는 상자</Text>
        <Animated.View style={[d.box, d.uiBox, uiBox]} />
      </View>
      <View style={d.track}>
        <Text style={d.trackLabel}>JS 스레드가 움직이는 상자</Text>
        <View style={[d.box, d.jsBox, { transform: [{ translateX: jsX }] }]} />
      </View>

      <View style={d.liveRow}>
        <View style={d.live}>
          <Text style={d.liveLabel}>UI FPS</Text>
          <Text style={[d.liveVal, { color: C.native }]}>{live?.ui ?? '—'}</Text>
        </View>
        <View style={d.live}>
          <Text style={d.liveLabel}>JS FPS</Text>
          <Text style={[d.liveVal, { color: C.js }]}>{live?.js ?? '—'}</Text>
        </View>
      </View>

      <Button title="JS 스레드 2초 막기" color={C.warn} onPress={block} />
      <Text style={d.hint}>
        누르면 아래 상자만 멈춥니다. 위 상자는 계속 움직입니다.
      </Text>

      {blocked ? (
        <View style={d.result}>
          <Text style={d.resultTitle}>
            막힌 {(blocked.ms / 1000).toFixed(1)}초 동안
          </Text>
          <View style={d.kv}>
            <Text style={d.k}>UI 스레드 프레임</Text>
            <Text style={[d.v, { color: C.native }]}>
              {blocked.uiFps.toFixed(0)} fps
            </Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>JS 스레드 프레임</Text>
            <Text style={[d.v, { color: C.js }]}>
              {blocked.jsFps.toFixed(0)} fps
            </Text>
          </View>
          <Text style={d.note}>
            같은 시간 창인데 숫자가 완전히 다릅니다. “앱이 느리다” 를 하나의 FPS 로
            말할 수 없는 이유입니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson09: Lesson = {
  no: '⑨',
  slug: 'perf',
  title: '성능 계측',
  summary: 'JS FPS 와 UI FPS 는 다른 숫자다',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: '"앱이 느려요" 를 어떻게 숫자로 바꾸나',
      blocks: [
        {
          kind: 'prose',
          text:
            '⑧에서 이미 한 번 겪었습니다. 개발 빌드로 재니 TurboModule 이 1위였는데, ' +
            '릴리즈로 재니 Nitro 가 1위였습니다. **재는 방법이 틀리면 결론이 뒤집힙니다.**\n\n' +
            '그럼 대체 뭘 어떻게 재야 하는가 — 이 편의 주제입니다.',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '먼저 알아야 할 것',
          text:
            'RN 앱에는 **FPS 가 두 개**입니다. 하나로 뭉뚱그린 숫자는 원인을 못 가리킵니다.',
        },
        {
          kind: 'compare',
          leftLabel: '막히면 생기는 일',
          rightLabel: '원인',
          rows: [
            {
              label: 'UI FPS',
              left: '화면이 뚝뚝 끊긴다',
              right: '깊은 뷰 계층 · 무거운 그림자 · 이미지 디코딩',
            },
            {
              label: 'JS FPS',
              left: '화면은 멀쩡한데 반응이 없다',
              right: '무거운 연산 · 과도한 리렌더 · 큰 리스트',
            },
          ],
        },
        {
          kind: 'prose',
          text:
            '두 번째가 진단하기 고약합니다. 화면은 60fps 로 부드럽게 흐르는데 버튼을 눌러도 ' +
            '아무 일이 안 일어납니다. 유저는 "앱이 멈췄다" 고 하는데 화면 녹화를 보면 멀쩡해 보이고요.',
        },
      ],
    },

    {
      heading: '2. 직접 갈라놓고 봅니다',
      question: '두 숫자가 정말 다른가',
      blocks: [
        {
          kind: 'prose',
          text:
            '상자 두 개를 서로 다른 스레드가 움직입니다.\n\n' +
            '· 위 상자 — **Reanimated 워클릿**이 UI 스레드에서 직접\n' +
            '· 아래 상자 — **JS 가 매 프레임 setState** 로\n\n' +
            '그리고 ①에서 만든 `blockJsThread` 로 JS 스레드를 2초 막습니다.',
        },
        {
          kind: 'demo',
          title: '두 스레드, 두 FPS',
          render: () => <TwoFpsDemo />,
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '실측값입니다 — 평소엔 둘 다 60fps 인데, 막은 2초 동안은 ' +
            '**UI 60 / JS 0** 이 나옵니다. 같은 시간 창인데 숫자가 완전히 다릅니다.\n\n' +
            '여기서 실무 규칙 하나가 나옵니다 — **애니메이션을 UI 스레드로 내려보내면 ' +
            'JS 가 바빠도 안 끊깁니다.** Reanimated 워클릿이나 `useNativeDriver: true` 가 그것입니다.',
        },
      ],
    },

    {
      heading: '3. 봐야 할 지표',
      question: '도구보다 지표가 먼저',
      blocks: [
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: 'TTI — 켜고 나서 조작 가능해지기까지',
              side: 'js',
              text:
                '유저가 체감하는 "느림" 의 대부분입니다. **콜드 스타트**(프로세스가 아예 없는 상태) 를 ' +
                '기준으로 봐야 합니다. ⑥의 Hermes 가 공략한 게 정확히 이 구간입니다.',
            },
            {
              title: 'Frozen frame — 700ms 이상 멈춘 프레임',
              side: 'none',
              text:
                '평균 FPS 보다 훨씬 유용합니다. 평균 58fps 인데 화면 전환마다 1초씩 얼어붙는 앱이 ' +
                '있을 수 있는데, 평균은 그걸 못 잡아냅니다.',
            },
            {
              title: 'p95 · p99 — 평균은 문제를 가린다',
              side: 'none',
              text:
                '평균은 성능 좋은 기기가 나쁜 기기를 가려줍니다. ' +
                '봐야 하는 건 꼬리 쪽이고, 거기 있는 사람들이 실제로 앱을 떠나는 사람들입니다.',
              code:
                '평균 1.2초   ← "괜찮은데요?"\n' +
                'p50  0.9초\n' +
                'p95  4.1초   ← 20명 중 1명\n' +
                'p99 11.3초   ← 대부분 이탈',
              highlight: [2, 3],
            },
            {
              title: '메모리 · ANR',
              side: 'none',
              text:
                '저가 기기에서 메모리 압박은 곧 **OS 의 강제 종료**입니다. 크래시 리포트에 ' +
                '안 잡히는 경우가 많아 놓치기 쉽습니다. Android 의 ANR 은 메인 스레드가 ' +
                '5초 이상 막힌 것이고 스토어 노출에도 영향을 줍니다.',
            },
          ],
        },
      ],
    },

    {
      heading: '4. 흔한 착각',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: '① 개발 빌드에서 잰다',
          text:
            '제일 흔하고 제일 치명적입니다. 개발 모드는 번들이 최적화 안 됐고, ' +
            '`__DEV__` 검증 코드가 다 돌고, LogBox·개발자 메뉴가 붙어 있습니다.\n\n' +
            '**⑧에서 실제로 순위가 뒤집혔습니다.** 참고값도 못 됩니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '② 내 폰에서 잰다',
          text:
            '최신 아이폰에서 안 느린 건 당연합니다. **가장 낮은 사양의 지원 기기**에서 ' +
            '재야 의미가 있습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '③ 짐작으로 최적화한다',
          text:
            '"여기가 느릴 것 같아서 `useMemo` 발랐습니다" — 재보지 않았으면 그건 ' +
            '최적화가 아니라 코드 복잡도만 올린 것입니다. 실제 병목은 대개 예상 못 한 곳에 있습니다.',
        },
      ],
    },

    {
      heading: '5. 도구는 증상에 따라',
      blocks: [
        {
          kind: 'compare',
          leftLabel: '증상',
          rightLabel: '먼저 볼 것',
          rows: [
            { label: '시작이 느림', left: 'TTI 분포', right: 'RUM → Hermes 프로파일러' },
            { label: '스크롤 끊김', left: 'UI FPS', right: '뷰 계층 · 이미지 크기' },
            { label: '반응 없음', left: 'JS FPS', right: 'Hermes 샘플링 프로파일러' },
            { label: '특정 화면만', left: '리렌더', right: 'React DevTools Profiler' },
            { label: '저가 기기만', left: '실기기 측정', right: 'Flashlight' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'RUM 이 왜 따로 필요한가',
          text:
            '위 도구들은 전부 **내 손에 있는 기기**에서 재는 겁니다. 실제 유저는 3년 된 ' +
            '저가 안드로이드를 쓰고 지하철에서 접속합니다.\n\n' +
            '**RUM 은 문제를 발견하는 도구, 로컬 프로파일러는 원인을 찾는 도구**입니다. ' +
            '순서가 RUM → 로컬입니다.',
        },
      ],
    },

    {
      heading: '6. 정리',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '성능 계측은 **"RUM 으로 발견하고, 프로파일러로 좁히고, 같은 조건으로 다시 재서 확인"** 입니다.\n\n' +
            '고치기 전후로 **두 번** 재야 그게 개선인지 압니다. 안 그러면 "빨라진 것 같아요" 로 ' +
            '끝나는데, 그건 아무것도 안 한 것과 구분이 안 됩니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 마지막 **⑩ React Compiler** 입니다. `useMemo` 를 컴파일러가 대신 발라주는 ' +
            '물건인데, **조용히 실패하는 함정**이 있습니다. 그리고 이 편에서 배운 대로 — ' +
            '리렌더가 병목인지 먼저 재보고 켜는 게 순서입니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 11 },
  hint: { fontSize: 12.5, lineHeight: 19, color: C.ink3 },

  track: { gap: 4 },
  trackLabel: { fontFamily: MONO, fontSize: 10, color: C.ink3 },
  box: { width: 34, height: 22, borderRadius: 4 },
  uiBox: { backgroundColor: C.native },
  jsBox: { backgroundColor: C.js },

  liveRow: { flexDirection: 'row', gap: 9 },
  live: {
    flex: 1,
    backgroundColor: C.code,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 2,
  },
  liveLabel: { fontFamily: MONO, fontSize: 10, color: C.ink3, letterSpacing: 0.5 },
  liveVal: { fontFamily: MONO, fontSize: 22, fontWeight: '800' },

  result: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 6,
  },
  resultTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { fontSize: 12.5, color: C.ink3 },
  v: { fontFamily: MONO, fontSize: 15, fontWeight: '800' },
  note: {
    fontSize: 12,
    lineHeight: 18.5,
    color: C.ink2,
    marginTop: 3,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
})
