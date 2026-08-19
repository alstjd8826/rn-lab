import { useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import {
  installJsiLab,
  isBridgeless,
  isHermes,
  type JsiLab,
} from 'react-native-jsi-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

// ─────────────────────────────────────────────
// 직접 확인 구간 (인터랙티브)
// ─────────────────────────────────────────────
function JsiPlayground() {
  const [lab, setLab] = useState<JsiLab | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sync, setSync] = useState<string | null>(null)
  const [zero, setZero] = useState<{ before: number; after: number; addrSame: boolean } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const install = () => {
    try {
      setLab(installJsiLab())
      setErr(null)
    } catch (e) {
      setErr(String(e))
    }
  }

  const runSync = () => {
    if (!lab) return
    const t0 = performance.now()
    let acc = 0
    for (let i = 0; i < 10_000; i++) acc = lab.add(acc, 1)
    const ms = performance.now() - t0
    setSync(`${acc} · ${ms.toFixed(1)}ms · 호출당 ${((ms / 10_000) * 1000).toFixed(2)}µs`)
  }

  const runZero = () => {
    if (!lab) return
    const buf = new ArrayBuffer(1024 * 1024)
    const view = new Uint8Array(buf)
    const a1 = lab.bufferAddress(buf)
    const a2 = lab.bufferAddress(buf)
    const before = view[0]
    lab.fillBuffer(buf, 7)
    setZero({ before, after: view[0], addrSame: a1 === a2 })
  }

  const runBlock = () => {
    if (!lab) return
    setBlocked('블로킹 중…')
    const ms = lab.blockJsThread(1200)
    setBlocked(`${ms}ms 동안 JS 전체가 멈췄습니다`)
  }

  if (!lab) {
    return (
      <View style={d.wrap}>
        <View style={d.statusRow}>
          <Text style={d.status}>Hermes {isHermes() ? '✅' : '❌'}</Text>
          <Text style={d.status}>Bridgeless {isBridgeless() ? '✅' : '❌'}</Text>
        </View>
        <Text style={d.hint}>
          아래를 누르면 C++ 이 JS 전역에 HostObject 를 꽂습니다.
        </Text>
        <Button title="HostObject 설치하기" onPress={install} />
        {err ? <Text style={d.err}>{err}</Text> : null}
      </View>
    )
  }

  return (
    <View style={d.wrap}>
      <Text style={d.ok}>✅ global.__jsiLab 설치됨 · kind = {lab.kind}</Text>

      {/* 1 */}
      <View style={d.exp}>
        <Text style={d.expTitle}>1 · 동기 호출</Text>
        <Text style={d.expDesc}>add() 를 1만 번. await 이 없습니다.</Text>
        {sync ? <Text style={d.result}>{sync}</Text> : null}
        <Button title="실행" onPress={runSync} />
      </View>

      {/* 2 */}
      <View style={d.exp}>
        <Text style={d.expTitle}>2 · 제로카피</Text>
        <Text style={d.expDesc}>
          1MB 버퍼를 C++ 이 7 로 채웁니다. JS 는 대입을 하지 않습니다.
        </Text>
        {zero ? (
          <View style={d.proof}>
            <View style={d.pcell}>
              <Text style={d.plabel}>쓰기 전</Text>
              <Text style={[d.pval, { color: C.ink3 }]}>view[0] = {zero.before}</Text>
            </View>
            <Text style={d.parrow}>→</Text>
            <View style={d.pcell}>
              <Text style={d.plabel}>C++ memset</Text>
              <Text style={[d.pval, { color: C.native }]}>fill(7)</Text>
            </View>
            <Text style={d.parrow}>→</Text>
            <View style={d.pcell}>
              <Text style={d.plabel}>쓰기 후</Text>
              <Text style={[d.pval, { color: C.js }]}>view[0] = {zero.after}</Text>
            </View>
          </View>
        ) : null}
        {zero ? (
          <Text style={d.result}>
            주소 2회 비교: {zero.addrSame ? '동일 → 복사 없음' : '달라짐'}
          </Text>
        ) : null}
        <Button title="실행" onPress={runZero} />
      </View>

      {/* 3 */}
      <View style={d.exp}>
        <Text style={d.expTitle}>3 · 동기 호출의 대가</Text>
        <Text style={d.expDesc}>
          1.2초 블로킹. 누르면 화면 전체가 잠깁니다.
        </Text>
        {blocked ? <Text style={d.result}>{blocked}</Text> : null}
        <Button title="실행" color={C.warn} onPress={runBlock} />
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// 레슨 본문
// ─────────────────────────────────────────────
export const lesson01: Lesson = {
  no: '①',
  slug: 'jsi',
  title: 'JSI',
  summary: 'C++ 에서 JavaScript 값을 직접 만지게 해주는 통로',

  sources: [
    'reactnative.dev/architecture/landing-page — JSI 정의, 직렬화 비용 제거',
    'reactnative.dev/architecture/glossary — JSI 용어 정의',
    'reactnative.dev/blog/2018/06/14/state-of-react-native-2018 — 브릿지 3요소',
    'reactnative.dev/docs/the-new-architecture/pure-cxx-modules — 모듈 배선',
    '※ HostObject · HostFunction 은 공식 용어집에 없다. jsi.h 의 실제 타입명',
  ],

  chapters: [
    // ── 1장: 왜 필요한가
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: 'JS 로 쓴 앱이 폰의 카메라를 쓰려면?',
      blocks: [
        {
          kind: 'prose',
          text:
            'React Native 앱은 JavaScript 로 씁니다. 그런데 카메라, 파일, 블루투스 같은 건 ' +
            '폰의 네이티브 코드(Swift · Kotlin · C++)만 만질 수 있습니다.\n\n' +
            '그러니까 **서로 다른 언어 두 개가 대화를 해야** 합니다. 이게 React Native 가 ' +
            '푸는 근본 문제이고, JSI 는 그 답 중 하나입니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '핵심 어려움',
          text:
            'JS 와 C++ 은 값을 저장하는 방식이 다릅니다. JS 의 숫자 하나를 C++ 이 ' +
            '그냥 읽을 수가 없습니다. **서로의 메모리를 못 봅니다.**',
        },
        {
          kind: 'prose',
          text:
            '옛날 React Native 는 이걸 **편지**로 해결했습니다. 이름이 “브릿지”였고요.\n\n' +
            'JS 가 네이티브 함수를 부르면, 그 내용을 JSON 글자로 옮겨 적어서 우체통에 넣습니다. ' +
            '네이티브가 나중에 꺼내서 읽고, 답장을 또 글자로 적어 보냅니다.',
        },
        {
          kind: 'code',
          path: '옛 방식',
          code:
            '// 숫자 두 개 더하는데 답장을 기다려야 했다\nconst sum = await NativeModules.Calc.add(1, 2)',
          highlight: [1],
        },
        {
          kind: 'prose',
          text:
            '이 설계에는 성질이 셋 있었고, 그게 그대로 한계였습니다. ' +
            'Meta 가 2018 년에 새 아키텍처를 예고하며 직접 밝힌 내용입니다.',
        },
        {
          kind: 'code',
          path: '공식 원문 · blog/2018-06-14 state-of-react-native-2018',
          code:
            'we designed it to have a single "bridge" between\n' +
            'JavaScript and native that is\n' +
            '  asynchronous, serializable, and batched',
          highlight: [2],
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: '비동기 (asynchronous)',
              text:
                '편지니까 즉시 답이 안 옵니다. **동기 응답을 기대하는 네이티브 API 와 ' +
                '직접 엮을 수가 없습니다.** 값 하나 읽는데도 `await` 가 필요했습니다.',
            },
            {
              title: '모아서 보냄 (batched)',
              text:
                '네이티브 호출을 큐에 쌓았다가 한 번에 보냅니다. ' +
                '그래서 **네이티브로 구현된 함수를 앱이 그때그때 부르기가 어렵습니다.**',
            },
            {
              title: '직렬화 (serializable)',
              text:
                '두 세계가 메모리를 공유하는 대신 **불필요하게 복사**합니다. ' +
                '사진 한 장이 5MB 면 그 5MB 를 통째로 옮겨 적어야 합니다. 초당 30번? 불가능했습니다.',
            },
          ],
        },
      ],
    },

    // ── 2장: JSI가 뭔가
    {
      heading: '2. 그래서 JSI 가 뭔데',
      question: '한 줄로 답하면',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'JSI 는 **C++ 에서 JavaScript 값을 직접 만질 수 있게 해주는 타입들의 모음**입니다.\n' +
            '기능도 아니고, 엔진도 아니고, 최적화도 아닙니다.\n\n' +
            '공식 문서의 표현은 이렇습니다 — "JSI is an interface that allows JavaScript to ' +
            '**hold a reference to a C++ object and vice-versa.** With a memory reference, ' +
            'you can directly invoke methods **without serialization costs**."',
        },
        {
          kind: 'prose',
          text:
            '편지를 없애고, 대신 **직접 가리킬 수 있는 손**을 준 겁니다.\n\n' +
            '책을 보내야 한다고 쳐봅시다. 브릿지는 책 전체를 베껴 써서 보냅니다. ' +
            'JSI 는 “저 책장 세 번째 칸” 이라고 **위치만** 알려줍니다. ' +
            '책이 두꺼워도 알려주는 비용은 똑같습니다.',
        },
        {
          kind: 'prose',
          text: 'JSI 가 실제로 주는 건 C++ 타입 몇 개입니다.',
        },
        {
          kind: 'code',
          code:
            'jsi::Runtime     // JS 엔진 자체를 가리키는 손잡이\n' +
            'jsi::Value       // JS 의 아무 값이나\n' +
            'jsi::Object      // JS 객체\n' +
            'jsi::Function    // JS 함수\n' +
            'jsi::HostObject  // 거꾸로, C++ 객체를 JS 에 보여주기',
          caption:
            '이 타입들이 없던 시절엔 C++ 이 JS 값을 표현할 방법이 아예 없었습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '브릿지',
          rightLabel: 'JSI',
          rows: [
            { label: '전달 방식', left: '글자로 베껴 씀', right: '위치만 알려줌' },
            { label: '언제 답이 옴', left: '다음 차례', right: '같은 줄에서' },
            { label: '1MB 보내기', left: '1MB 를 변환', right: '주소 하나' },
            { label: '객체 참조', left: '불가 (번호로 흉내)', right: '가능' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '자주 하는 오해',
          text:
            '“JSI 가 빠르다” 는 좀 부정확합니다. **JSI 는 옮기지 않게 만들었고, 그래서 빠른 것**입니다. ' +
            '속도는 결과이지 기능이 아닙니다.',
        },
        {
          kind: 'prose',
          text:
            '그리고 JSI 자체는 **아무 일도 하지 않습니다.** 통로일 뿐입니다.\n\n' +
            '· **Hermes** — JS 를 실행하는 엔진 (JSI 가 아님)\n' +
            '· **Fabric** — 이 통로 위에 지은 화면 그리기 시스템\n' +
            '· **TurboModules** — 이 통로 위에 지은 네이티브 기능 시스템\n' +
            '· **Nitro** — 이 통로를 더 좁고 빠르게 다시 깐 것',
        },
      ],
    },

    // ── 3장: 만드는 순서
    {
      heading: '3. 만드는 순서',
      question: '이 앱에서 실제로 이 순서로 만들었습니다',
      blocks: [
        {
          kind: 'prose',
          text:
            'JSI 를 쓰려면 `jsi::Runtime` 이 필요한데, JS 에서는 그걸 얻을 방법이 없습니다. ' +
            '**네이티브에서 받아와야** 합니다. 그 창구를 먼저 만들고, 그 안에서 raw JSI 를 씁니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: '무엇을 만들지 선언한다',
              side: 'js',
              path: 'modules/react-native-jsi-lab/src/specs/NativeJsiLab.ts',
              text:
                '창구의 설계도입니다. 파일 이름이 `Native` 로 시작해야 자동 생성기가 알아봅니다.',
              code:
                'export interface Spec extends TurboModule {\n' +
                '  readonly install: () => boolean\n' +
                '}',
              highlight: [1],
            },
            {
              title: 'C++ 본체를 쓴다',
              side: 'native',
              path: 'modules/react-native-jsi-lab/cpp/NativeJsiLab.cpp',
              text:
                '여기가 핵심입니다. `install()` 이 런타임을 받아서 JS 전역에 객체를 꽂습니다. ' +
                '**JSI 의 전부가 이 한 문장**입니다.',
              code:
                'bool NativeJsiLab::install(jsi::Runtime& rt) {\n' +
                '  rt.global().setProperty(rt, "__jsiLab",\n' +
                '    jsi::Object::createFromHostObject(rt, ...));\n' +
                '  return true;\n' +
                '}',
              highlight: [1, 2],
            },
            {
              title: 'iOS 등록부를 만든다',
              side: 'native',
              path: 'modules/react-native-jsi-lab/ios/NativeJsiLabProvider.mm',
              text:
                '“이 이름을 달라고 하면 이렇게 만들어 주겠다” 는 공장입니다.',
              code:
                'return std::make_shared<facebook::react::NativeJsiLab>(\n' +
                '  params.jsInvoker);',
            },
            {
              title: '빌드에 포함시킨다',
              side: 'native',
              path: 'ReactNativeJsiLab.podspec',
              text:
                'C++ 과 ObjC++ 파일을 컴파일 대상에 넣고, React 관련 의존성을 붙입니다.',
              code:
                's.source_files = "ios/**/*.{h,mm}", "cpp/**/*.{h,cpp}"\n' +
                'install_modules_dependencies(s)',
            },
            {
              title: '자동 생성 설정을 적는다',
              side: 'gen',
              path: 'modules/react-native-jsi-lab/package.json',
              text:
                '스펙 파일이 어디 있는지, 등록부 이름이 뭔지 알려줍니다.',
              code:
                '"codegenConfig": {\n' +
                '  "type": "modules",\n' +
                '  "jsSrcsDir": "src/specs",\n' +
                '  "ios": { "modulesProvider":\n' +
                '    { "NativeJsiLab": "NativeJsiLabProvider" } }\n' +
                '}',
            },
            {
              title: 'pod install → 계약 코드가 생성된다',
              side: 'gen',
              path: 'ios/build/generated/ios/ReactCodegen/JsiLabSpecsJSI.h',
              text:
                '여기서 **사람이 안 쓴 코드**가 나옵니다. JS 호출을 C++ 함수로 연결하는 ' +
                '중개 코드입니다. 재밌는 게 하나 있는데 — JS 쪽은 인자 0개인데 C++ 은 1개입니다. ' +
                '그 차이가 `jsi::Runtime&` 이고, **컴파일 타임에 강제**됩니다.',
              code:
                'methodMap_["install"] = MethodMetadata {\n' +
                '  .argCount = 0, .invoker = __install };\n' +
                '\n' +
                'static_assert(\n' +
                '  bridging::getParameterCount(&T::install) == 1, ...);',
              highlight: [1, 4],
            },
            {
              title: '빌드하고 JS 에서 쓴다',
              side: 'js',
              text: '이제 전역에 꽂힌 객체를 평범한 JS 객체처럼 씁니다.',
              code:
                'NativeJsiLab.install()          // 창구 통과\n' +
                'global.__jsiLab.add(1, 2)       // → 3, 즉시',
              highlight: [1],
            },
          ],
        },
      ],
    },

    // ── 4장: 동작 순서
    {
      heading: '4. 실행될 때 일어나는 일',
      question: 'add(1, 2) 가 C++ 에 도달하기까지',
      blocks: [
        {
          kind: 'steps',
          flavor: 'runtime',
          steps: [
            {
              title: '앱 시작 — 아직 아무것도 안 만들어짐',
              side: 'native',
              text:
                '이름과 공장 위치만 명부에 올라갑니다. 실제 객체는 없습니다. ' +
                '**필요할 때 만드는 방식**이라 모듈이 늘어도 앱 시작이 느려지지 않습니다.',
            },
            {
              title: 'install() 호출 — 이때 처음 생성',
              side: 'js',
              text:
                'JS 가 창구를 찾는 순간 명부를 보고 인스턴스를 만듭니다.',
            },
            {
              title: '자동 생성 코드가 런타임을 넘겨준다',
              side: 'gen',
              text: 'C++ 함수의 첫 인자로 `jsi::Runtime&` 이 들어옵니다.',
            },
            {
              title: 'C++ 이 JS 전역에 객체를 꽂는다',
              side: 'native',
              text:
                '`rt.global()` 은 JS 의 `globalThis` 입니다. **C++ 이 JS 전역을 직접 만지고 있습니다.**',
            },
            {
              title: '.add 를 읽는 순간 C++ 함수가 돈다',
              side: 'js',
              text:
                'HostObject 는 프로퍼티를 미리 갖고 있지 않습니다. JS 가 읽을 때마다 ' +
                'C++ 의 `get()` 이 호출되고, 거기서 뭘 돌려줄지 정합니다.',
            },
            {
              title: '실행 — 옮겨 적는 단계가 없다',
              side: 'native',
              text:
                '`args[0].asNumber()` 는 파싱이 아닙니다. JS 값의 태그를 확인하고 숫자를 읽는 것입니다.',
              code: 'return jsi::Value(args[0].asNumber() + args[1].asNumber());',
              highlight: [0],
            },
            {
              title: '3 — 같은 줄에서, await 없이',
              side: 'js',
              text: '편지를 기다린 게 아니라 함수를 부른 것이기 때문입니다.',
            },
          ],
        },
      ],
    },

    // ── 5장: 직접 확인
    {
      heading: '5. 직접 확인',
      question: '위 설명이 사실인지 눌러서 봅니다',
      blocks: [
        {
          kind: 'demo',
          title: 'raw JSI 놀이터',
          text:
            '**2번 제로카피**를 꼭 보세요. `view[0]` 이 0 에서 7 로 바뀌는데, ' +
            'JS 는 대입을 한 적이 없습니다. C++ 이 JS 의 메모리를 직접 고친 것입니다.',
          render: () => <JsiPlayground />,
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '3번을 누르면',
          text:
            '1.2초 동안 앱이 완전히 얼어붙습니다. **동기 호출이 가능해졌다는 건 ' +
            'JS 를 멈출 수 있게 됐다는 뜻**이기도 합니다. 브릿지 시절엔 비동기가 강제돼서 ' +
            '이 사고가 구조적으로 안 났습니다. 이제는 판단이 개발자 몫입니다.',
        },
      ],
    },

    // ── 6장: 정리
    {
      heading: '6. 정리',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '“JSI 가 없으면 뭐가 불가능한가?” → **C++ 에서 JS 값을 만지는 것.**\n\n' +
            '`rt.global().setProperty(...)` 한 줄이 할 수 있는 일의 전부이고, ' +
            '나머지는 전부 이 능력의 응용입니다.',
        },
        {
          kind: 'prose',
          text:
            '한 가지 더. 이 앱의 `__jsiLab` 타입은 **손으로 적었습니다.** ' +
            '자동 생성을 안 거쳤으니 C++ 구현과 맞는지 아무도 검사하지 않습니다. ' +
            '오타가 나면 런타임에 터집니다.\n\n' +
            '같은 프로젝트 안에 두 방식이 나란히 있는 셈인데 — `install()` 은 생성기를 거쳐 ' +
            '컴파일 타임에 막히고, `__jsiLab` 은 맨몸입니다. ' +
            '**④ Codegen** 편에서 이 차이를 다룹니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 12 },
  statusRow: { flexDirection: 'row', gap: 14 },
  status: { fontFamily: MONO, fontSize: 12, color: C.ink2 },
  hint: { fontSize: 14, lineHeight: 21, color: C.ink2 },
  err: { fontSize: 12.5, color: C.warn },
  ok: { fontSize: 14, fontWeight: '700', color: C.ok },

  exp: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 7,
  },
  expTitle: { fontSize: 14.5, fontWeight: '800', color: C.ink },
  expDesc: { fontSize: 13.5, lineHeight: 20, color: C.ink2 },
  result: {
    fontFamily: MONO,
    fontSize: 11.5,
    lineHeight: 18,
    color: C.ink,
    backgroundColor: C.code,
    borderRadius: 4,
    padding: 8,
  },

  proof: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pcell: { flex: 1, gap: 2 },
  plabel: { fontFamily: MONO, fontSize: 9, color: C.ink3, letterSpacing: 0.3 },
  pval: { fontFamily: MONO, fontSize: 11.5, fontWeight: '700' },
  parrow: { fontSize: 12, color: C.ink3 },
})
