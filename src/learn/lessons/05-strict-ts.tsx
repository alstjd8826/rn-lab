import { useCallback, useRef, useState, type ComponentRef } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

// ref 에 실제로 뭐가 담기는지 런타임에 까본다.
// "View 는 컴포넌트, ref 에 담기는 건 인스턴스" 를 눈으로 확인하는 용도.
const PROBED = [
  // DOM 노드라면 있어야 할 것들
  'getBoundingClientRect',
  'measure',
  'measureInWindow',
  'focus',
  'blur',
  'setNativeProps',
  'nodeName',
  'parentElement',
  'ownerDocument',
  // 반대로, React 컴포넌트라면 있어야 할 것들
  'props',
  'state',
  'render',
] as const

function RefShapeDemo() {
  const boxRef = useRef<ComponentRef<typeof View> | null>(null)
  const [info, setInfo] = useState<{
    ctor: string
    found: string[]
    missing: string[]
    rect: string
  } | null>(null)

  const inspect = useCallback(() => {
    const node = boxRef.current
    if (!node) return

    const has = (k: string) => {
      const v = (node as unknown as Record<string, unknown>)[k]
      return v !== undefined
    }

    const found = PROBED.filter(has)
    const missing = PROBED.filter((k) => !has(k))
    const r = node.getBoundingClientRect()

    setInfo({
      ctor: node.constructor?.name ?? '(알 수 없음)',
      found,
      missing,
      rect: `${r.width.toFixed(0)} × ${r.height.toFixed(0)} @ (${r.x.toFixed(0)}, ${r.y.toFixed(0)})`,
    })
  }, [])

  return (
    <View style={d.wrap}>
      <View ref={boxRef} style={d.box} collapsable={false}>
        <Text style={d.boxText}>이 View 의 ref 를 들여다봅니다</Text>
      </View>

      <Button title="ref 안을 까보기" onPress={inspect} />

      {info ? (
        <View style={d.result}>
          <View style={d.kv}>
            <Text style={d.k}>실제 클래스</Text>
            <Text style={[d.v, { color: C.js }]}>{info.ctor}</Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>getBoundingClientRect()</Text>
            <Text style={d.v}>{info.rect}</Text>
          </View>

          <Text style={d.sub}>있는 것</Text>
          <Text style={d.list}>{info.found.join(' · ') || '없음'}</Text>

          <Text style={d.sub}>없는 것</Text>
          <Text style={[d.list, { color: C.ink3 }]}>
            {info.missing.join(' · ') || '없음'}
          </Text>

          <Text style={d.note}>
            View 라는 컴포넌트가 담긴 게 아닙니다. DOM 노드에 가까운 별개의
            객체이고, 그래서 타입 이름도 달라야 합니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson05: Lesson = {
  no: '⑤',
  slug: 'strict-ts',
  title: 'Strict TypeScript API',
  summary: 'RN 타입을 손으로 안 적고 소스에서 생성 — 그리고 뒷문 잠그기',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: 'RN 의 TypeScript 타입은 누가 적었나',
      blocks: [
        {
          kind: 'prose',
          text:
            'RN 코어는 **Flow** 로 쓰여 있습니다. TypeScript 가 아닙니다. ' +
            '그런데 쓰는 사람은 대부분 TypeScript 를 씁니다.\n\n' +
            '이 간극을 어떻게 메웠냐면 — **손으로 적었습니다.**',
        },
        {
          kind: 'code',
          code:
            'RN 구현 (Flow)   ←  아무 연결 없음  →   TS 타입 정의 (수기)',
          caption:
            '④ Codegen 편에서 본 "세 군데에 손으로 적는" 문제를, RN 팀이 자기 코드에서 똑같이 겪고 있었습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '더 큰 문제 — 다들 뒷문으로 들어갔다',
          text:
            '필요한 게 공개 API 에 없으니 다들 내부 경로를 직접 팠습니다.\n\n' +
            '`react-native/Libraries/Utilities/codegenNativeComponent` 같은 것들이요. ' +
            '이게 퍼지면서 **RN 팀이 내부를 못 고치게** 됐습니다. 파일 하나 옮기면 ' +
            '전 세계 앱이 깨지니까요. 내부 구현일 뿐인데 사실상 공개 API 가 돼버린 겁니다.',
        },
      ],
    },

    {
      heading: '2. 그래서 Strict API 가 뭔데',
      question: '두 가지를 바꿨습니다',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            '**① 타입을 소스에서 생성**하고, **② 공개 진입점에서 내보낸 것만 타입을 제공**합니다.\n' +
            '뒷문을 잠근 것입니다.',
        },
        {
          kind: 'prose',
          text:
            '④의 Codegen 을 **RN 이 자기 자신에게 적용**한 결과입니다. ' +
            '남의 신발은 만들어주면서 자기는 맨발로 다니던 걸 고친 셈이죠.\n\n' +
            '타입을 사람이 안 적으니 **구현과 어긋날 수가 없습니다.**',
        },
        {
          kind: 'compare',
          leftLabel: '버전',
          rightLabel: '상태',
          rows: [
            { label: '0.80', left: 'opt-in 으로 등장', right: '켜야 적용' },
            { label: '0.86 (이 앱)', left: '여전히 opt-in', right: '미리 켜볼 수 있음' },
            { label: '0.87', left: '기본값', right: 'opt-out 은 임시' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '런타임 영향은 0',
          text:
            '순수하게 TypeScript 타입 해석 단계 이야기입니다. ' +
            '번들도, 동작도 그대로입니다. 그래서 미리 켜봐도 위험이 없습니다.',
        },
      ],
    },

    {
      heading: '3. 이 앱에서 실제로 켜봤습니다',
      question: '무엇이 깨졌나',
      blocks: [
        {
          kind: 'prose',
          text:
            '0.86 은 아직 opt-in 이라 `tsconfig.json` 에 조건 하나만 넣으면 켜집니다. ' +
            '`moduleResolution` 이 `bundler` 여야 하는데, Expo 기본 설정이 이미 그렇습니다.',
        },
        {
          kind: 'code',
          path: 'tsconfig.json',
          code:
            '{\n' +
            '  "extends": "expo/tsconfig.base",\n' +
            '  "compilerOptions": {\n' +
            '    "strict": true,\n' +
            '    "customConditions": [\n' +
            '      "react-native-strict-api",\n' +
            '      "react-native"\n' +
            '    ]\n' +
            '  }\n' +
            '}',
          highlight: [4, 5, 6, 7],
          caption:
            'react-native 의 package.json 에서 이 조건이 types_generated/index.d.ts 로 연결됩니다.',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '결과 — 에러 딱 1개',
          text:
            '프로젝트 전체에서 **에러가 하나** 나왔습니다. ' +
            '예상보다 훨씬 적었는데, 이유가 있습니다 — **②에서 이미 딥 임포트를 고쳐뒀기 때문**입니다.\n\n' +
            '보통 마이그레이션 비용의 대부분이 딥 임포트입니다. 그걸 먼저 치우면 남는 게 별로 없습니다.',
        },
        {
          kind: 'code',
          path: '실제 에러',
          code:
            '02-fabric.tsx(148,9): error TS2322:\n' +
            "  Type 'RefObject<(props: ...) => ...>'\n" +
            '  is not assignable to type\n' +
            "  'Ref<ReactNativeElement> | undefined'",
          highlight: [3],
        },
        {
          kind: 'prose',
          text:
            '원인은 이 한 줄이었습니다. `View` 는 **컴포넌트** 타입인데, ' +
            'ref 에 담기는 건 **인스턴스**입니다. 예전 타입은 이 둘을 뭉뚱그렸고, ' +
            'Strict API 는 구분합니다.',
        },
        {
          kind: 'code',
          code:
            '// ❌ View 는 컴포넌트다\n' +
            'const boxRef = useRef<View | null>(null)\n' +
            '\n' +
            '// ✅ ref 에 담기는 건 인스턴스다\n' +
            'const boxRef = useRef<ComponentRef<typeof View> | null>(null)',
          highlight: [4],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '문서와 다른 점',
          text:
            '공식 문서는 `ViewInstance` · `TextInputInstance` 를 쓰라고 합니다. ' +
            '그런데 **0.86 의 생성 타입에는 아직 그 이름이 없습니다**(0.87 부터). ' +
            '그래서 여기서는 React 표준인 `ComponentRef<typeof View>` 를 썼습니다. ' +
            '이름에 의존하지 않아 버전이 올라가도 안 깨집니다.',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '덤 — 코드가 더 깨끗해졌다',
          text:
            '고치고 나니 **캐스팅이 하나 사라졌습니다.** 예전엔 `getBoundingClientRect` 가 ' +
            '타입에 없어서 `as unknown as {...}` 로 우회했는데, Strict API 에서는 ' +
            '제대로 타입돼 있어서 그냥 부르면 됩니다.',
        },
        {
          kind: 'code',
          code:
            '// 전 — 타입에 없어서 우회\n' +
            'const node = boxRef.current as unknown as {\n' +
            '  getBoundingClientRect?: () => {...}\n' +
            '} | null\n' +
            'const rect = node?.getBoundingClientRect?.()\n' +
            '\n' +
            '// 후\n' +
            'const rect = boxRef.current?.getBoundingClientRect()',
          highlight: [7],
        },
      ],
    },

    {
      heading: '4. 0.87 로 올릴 때 깨지는 것들',
      question: '미리 알아두면 좋은 목록',
      blocks: [
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: '딥 임포트 전면 차단',
              side: 'js',
              text: '가장 많이 터집니다. 마이그레이션 비용의 대부분입니다.',
              code:
                "// ❌\nimport x from 'react-native/Libraries/Utilities/x'\n" +
                "\n// ✅\nimport { x } from 'react-native'",
              highlight: [4],
            },
            {
              title: 'ref 타입이 인스턴스로',
              side: 'js',
              text: '이 앱에서 유일하게 걸린 항목입니다.',
              code:
                'useRef<View>(null)\n→ useRef<ComponentRef<typeof View>>(null)',
            },
            {
              title: 'CodegenTypes 가 네임스페이스로',
              side: 'js',
              text: '②에서 이미 이 형태로 바꿔뒀습니다.',
              code:
                "import { CodegenTypes } from 'react-native'\n" +
                'type P = { size?: CodegenTypes.Int32 }',
            },
            {
              title: 'InitializeCore 경로 이동',
              side: 'js',
              code:
                "import 'react-native/Libraries/Core/InitializeCore'\n" +
                "→ import 'react-native/setup-env'",
              text: '테스트 셋업이나 커스텀 엔트리포인트에서 걸립니다.',
            },
            {
              title: '*Static 타입 제거',
              side: 'js',
              text:
                '`AlertStatic`, `UIManagerStatic`, `PlatformStatic` 등. ' +
                '값과 타입 이름을 굳이 나눠뒀던 게 정리됐습니다.',
              code: 'LinkingStatic → Linking',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '급하면 잠깐 끌 수 있지만',
          text:
            '0.87 에서 예전 타입으로 되돌리는 옵션이 있습니다. ' +
            '다만 문서에 **"임시이며 향후 제거된다"** 고 명시돼 있습니다. 시간을 버는 용도지 해결책이 아닙니다.',
        },
      ],
    },

    {
      heading: '5. 직접 확인',
      question: 'ref 에 담기는 게 정말 컴포넌트가 아닌가',
      blocks: [
        {
          kind: 'demo',
          title: 'ref 안을 까보기',
          text:
            '타입 이야기만으로는 와닿지 않으니, **실제로 무엇이 담기는지** 런타임에 봅니다.',
          render: () => <RefShapeDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '실제 클래스가 **`ReactNativeElement`** 로 찍힙니다. 아까 컴파일 에러에 나왔던 ' +
            '바로 그 이름입니다.\n\n' +
            '그리고 대비가 선명합니다 — `getBoundingClientRect`, `nodeName`, `parentElement`, ' +
            '`ownerDocument` 같은 **DOM 쪽은 전부 있고**, `props` · `state` · `render` 같은 ' +
            '**컴포넌트 쪽은 전부 없습니다.**\n\n' +
            'RN 0.82 부터 ref 가 DOM 유사 노드를 돌려주기 때문입니다. ' +
            '`View` 와는 완전히 다른 물건이니 타입 이름도 달라야 하는 게 당연합니다.',
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
            '“Strict API 가 없으면 뭐가 불가능한가?” → **RN 이 내부를 리팩터링하는 것.**\n\n' +
            '뒷문이 잠겨야 집주인이 집을 고칠 수 있습니다. 장기적으로 업그레이드가 ' +
            '덜 아파지는 근거가 이겁니다.',
        },
        {
          kind: 'prose',
          text:
            '**이 앱은 지금 Strict API 가 켜진 상태입니다.** 0.87 로 올려도 타입 때문에 ' +
            '깨질 일이 없습니다.\n\n' +
            '이번 편에서 얻은 실무 교훈이 하나 있다면 — **딥 임포트를 평소에 안 쓰면 ' +
            '이 마이그레이션은 거의 공짜**라는 것입니다. 프로젝트 전체에서 에러가 하나 나왔고, ' +
            '고치고 나니 캐스팅이 오히려 하나 줄었습니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **⑥ Hermes** 입니다. 여기까지 다섯 편은 "JS 와 네이티브를 어떻게 잇느냐" ' +
            '였는데, 이제 **그 JS 를 대체 뭐가 실행하느냐**로 한 층 내려갑니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 12 },
  box: {
    height: 56,
    borderRadius: 6,
    backgroundColor: C.jsSoft,
    borderWidth: 1,
    borderColor: C.js,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { fontSize: 13, color: C.js, fontWeight: '600' },

  result: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 7,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  k: { fontSize: 12.5, color: C.ink3 },
  v: { fontFamily: MONO, fontSize: 12.5, fontWeight: '700', color: C.ink, flexShrink: 1 },
  sub: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.5,
    color: C.ink3,
    marginTop: 3,
  },
  list: { fontFamily: MONO, fontSize: 11, lineHeight: 18, color: C.ink },
  note: { fontSize: 12.5, lineHeight: 19, color: C.ink2, marginTop: 4 },
})
