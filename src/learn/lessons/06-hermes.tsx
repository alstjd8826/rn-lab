import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Props = Record<string, string | number | boolean>
type Stats = Record<string, number>

function hermes(): Record<string, unknown> | undefined {
  // Strict API 에서는 `global` 앰비언트 타입이 없다. 표준 globalThis 를 쓴다.
  return (globalThis as unknown as Record<string, Record<string, unknown> | undefined>)
    .HermesInternal
}

function call<T>(name: string): T | undefined {
  const H = hermes()
  const fn = H?.[name] as (() => T) | undefined
  try {
    return fn?.()
  } catch {
    return undefined
  }
}

// ── 실험 1 · 지금 돌고 있는 엔진의 정체
function EngineDemo() {
  const [props, setProps] = useState<Props | null>(null)
  const [keys, setKeys] = useState<string | null>(null)

  const read = useCallback(() => {
    setProps((call<Props>('getRuntimeProperties') ?? {}) as Props)
    const H = hermes()
    setKeys(H ? JSON.stringify(Object.keys(H)) : '없음')
  }, [])

  const ORDER = [
    'OSS Release Version',
    'Bytecode Version',
    'GC',
    'Static Hermes',
    'Build',
    'Debugger Enabled',
  ]

  return (
    <View style={d.wrap}>
      <Text style={d.hint}>
        Hermes 가 JS 로 열어둔 창구 `global.HermesInternal` 에게 직접 물어봅니다.
      </Text>
      <Button title="엔진에게 물어보기" onPress={read} />

      {props ? (
        <View style={d.card}>
          {ORDER.filter((k) => k in props).map((k) => (
            <View key={k} style={d.kv}>
              <Text style={d.k}>{k}</Text>
              <Text style={d.v}>{String(props[k])}</Text>
            </View>
          ))}
          <Text style={d.note}>
            Object.keys(HermesInternal) = {keys} — 비어 있습니다. ①에서 만든
            HostObject 와 같은 물건이라, 프로퍼티가 미리 존재하지 않고 접근할 때마다
            네이티브 쪽 get() 이 불립니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ── 실험 2 · Hades 가 실제로 도는지
function GcDemo() {
  const [delta, setDelta] = useState<{
    gcs: number
    gcMs: number
    allocMB: number
    heapMB: number
  } | null>(null)

  const run = useCallback(() => {
    const before = call<Stats>('getInstrumentedStats')
    if (!before) return

    // 일부러 쓰레기를 많이 만든다.
    let sink: number[][] = []
    for (let i = 0; i < 300; i++) {
      sink.push(new Array(20000).fill(i))
      if (i % 5 === 0) sink = [] // 참조를 끊어 수거 대상으로
    }
    sink = []

    const after = call<Stats>('getInstrumentedStats')
    if (!after) return

    setDelta({
      gcs: after.js_numGCs - before.js_numGCs,
      gcMs: (after.js_gcTime - before.js_gcTime) * 1000,
      allocMB:
        (after.js_totalAllocatedBytes - before.js_totalAllocatedBytes) / 1048576,
      heapMB: after.js_heapSize / 1048576,
    })
  }, [])

  return (
    <View style={d.wrap}>
      <Text style={d.hint}>
        배열 300개(각 2만 칸)를 만들었다 버립니다. 그 사이 GC 가 몇 번 돌았는지
        엔진에게 물어봅니다.
      </Text>
      <Button title="쓰레기 만들기" onPress={run} />

      {delta ? (
        <View style={d.card}>
          <View style={d.kv}>
            <Text style={d.k}>GC 횟수 증가</Text>
            <Text style={[d.v, { color: C.native }]}>+{delta.gcs}</Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>GC 에 쓴 시간</Text>
            <Text style={[d.v, { color: C.native }]}>
              {delta.gcMs.toFixed(1)} ms
            </Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>새로 할당한 양</Text>
            <Text style={d.v}>{delta.allocMB.toFixed(1)} MB</Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>GC 1회 평균</Text>
            <Text style={d.v}>
              {delta.gcs > 0 ? (delta.gcMs / delta.gcs).toFixed(2) : '—'} ms
            </Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>현재 힙 크기</Text>
            <Text style={d.v}>{delta.heapMB.toFixed(1)} MB</Text>
          </View>
          <Text style={d.note}>
            수백 MB 를 할당하고 버렸는데 힙은 수십 MB 로 유지됩니다. 수거가 제대로
            됐다는 뜻입니다. GC 한 번에 쓴 시간도 1ms 안팎이고요.{'\n\n'}
            다만 버튼을 누른 동안 화면이 잠깐 멈췄을 겁니다. 그건 GC 탓이 아니라
            할당 루프 자체가 동기라서입니다 — ①에서 본 그 이야기입니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson06: Lesson = {
  no: '⑥',
  slug: 'hermes',
  title: 'Hermes',
  summary: '앱 켤 때 JS 를 해석하지 않게 만든 모바일 전용 엔진',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: '한 층 아래로 — 그 JS 는 대체 뭐가 실행하나',
      blocks: [
        {
          kind: 'prose',
          text:
            '①~⑤ 는 전부 **JS 와 네이티브를 어떻게 잇느냐** 였습니다. ' +
            'Hermes 는 층이 하나 아래입니다 — **그 JS 를 실행하는 엔진** 자체입니다.',
        },
        {
          kind: 'prose',
          text:
            '원래 RN 은 **JavaScriptCore**(사파리 엔진)를 썼습니다. 나쁜 엔진이 아니라 ' +
            '**브라우저용으로 설계됐을 뿐**입니다. 그 차이가 큽니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '브라우저용 엔진이 모바일에서 손해 보는 지점',
          text:
            '**JIT 는 달아오를 시간이 필요합니다.** 오래 돌수록 빨라지는 전략인데, ' +
            '모바일 앱은 켰다가 30초 쓰고 끕니다. 워밍업 비용만 내고 이득은 못 봅니다. ' +
            '게다가 컴파일된 코드를 들고 있어야 해서 메모리도 많이 씁니다.',
        },
        {
          kind: 'prose',
          text:
            '그런데 더 큰 문제는 따로 있었습니다. **앱을 켤 때마다 JS 를 파싱**한다는 것입니다.',
        },
        {
          kind: 'code',
          code:
            '앱 실행 → 번들 읽기 → 파싱 → 컴파일 → 실행\n' +
            '                      ^^^^^^^^^^^^^\n' +
            '            번들 크기에 비례하는 순수 낭비',
          caption:
            '내용은 어제와 똑같은데 매번 다시 읽습니다. 앱이 커질수록 시작이 느려지는 주범이었습니다.',
        },
      ],
    },

    {
      heading: '2. 그래서 Hermes 가 뭔데',
      question: '한 줄로',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'Hermes 는 **파싱과 컴파일을 빌드 타임으로 옮긴 모바일 전용 JS 엔진**입니다.\n' +
            '유저 폰에서 매번 하던 일을 CI 서버에서 한 번만 합니다.',
        },
        {
          kind: 'code',
          code:
            '[ 빌드 타임 ]  JS → 파싱 → 컴파일 → 바이트코드(.hbc)\n' +
            '                                        │  앱에 담아 배포\n' +
            '[ 런타임 ]     .hbc 를 메모리 매핑 → 바로 실행\n' +
            '               ^^^^^^^^^^^^^^^^^^\n' +
            '               파싱 단계가 아예 없음',
        },
        {
          kind: 'prose',
          text:
            '여기에 두 가지가 더 붙습니다.\n\n' +
            '**메모리 매핑(mmap)** — 파일을 통째로 올리지 않고 매핑만 해둡니다. ' +
            '실제 실행되는 부분만 OS 가 페이지 단위로 읽어옵니다.\n\n' +
            '**지연 컴파일** — 시작에 필요한 함수만 준비하고 나머지는 처음 호출될 때 처리합니다.',
        },
      ],
    },

    {
      heading: '3. 증거 — 릴리즈 번들을 열어봤습니다',
      question: '정말 바이트코드인가',
      blocks: [
        {
          kind: 'prose',
          text:
            '말로만 하면 믿기 어려우니 이 앱의 **실제 릴리즈 번들 앞부분**을 찍어봤습니다.',
        },
        {
          kind: 'code',
          path: 'rnlab.app/main.jsbundle',
          code:
            '$ xxd -l 16 main.jsbundle\n' +
            '00000000: c61f bc03 c103 191f 6200 0000 ...\n' +
            '          ^^^^^^^^^^^^^^^^^^^ ^^^^\n' +
            '          Hermes 바이트코드 매직   버전 98',
          highlight: [1, 2, 3],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '`main.jsbundle` 이라는 이름이지만 **JavaScript 가 아닙니다.** ' +
            '텍스트로 읽으려 하면 `Illegal byte sequence` 가 납니다. 3.2MB 짜리 바이너리 바이트코드입니다.\n\n' +
            '유저 폰은 이걸 파싱하지 않습니다. 그냥 매핑해서 실행합니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '개발 중에는 다릅니다',
          text:
            '지금 시뮬레이터에서 도는 앱은 Metro 가 번들을 서빙하는 개발 빌드라 ' +
            '바이트코드 사전 컴파일이 적용되지 않습니다. ' +
            '**Hermes 의 시작 속도 이점은 릴리즈 빌드에서만** 제대로 나옵니다.',
        },
      ],
    },

    {
      heading: '4. Hades — 멈추지 않고 치우는 청소부',
      blocks: [
        {
          kind: 'prose',
          text:
            '모바일 특화가 하나 더 있습니다. **가비지 컬렉터**입니다.\n\n' +
            '전통적인 GC 는 “전부 멈추고 청소한 다음 재개” 합니다. 그 순간이 하필 ' +
            '스크롤 중이면 그대로 프레임 드롭입니다.',
        },
        {
          kind: 'compare',
          leftLabel: '전통적 GC',
          rightLabel: 'Hades',
          rows: [
            { label: '방식', left: '전부 멈추고 청소', right: '돌리면서 동시에' },
            { label: '멈춤 구간', left: '길다', right: '짧다' },
            { label: '스크롤 중', left: '프레임 드롭', right: '영향 적음' },
          ],
        },
        {
          kind: 'prose',
          text:
            'Hermes 는 이걸 **동시(concurrent) GC** 로 만들었고 이름이 Hades 입니다. ' +
            '아래 실험에서 실제로 도는 걸 숫자로 봅니다.',
        },
      ],
    },

    {
      heading: '5. Hermes V1, 그리고 Static Hermes 오해',
      question: '2026년의 변화',
      blocks: [
        {
          kind: 'prose',
          text:
            '**RN 0.84(2026년 2월)부터 Hermes V1 이 양 플랫폼 기본**이 됐습니다. ' +
            '컴파일러 재작성, 새 바이트코드 포맷, 최신 JS 문법 지원 대폭 개선이 들어갔습니다.\n\n' +
            '초기 Hermes 의 최대 약점이 “최신 문법 지원이 늦다” 였는데 그게 해소된 버전입니다. ' +
            '좋은 점은 **할 게 없다는 것**입니다. 설정 변경도 마이그레이션도 없습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '여기서 헷갈리기 쉽습니다',
          text:
            '이 앱의 런타임에 물어보면 **`Static Hermes: true`** 라고 나옵니다. ' +
            '그럼 내 JS 가 네이티브 기계어로 컴파일된 걸까요?\n\n' +
            '**아닙니다.** 같은 응답에 `Bytecode Version: 98` 이 있고, 위에서 본 것처럼 ' +
            '릴리즈 번들은 바이트코드 매직으로 시작합니다.',
        },
        {
          kind: 'prose',
          text:
            '증거를 종합하면 이렇게 읽는 게 맞습니다 — **VM 자체가 Static Hermes 코드베이스로 ' +
            '빌드됐다**는 뜻이지, 내 JS 를 네이티브로 컴파일한다는 뜻이 아닙니다.\n\n' +
            'Static Hermes 가 지향하는 것(타입 정보를 써서 JS 를 네이티브 오브젝트 파일로 ' +
            '컴파일)은 아직 켜져 있지 않습니다. V1 은 그 기반 공사에 해당합니다.',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '이 편에서 얻을 습관',
          text:
            '**런타임 플래그 하나만 보고 결론 내리면 틀립니다.** ' +
            '`Static Hermes: true` 만 봤으면 오해했을 텐데, 번들의 매직 바이트가 진실을 말해줬습니다. ' +
            '⑨ 성능 계측 편에서 계속될 이야기이기도 합니다 — 재보고 말하기.',
        },
      ],
    },

    {
      heading: '6. 직접 확인',
      blocks: [
        {
          kind: 'demo',
          title: '실험 1 · 지금 돌고 있는 엔진의 정체',
          render: () => <EngineDemo />,
        },
        {
          kind: 'demo',
          title: '실험 2 · Hades 가 실제로 도는가',
          render: () => <GcDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '실무 팁 — 소스맵을 꼭 올리세요',
          text:
            '프로덕션 크래시의 스택트레이스는 **바이트코드 기준**으로 찍힙니다. ' +
            '사람이 읽을 수 있는 물건이 아닙니다. 크래시 리포팅을 쓴다면 빌드할 때 ' +
            'Hermes 소스맵을 같이 업로드해야 합니다. 빠뜨리면 로그는 쌓이는데 전부 해독 불가입니다.',
        },
      ],
    },

    {
      heading: '7. 정리',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '“Hermes 가 없으면 뭐가 불가능한가?” → **앱 켤 때 JS 파싱을 건너뛰는 것.**\n\n' +
            'JSI 가 다리였다면 Hermes 는 다리 이쪽 편의 땅입니다. 층이 달라서 서로 독립적이고, ' +
            '그래서 JSI 가 엔진에 안 묶이는 설계였던 겁니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **⑦ Expo** 입니다. 여기까지 여섯 편이 RN 내부 구조였다면, ' +
            '이제 성격이 바뀝니다 — 개발·빌드·배포를 어떻게 굴리느냐는 도구 계층이고, ' +
            '③에서 빌드가 깨졌을 때 `prebuild --clean` 으로 살아난 그 이야기의 정체입니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 11 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },
  card: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 6,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  k: { fontSize: 12.5, color: C.ink3, flexShrink: 1 },
  v: {
    fontFamily: MONO,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.ink,
    flexShrink: 1,
  },
  note: {
    fontSize: 12,
    lineHeight: 18.5,
    color: C.ink2,
    marginTop: 4,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
})
