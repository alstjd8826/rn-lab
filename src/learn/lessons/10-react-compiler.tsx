import { useCallback, useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

// 자식이 실제로 다시 커밋됐는지 센다.
// 렌더 중이 아니라 useEffect 안에서 세므로 React 규칙을 어기지 않는다.
const commits: Record<string, number> = { A: 0, B: 0 }

function Child({ label }: { label: string }) {
  useEffect(() => {
    commits[label] += 1
  })
  return (
    <View style={[d.child, label === 'A' ? d.childA : d.childB]}>
      <Text style={d.childText}>{label} 자식</Text>
    </View>
  )
}

// 컴파일러가 최적화하는 쪽.
// tick 이 바뀌어도 <Child label="A" /> 는 입력이 그대로라 메모이제이션된다.
function ParentCompiled({ tick }: { tick: number }) {
  return (
    <View style={d.panel}>
      <Text style={d.panelTitle}>A · 컴파일러 적용</Text>
      <Text style={d.panelTick}>부모 렌더 {tick}회</Text>
      <Child label="A" />
    </View>
  )
}

// 같은 구조인데 컴파일러를 명시적으로 끈 쪽.
// 실제 현장에서는 규칙 위반으로 "조용히" 이 상태가 된다.
function ParentNoMemo({ tick }: { tick: number }) {
  'use no memo'
  return (
    <View style={d.panel}>
      <Text style={d.panelTitle}>B · 컴파일러 제외</Text>
      <Text style={d.panelTick}>부모 렌더 {tick}회</Text>
      <Child label="B" />
    </View>
  )
}

function CompilerDemo() {
  const [tick, setTick] = useState(0)
  const [shown, setShown] = useState<{ a: number; b: number } | null>(null)

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const read = useCallback(() => setShown({ a: commits.A, b: commits.B }), [])
  const reset = useCallback(() => {
    commits.A = 0
    commits.B = 0
    setShown(null)
    setTick(0)
  }, [])

  return (
    <View style={d.wrap}>
      <Text style={d.hint}>
        두 패널은 구조가 똑같습니다. 차이는 B 에만 컴파일러 제외 지시문이 있다는
        것뿐입니다. 부모를 여러 번 리렌더시킨 뒤 **자식이 몇 번 커밋됐는지** 봅니다.
      </Text>

      <View style={d.panels}>
        <ParentCompiled tick={tick} />
        <ParentNoMemo tick={tick} />
      </View>

      <View style={d.btnRow}>
        <View style={d.btn}>
          <Button title="부모 리렌더" onPress={bump} />
        </View>
        <View style={d.btn}>
          <Button title="결과 보기" onPress={read} />
        </View>
      </View>
      <Button title="초기화" color={C.ink3} onPress={reset} />

      {shown ? (
        <View style={d.result}>
          <View style={d.kv}>
            <Text style={d.k}>A 자식 커밋</Text>
            <Text style={[d.v, { color: C.js }]}>{shown.a}회</Text>
          </View>
          <View style={d.kv}>
            <Text style={d.k}>B 자식 커밋</Text>
            <Text style={[d.v, { color: C.native }]}>{shown.b}회</Text>
          </View>
          <Text style={d.note}>
            {shown.b > shown.a
              ? `부모는 둘 다 ${tick + 1}번 렌더됐는데 A 자식은 ${shown.a}번만 커밋됐습니다. 컴파일러가 <Child label="A" /> 를 메모이제이션했기 때문입니다.`
              : '아직 차이가 없습니다. 부모 리렌더를 몇 번 더 눌러보세요.'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson10: Lesson = {
  no: '⑩',
  slug: 'react-compiler',
  title: 'React Compiler',
  summary: 'useMemo 를 컴파일러가 대신 발라준다 — 조용히 실패하는 함정까지',

  sources: [
    '이 앱 실측 — healthcheck 26/26, 부모 6회 렌더 시 A 자식 1회 / B 자식 6회 커밋',
    '이 앱 실측 — 컴파일러 ON 시 ⑨ 화면에서 Reanimated 경고 대량 발생,',
    '  OFF 하면 0개, 해당 컴포넌트만 use no memo 로 제외해도 0개',
    'app.json experiments.reactCompiler + babel-plugin-react-compiler 1.0.0',
    "※ 'use no memo' 로 대조군을 만든 것은 규칙 위반 상황을 확실히 재현하기 위한 장치",
    '※ 캐시 슬롯 코드는 개념 설명용이며 실제 생성 코드를 덤프해 확인한 것은 아님',
  ],

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: '의존성 배열을 언제까지 손으로 적어야 하나',
      blocks: [
        {
          kind: 'prose',
          text:
            'React 는 상태가 바뀌면 컴포넌트 함수를 **다시 실행**합니다. ' +
            '그 안의 모든 게 새로 만들어집니다.',
        },
        {
          kind: 'code',
          code:
            'function OrderList({ orders, onSelect }) {\n' +
            "  const active = orders.filter(o => o.status === 'ACTIVE')  // 매번 새 배열\n" +
            '  const onClick = (id) => onSelect(id)                      // 매번 새 함수\n' +
            '  return <List data={active} onItemPress={onClick} />\n' +
            '}',
          highlight: [1, 2],
        },
        {
          kind: 'prose',
          text:
            '`orders` 가 안 바뀌었어도 `active` 는 매번 새 배열입니다. 참조가 다르니 ' +
            '`List` 가 `React.memo` 로 감싸져 있어도 소용없습니다.\n\n' +
            '그래서 `useMemo` · `useCallback` 을 발랐고, 로직 두 줄에 껍데기가 여섯 줄이 됐습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '손으로 하면 틀리기 쉽습니다',
          text:
            '· 의존성을 빼먹으면 → **낡은 값을 계속 씁니다.** 재현이 잘 안 되는 버그\n' +
            '· 과하게 넣으면 → 매번 무효화. **비용만 내고 이득은 없음**\n' +
            '· 부모가 콜백을 매번 새로 만들면 → 자식의 `useCallback` 이 무의미해져 ' +
            '**조상까지 줄줄이** 발라야 함',
        },
      ],
    },

    {
      heading: '2. 그래서 React Compiler 가 뭔데',
      question: '한 줄로',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'React Compiler 는 **빌드 타임에 컴포넌트를 분석해서 메모이제이션 코드를 ' +
            '자동으로 삽입하는 바벨 플러그인**입니다.',
        },
        {
          kind: 'prose',
          text:
            '여러분이 쓰는 건 껍데기 없는 원래 코드입니다. 컴파일러가 만들어내는 건 ' +
            '개념적으로 이런 모양이고요.',
        },
        {
          kind: 'code',
          code:
            'const $ = _c(4);              // 캐시 슬롯 4개\n' +
            '\n' +
            'let active;\n' +
            'if ($[0] !== orders) {        // orders 가 바뀌었을 때만\n' +
            '  active = orders.filter(...)\n' +
            '  $[0] = orders; $[1] = active;\n' +
            '} else {\n' +
            '  active = $[1];              // 아니면 캐시 재사용\n' +
            '}',
          highlight: [3, 7],
          caption:
            'useMemo 를 쓰는 게 아니라 캐시 슬롯을 직접 잡습니다. 훅 오버헤드도 없고 필요한 만큼만 잡습니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '**의존성 배열을 사람이 안 적습니다.** 컴파일러가 코드를 읽어서 추론합니다. ' +
            '빼먹을 수가 없습니다.',
        },
      ],
    },

    {
      heading: '3. 여기가 진짜 함정입니다',
      question: '규칙을 어기면 어떻게 되나',
      blocks: [
        {
          kind: 'prose',
          text:
            '컴파일러가 이런 변환을 하려면 컴포넌트가 **예측 가능해야** 합니다. ' +
            '"같은 입력이면 같은 출력" 이 보장돼야 캐싱이 안전하니까요.\n\n' +
            '그래서 **React 규칙을 지킨 코드에만** 동작합니다. 렌더 중 props 변형, ' +
            '렌더 중 ref 읽기·쓰기, 렌더 중 부수효과, 조건부 훅 — 전부 원래도 하면 안 되는 것들입니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '규칙을 어긴 컴포넌트를 만나면',
          text:
            '컴파일러는 **"안전한지 확신 못 하겠는데" 하고 그냥 건너뜁니다.**\n\n' +
            '**에러가 안 납니다. 경고도 없습니다. 빌드는 성공합니다.** ' +
            '그 컴포넌트만 최적화가 안 될 뿐입니다.',
        },
        {
          kind: 'prose',
          text:
            '그래서 켜놓고 "적용됐겠지" 하면 실제로는 절반이 스킵되고 있을 수 있습니다. ' +
            '확인하는 방법이 세 가지입니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: 'ESLint 로 규칙 위반부터 잡는다',
              side: 'js',
              text:
                '순서상 이게 첫 번째입니다. 위반을 정적으로 잡아줍니다.',
            },
            {
              title: 'healthcheck 로 커버리지를 본다',
              side: 'gen',
              text:
                '코드베이스 전체가 얼마나 컴파일 가능한지 리포트를 뽑습니다. ' +
                '**이 앱에서 실제로 돌린 결과**입니다.',
              code:
                '$ npx react-compiler-healthcheck\n' +
                '\n' +
                'Successfully compiled 26 out of 26 components.\n' +
                'StrictMode usage not found.\n' +
                'Found no usage of incompatible libraries.',
              highlight: [2],
            },
            {
              title: 'DevTools 배지로 실제 적용을 확인한다',
              side: 'js',
              text:
                '컴파일러가 최적화한 컴포넌트에 배지가 붙습니다. 눈으로 확인하는 가장 확실한 방법입니다.',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '26개 중 26개. 커버리지가 낮으면 켜봐야 의미가 없으니 ' +
            '**규칙 정리를 먼저** 해야 합니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '★ 그런데 healthcheck 통과가 안전을 뜻하진 않았습니다',
          text:
            '26/26 을 받고 켰는데, **⑨ 성능 계측 화면에서 경고가 쏟아졌습니다.**',
        },
        {
          kind: 'code',
          code:
            'WARN [Reanimated] Reading from `value` during\n' +
            'component render. Please ensure that you don\'t\n' +
            'access the `value` property ... while React is\n' +
            'rendering a component.',
          highlight: [0, 1],
        },
        {
          kind: 'prose',
          text:
            '이상한 건 **그 컴포넌트에 렌더 중 `.value` 를 읽는 코드가 없다**는 점이었습니다. ' +
            '전부 워클릿·이펙트·콜백 안이었거든요.\n\n' +
            '그래서 원인을 갈라봤습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '조건',
          rightLabel: '경고 수',
          rows: [
            { label: '컴파일러 ON', left: '⑨ 화면 진입', right: '대량 발생' },
            { label: '컴파일러 OFF', left: '같은 화면', right: '0개' },
            { label: '해당 컴포넌트만 제외', left: "'use no memo'", right: '0개' },
          ],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '**컴파일러가 원인이었습니다.** Reanimated 의 shared value 와 궁합 문제로 보입니다.\n\n' +
            '결국 ⑨의 해당 컴포넌트에만 `\'use no memo\'` 를 붙여 제외했습니다. ' +
            '이 교재에서 실제로 쓴 대응이고, 그래서 ⑨ 코드에 그 지시문이 들어 있습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '여기서 얻을 교훈',
          text:
            '**healthcheck 는 "컴파일 가능한가" 만 봅니다.** 켰을 때 런타임에서 라이브러리와 ' +
            '충돌하는지는 알려주지 않습니다.\n\n' +
            '그러니 순서에 한 단계가 더 붙습니다 — ESLint → healthcheck → **켜고 실제로 돌려보기** ' +
            '→ DevTools 배지. 특히 Reanimated 처럼 렌더 규칙에 민감한 라이브러리를 쓰면 ' +
            '화면을 하나씩 열어보는 게 낫습니다.',
        },
      ],
    },

    {
      heading: '4. 직접 확인',
      question: '스킵되면 실제로 뭐가 달라지나',
      blocks: [
        {
          kind: 'prose',
          text:
            '구조가 똑같은 패널 두 개를 놓고, **B 에만 컴파일러 제외 지시문**을 넣었습니다. ' +
            '현장에서는 규칙 위반으로 "조용히" 이 상태가 되는데, 재현을 확실히 하려고 ' +
            '명시적으로 껐습니다.',
        },
        {
          kind: 'demo',
          title: '컴파일 된 쪽 vs 안 된 쪽',
          render: () => <CompilerDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '실측값입니다 — 부모를 6번 렌더시켰을 때 **A 자식 1회 / B 자식 6회** 커밋됐습니다. ' +
            '구조가 같은데 지시문 하나로 갈립니다.\n\n' +
            'A 쪽은 컴파일러가 `<Child label="A" />` 라는 JSX 를 메모이제이션해서 ' +
            '같은 엘리먼트를 재사용하기 때문입니다. 커밋 횟수는 렌더 중이 아니라 ' +
            '`useEffect` 안에서 셌습니다 — 세는 행위 자체가 규칙을 어기면 안 되니까요.',
        },
      ],
    },

    {
      heading: '5. 오해하면 안 되는 것',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: '컴파일러는 리렌더 비용만 줄입니다',
          text:
            '· 1만 개짜리 리스트를 통째로 렌더 → **해결 안 됨** (가상화가 답)\n' +
            '· 이미지가 4K 원본이라 디코딩이 느림 → **해결 안 됨**\n' +
            '· 네트워크 요청을 순차로 6번 → **해결 안 됨**\n' +
            '· **UI 스레드 문제 → 전혀 관련 없음**',
        },
        {
          kind: 'prose',
          text:
            '마지막 항목이 ⑨와 이어집니다. **JS FPS 문제 중 "과도한 리렌더" 에만** ' +
            '듣는 약입니다. UI FPS 가 낮으면 켜도 숫자가 1도 안 움직입니다.\n\n' +
            '그래서 순서가 또 그것입니다 — **재보고 켜세요.**',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '기존 useMemo 는 안 지워도 됩니다',
          text:
            '컴파일러와 공존합니다. 급하게 걷어낼 필요 없이 천천히 정리하면 됩니다.',
        },
      ],
    },

    {
      heading: '6. 정리 — 그리고 열 편을 마치며',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '“React Compiler 가 없으면 뭐가 불가능한가?” → **의존성 배열을 사람이 안 적는 것.**\n\n' +
            '대신 조건이 붙습니다 — 규칙을 지킨 코드여야 하고, **조용히 스킵되니 확인해야** 합니다.',
        },
        {
          kind: 'prose',
          text:
            '열 편이 끝났습니다. 전체를 한 줄로 줄이면 이렇습니다.\n\n' +
            '**JSI 가 통로를 뚫었고, 그 위에 Fabric(화면)·TurboModules(기능)이 섰고, ' +
            'Codegen 이 셋의 계약을 번역하고, Strict API 가 그 계약을 RN 자신에게도 적용했다. ' +
            'Hermes 는 그 아래 땅이고, Expo 는 이 전부를 굴리는 도구다.**\n\n' +
            'Nitro·성능 계측·React Compiler 는 그 위에서 고르는 선택지들이고요.',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '실습하며 반복해서 확인된 것',
          text:
            '**재보지 않으면 모른다.**\n\n' +
            '· ② 조상 수를 세니 A·B 가 같았다 → 자손 수를 세야 했다\n' +
            '· ⑥ `Static Hermes: true` 만 보면 오해한다 → 번들 매직 바이트가 진실을 말했다\n' +
            '· ⑧ 개발 빌드에서는 순위가 뒤집혔다 → 릴리즈로 재야 했다\n\n' +
            '세 번 다 처음 세운 가정이 틀렸고, 실측이 바로잡았습니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 11 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },

  panels: { flexDirection: 'row', gap: 9 },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 10,
    gap: 5,
    backgroundColor: C.bg,
  },
  panelTitle: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  panelTick: { fontFamily: MONO, fontSize: 10.5, color: C.ink3 },
  child: { height: 30, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  childA: { backgroundColor: C.jsSoft },
  childB: { backgroundColor: C.nativeSoft },
  childText: { fontFamily: MONO, fontSize: 10.5, color: C.ink2 },

  btnRow: { flexDirection: 'row', gap: 9 },
  btn: { flex: 1 },

  result: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 6,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { fontSize: 12.5, color: C.ink3 },
  v: { fontFamily: MONO, fontSize: 16, fontWeight: '800' },
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
