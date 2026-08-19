import { useEffect, useRef, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { isResolvedInJs, turboLab } from 'react-native-turbo-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

// 이 파일이 처음 평가되는 시점. 앱 시작 시점의 대용으로 쓴다.
const JS_START = Date.now()

type Reading = { createdAtMs: number; uptimeMs: number; pings: number }

function LazyCreationDemo() {
  const [elapsed, setElapsed] = useState(0)
  const [first, setFirst] = useState<Reading | null>(null)
  const [latest, setLatest] = useState<Reading | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timer.current = setInterval(() => {
      setElapsed((Date.now() - JS_START) / 1000)
    }, 100)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const read = (): Reading => ({
    createdAtMs: turboLab.getCreatedAtMs(),
    uptimeMs: turboLab.getUptimeMs(),
    pings: turboLab.ping(),
  })

  const callFirst = () => {
    const r = read()
    setFirst(r)
    setLatest(r)
  }

  const callAgain = () => setLatest(read())

  const s = (ms: number) => `${(ms / 1000).toFixed(1)}초`

  return (
    <View style={d.wrap}>
      <View style={d.clock}>
        <Text style={d.clockLabel}>화면 열린 지</Text>
        <Text style={d.clockVal}>{elapsed.toFixed(1)}초</Text>
      </View>

      <Text style={d.hint}>
        {first === null
          ? 'JS 쪽에서 이 모듈은 아직 ' +
            (isResolvedInJs() ? '해석됨' : '해석되지 않음') +
            '. 아래를 누르는 순간 네이티브 인스턴스가 만들어집니다.'
          : '이제 만들어졌습니다. 다시 눌러도 새로 만들어지지 않습니다.'}
      </Text>

      {first === null ? (
        <Button title="모듈 처음 부르기" onPress={callFirst} />
      ) : (
        <>
          <View style={d.rows}>
            <Row
              label="모듈이 만들어진 시점"
              value={s(first.createdAtMs)}
              color={C.native}
              note="네이티브 로드 후 경과"
            />
            <Row
              label="처음 부른 시점"
              value={s(first.uptimeMs)}
              color={C.js}
              note="버튼을 누른 순간"
            />
            <Row
              label="지금"
              value={latest ? s(latest.uptimeMs) : '—'}
              color={C.ink2}
            />
            <Row
              label="생성 시점 (다시 읽기)"
              value={latest ? s(latest.createdAtMs) : '—'}
              color={C.native}
              note="안 바뀌면 같은 인스턴스"
            />
            <Row
              label="ping 누적"
              value={latest ? String(latest.pings) : '—'}
              color={C.struct}
            />
          </View>

          <Text style={d.verdict}>
            {Math.abs(first.createdAtMs - first.uptimeMs) < 500
              ? '✅ 생성 시점과 처음 부른 시점이 거의 같습니다 — 앱 시작 때가 아니라 이때 만들어진 것입니다'
              : `생성 시점이 처음 부른 시점보다 ${s(first.uptimeMs - first.createdAtMs)} 앞섭니다`}
          </Text>

          <Button title="다시 부르기" onPress={callAgain} />
        </>
      )}
    </View>
  )
}

function Row({
  label,
  value,
  color,
  note,
}: {
  label: string
  value: string
  color: string
  note?: string
}) {
  return (
    <View style={d.row}>
      <View style={d.rowLeft}>
        <Text style={d.rowLabel}>{label}</Text>
        {note ? <Text style={d.rowNote}>{note}</Text> : null}
      </View>
      <Text style={[d.rowVal, { color }]}>{value}</Text>
    </View>
  )
}

export const lesson03: Lesson = {
  no: '③',
  slug: 'turbomodules',
  title: 'TurboModules',
  summary: '네이티브 기능을 앱 시작 때가 아니라 처음 쓸 때 만드는 방식',

  sources: [
    'reactnative.dev/docs/legacy/native-modules-android — eagerly initializes 원문, TurboReactPackage 대안',
    'reactnative.dev/docs/turbo-native-modules-introduction — 스펙 우선 방식과 타입 안전성',
    'reactnative.dev/docs/the-new-architecture/pure-cxx-modules — 순수 C++ 모듈 배선',
    'reactnative.dev/blog/2018/06/14/state-of-react-native-2018 — 비동기 브릿지의 한계',
    '※ 지연 생성은 공식 TurboModules 문서에 없다. 5장의 실측이 근거',
  ],

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: '카메라를 안 쓰는 화면에서도 카메라 모듈이 켜져 있어야 하나',
      blocks: [
        {
          kind: 'prose',
          text:
            '①에서 본 JSI 는 “통로” 였고, ②의 Fabric 은 그 위에 지은 **화면 그리기** 시스템이었습니다. ' +
            'TurboModules 는 같은 통로 위에 지은 **네이티브 기능** 시스템입니다.\n\n' +
            '카메라, 파일, 결제, 블루투스처럼 화면에 안 그려지지만 JS 가 불러야 하는 것들이요.',
        },
        {
          kind: 'prose',
          text:
            '옛 방식은 모듈을 등록할 때 이렇게 했습니다. 리턴하는 시점에 ' +
            '**이미 인스턴스가 다 만들어져 있습니다.**',
        },
        {
          kind: 'code',
          path: '옛 방식 (Android 예시)',
          code:
            'public List<NativeModule> createNativeModules(ctx) {\n' +
            '  return Arrays.asList(\n' +
            '    new CameraModule(ctx),     // ← 여기서 new\n' +
            '    new PaymentModule(ctx),    // ← 얘도\n' +
            '    new BluetoothModule(ctx)   // ← 얘도\n' +
            '  );\n' +
            '}',
          highlight: [2, 3, 4],
        },
        {
          kind: 'code',
          path: '공식 원문 · docs/legacy/native-modules-android',
          code:
            'this way of registering native modules eagerly\n' +
            'initializes all native modules when the\n' +
            'application starts, which adds to the startup\n' +
            'time of an application.',
          highlight: [0, 1],
          caption:
            '문서가 직접 인정하는 문제입니다. 대안으로 TurboReactPackage 를 안내합니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '무슨 일이 생기나',
          text:
            '블루투스를 설정 화면에서만 쓰는데 **앱 켜자마자** 초기화됩니다. ' +
            '모듈이 50개면 50개를 다 만듭니다. **라이브러리를 추가할수록 앱 시작이 느려지고**, ' +
            '정작 그 라이브러리를 쓰지도 않는 화면에서요.',
        },
        {
          kind: 'prose',
          text:
            '문제가 하나 더 있었습니다. **타입이 없었습니다.**\n\n' +
            '`NativeModules.Camera.takePhoto()` 가 맞는 호출인지 아무도 검사하지 않습니다. ' +
            '메서드 이름이 틀렸으면 런타임에 `undefined is not a function` 으로 터집니다.',
        },
      ],
    },

    {
      heading: '2. 그래서 TurboModules 가 뭔데',
      question: '한 줄로',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'TurboModules 는 **네이티브 모듈을 프록시 뒤에 숨겨서 처음 쓸 때 만들고, ' +
            '타입 계약은 Codegen 이 강제하는 방식**입니다.',
        },
        {
          kind: 'prose',
          text:
            '앱이 켜질 때 실제로 하는 일은 **이름과 공장 위치를 명부에 적는 것 하나**입니다. ' +
            '모듈은 만들지 않습니다.\n\n' +
            'JS 가 그 모듈을 처음 찾는 순간 명부를 보고 인스턴스를 만들고, ' +
            '그 다음부터는 캐시에서 꺼냅니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '이건 문서가 아니라 실측 근거입니다',
          text:
            'TurboModules 공식 문서는 **타입 안전성 중심으로 설명**하고 지연 생성은 ' +
            '언급하지 않습니다. 레거시 문서가 "eagerly initializes" 문제를 인정하고 ' +
            '대안을 안내할 뿐입니다.\n\n' +
            '그래서 지연 생성 여부는 **이 앱에서 직접 재서 확인**했습니다. 5장이 그 측정입니다.',
        },
        {
          kind: 'compare',
          leftLabel: '옛 NativeModules',
          rightLabel: 'TurboModules',
          rows: [
            { label: '생성 시점', left: '앱 시작 시 전부', right: '처음 쓸 때 하나씩' },
            { label: '시작 비용', left: '모듈 수에 비례', right: '거의 무관' },
            { label: '타입 검사', left: '없음', right: '컴파일 타임' },
            { label: '호출 방식', left: '비동기만', right: '동기도 가능' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '①과 무슨 관계인가',
          text:
            '①에서 만든 것도 실은 TurboModule 이었습니다. 다만 거기서는 ' +
            '`jsi::Runtime` 을 얻는 **창구**로만 썼고, 기능은 raw JSI 에 뒀습니다.\n' +
            '이번에는 TurboModule 자체를 목적으로 씁니다.',
        },
      ],
    },

    {
      heading: '3. 만드는 순서',
      question: '①과 배선은 같습니다. 다른 점만 봅니다',
      blocks: [
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: '스펙을 쓴다',
              side: 'js',
              path: 'modules/react-native-turbo-lab/src/specs/NativeTurboLab.ts',
              text:
                '핵심은 `getCreatedAtMs` 입니다. 이 값이 0 에 가까우면 앱 시작 때 만들어진 것이고, ' +
                '버튼 누른 시점과 비슷하면 그때 만들어진 것입니다.',
              code:
                'export interface Spec extends TurboModule {\n' +
                '  readonly getCreatedAtMs: () => number\n' +
                '  readonly getUptimeMs: () => number\n' +
                '  readonly ping: () => number\n' +
                '}',
              highlight: [1],
            },
            {
              title: 'C++ 생성자에 시각을 기록한다',
              side: 'native',
              path: 'modules/react-native-turbo-lab/cpp/NativeTurboLab.cpp',
              text:
                '**이 생성자가 언제 불리는지가 이 레슨의 전부입니다.** ' +
                '기준 시각은 네이티브 라이브러리가 로드될 때 한 번 잡습니다.',
              code:
                'const auto kLoadTime = std::chrono::steady_clock::now();\n' +
                '\n' +
                'NativeTurboLab::NativeTurboLab(jsInvoker)\n' +
                '    : NativeTurboLabCxxSpec(std::move(jsInvoker)),\n' +
                '      createdAtMs_(msSinceLoad()) {}',
              highlight: [4],
            },
            {
              title: '등록부와 podspec — ①과 동일',
              side: 'gen',
              text:
                'Provider 클래스, `ios.modulesProvider` 매핑, podspec. ' +
                '①에서 한 것과 똑같습니다. 한 번 뚫어두면 재사용됩니다.',
              code:
                '"ios": { "modulesProvider": {\n' +
                '  "NativeTurboLab": "NativeTurboLabProvider"\n' +
                '} }',
            },
            {
              title: '★ import 위치가 실험을 망친다',
              side: 'js',
              path: 'modules/react-native-turbo-lab/src/index.ts',
              text:
                '여기서 한 번 걸렸습니다. `TurboModuleRegistry.getEnforcing(...)` 는 ' +
                '**그 파일이 import 되는 순간** 실행되고, 그게 곧 인스턴스 생성을 유발합니다.\n\n' +
                '그래서 평범하게 import 하면 앱 시작 때 만들어져 버려서 실험이 무의미해집니다. ' +
                '실제 참조를 처음 쓸 때까지 미뤄야 했습니다.',
              code:
                '// ❌ 이러면 이 파일을 import 하는 순간 생성됨\n' +
                "import Native from './specs/NativeTurboLab'\n" +
                '\n' +
                '// ✅ 처음 쓸 때까지 미룸\n' +
                'function mod() {\n' +
                '  if (!cached) cached =\n' +
                "    require('./specs/NativeTurboLab').default\n" +
                '  return cached\n' +
                '}',
              highlight: [4, 5, 6],
            },
          ],
        },
      ],
    },

    {
      heading: '4. 실행될 때 일어나는 일',
      blocks: [
        {
          kind: 'steps',
          flavor: 'runtime',
          steps: [
            {
              title: '앱 시작 — 명부에 문자열만 올라간다',
              side: 'native',
              text:
                '“NativeTurboLab 을 달라고 하면 NativeTurboLabProvider 로 만들어라” 는 ' +
                '매핑 하나. 인스턴스는 없습니다.',
              code: '@"NativeTurboLab": @"NativeTurboLabProvider"',
            },
            {
              title: 'JS 가 처음 모듈을 찾는다',
              side: 'js',
              text:
                '`TurboModuleRegistry.getEnforcing(\'NativeTurboLab\')` 이 JSI 로 C++ 에 들어갑니다.',
            },
            {
              title: '캐시 확인 → 없으면 공장 호출',
              side: 'gen',
              text:
                'C++ 쪽 TurboModuleManager 가 캐시를 보고, 없으면 Provider 의 ' +
                '`getTurboModule` 을 부릅니다.',
            },
            {
              title: '★ 이때 생성자가 불린다',
              side: 'native',
              text:
                '`createdAtMs_` 가 기록되는 순간입니다. 아래 실험에서 이 값을 봅니다.',
            },
            {
              title: '캐시에 저장 → 두 번째부터는 재사용',
              side: 'native',
              text:
                '같은 모듈을 다시 찾으면 새로 만들지 않습니다. ' +
                '그래서 `createdAtMs` 는 두 번째 호출에서도 안 바뀝니다.',
            },
          ],
        },
      ],
    },

    {
      heading: '5. 직접 확인',
      question: '정말 처음 쓸 때 만들어지는지',
      blocks: [
        {
          kind: 'demo',
          title: '지연 생성 관찰',
          text:
            '위에 초가 흐릅니다. **좀 기다린 뒤에** 버튼을 누르세요. ' +
            '모듈이 앱 시작 때 만들어졌다면 생성 시점이 0초 근처여야 하고, ' +
            '누른 순간 만들어졌다면 지금 시각과 비슷해야 합니다.',
          render: () => <LazyCreationDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '“다시 부르기” 를 누르면 **생성 시점은 그대로**이고 ping 만 올라갑니다. ' +
            '한 번 만든 인스턴스를 캐시해서 재사용한다는 뜻입니다.',
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
            '“TurboModules 가 없으면 뭐가 불가능한가?” → **모듈을 늘려도 앱 시작이 안 느려지는 것.**\n\n' +
            '거기에 Codegen 이 붙어서 타입 계약까지 컴파일 타임에 강제됩니다.',
        },
        {
          kind: 'prose',
          text:
            '지연 생성이 좋기만 한 건 아닙니다. 예전엔 **앱 시작 시 모든 모듈이 초기화된다**는 ' +
            '전제로 짠 코드가 있었습니다. 푸시 리스너를 모듈 생성자에서 등록하는 식이죠.\n\n' +
            '이제는 JS 가 부르기 전까지 생성 자체가 안 되니 **리스너가 등록되지 않아 이벤트를 놓칩니다.** ' +
            '“왜 푸시가 가끔 안 와요” 로 나타나는데 원인을 여기까지 추적하기가 쉽지 않습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '이번에 겪은 빌드 함정',
          text:
            '이 모듈을 추가한 뒤 빌드가 링커 에러로 깨졌습니다. RN 코어의 디버그 심볼 ' +
            '22개를 못 찾는 증상이었는데, **원인은 이 모듈이 아니었습니다** — 빼도 같은 에러가 났습니다.\n\n' +
            '`ios/` 를 통째로 재생성(`expo prebuild --clean`)하니 해결됐습니다. ' +
            '⑦ Expo 편에서 다룰 **CNG** 의 실제 효용이 이런 겁니다 — 네이티브 폴더를 ' +
            '산출물로 취급하니 의심스러우면 버리고 다시 만들면 됩니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **④ Codegen** 입니다. 여기까지 세 편에서 계속 “Codegen 이 만들어준다” 고 ' +
            '넘어갔는데, ①에서 손으로 적은 타입과 생성된 계약을 나란히 놓고 비교합니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },

  clock: {
    backgroundColor: C.code,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  clockLabel: { fontFamily: MONO, fontSize: 10, color: C.ink3, letterSpacing: 0.5 },
  clockVal: { fontFamily: MONO, fontSize: 26, fontWeight: '700', color: C.ink },

  rows: { gap: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    gap: 10,
  },
  rowLeft: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 13.5, color: C.ink },
  rowNote: { fontSize: 11, color: C.ink3 },
  rowVal: { fontFamily: MONO, fontSize: 14, fontWeight: '700' },

  verdict: { fontSize: 13.5, lineHeight: 21, color: C.ok, fontWeight: '600' },
})
