import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { installJsiLab, type JsiLab } from 'react-native-jsi-lab'
import { add as nitroAdd } from 'react-native-nitro-lab'
import { turboLab } from 'react-native-turbo-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Row = { name: string; how: string; ns: number; total: number }

const N = 50_000

// 같은 일(add)을 세 방식으로 시켜서 호출당 비용을 잰다.
function BenchDemo() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [running, setRunning] = useState(false)

  const bench = useCallback((fn: (a: number, b: number) => number) => {
    // 워밍업 — 첫 호출의 지연 생성·캐시 효과를 제외한다
    for (let i = 0; i < 2000; i++) fn(i, 1)

    const t0 = performance.now()
    let acc = 0
    for (let i = 0; i < N; i++) acc = fn(acc, 1)
    const ms = performance.now() - t0
    if (acc !== N) throw new Error(`합계 불일치: ${acc}`)
    return { ns: (ms * 1e6) / N, total: ms }
  }, [])

  const run = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      try {
        let lab: JsiLab
        try {
          lab = installJsiLab()
        } catch {
          setRunning(false)
          return
        }

        const out: Row[] = [
          {
            name: 'raw JSI',
            how: 'HostObject · Codegen 없음',
            ...bench((a, b) => lab.add(a, b)),
          },
          {
            name: 'TurboModule',
            how: '순수 C++ · Codegen 디스패치',
            ...bench((a, b) => turboLab.add(a, b)),
          },
          {
            name: 'Nitro',
            how: 'Swift · 정적 컴파일 바인딩',
            ...bench((a, b) => nitroAdd(a, b)),
          },
        ]
        out.sort((x, y) => x.ns - y.ns)
        setRows(out)
      } finally {
        setRunning(false)
      }
    }, 50)
  }, [bench])

  const fastest = rows?.[0]?.ns ?? 1

  return (
    <View style={d.wrap}>
      <Text style={d.hint}>
        `add(a, b)` 를 각 방식으로 {N.toLocaleString()}번씩 부릅니다. 워밍업
        2,000회는 제외합니다.
      </Text>

      <Button
        title={running ? '측정 중…' : '3파전 측정'}
        onPress={run}
        disabled={running}
      />

      {rows ? (
        <View style={d.table}>
          {rows.map((r, i) => (
            <View key={r.name} style={d.row}>
              <View style={d.rank}>
                <Text style={d.rankText}>{i + 1}</Text>
              </View>
              <View style={d.body}>
                <Text style={d.name}>{r.name}</Text>
                <Text style={d.how}>{r.how}</Text>
                <View style={d.bar}>
                  <View
                    style={[
                      d.barFill,
                      {
                        width: `${Math.min(100, (fastest / r.ns) * 100)}%`,
                        backgroundColor: i === 0 ? C.js : C.ink3,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={d.nums}>
                <Text style={[d.ns, i === 0 && { color: C.js }]}>
                  {r.ns.toFixed(0)} ns
                </Text>
                <Text style={d.rel}>×{(r.ns / fastest).toFixed(2)}</Text>
              </View>
            </View>
          ))}
          <Text style={d.note}>
            호출당 나노초입니다. 순서가 매번 같게 나오는지 여러 번 눌러보세요 —
            한 번 재고 결론 내리면 안 됩니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson08: Lesson = {
  no: '⑧',
  slug: 'nitro',
  title: 'Nitro Modules',
  summary: 'ObjC 를 건너뛰고 바인딩을 미리 컴파일해 더 빠르게',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: 'TurboModules 로 충분한 거 아닌가',
      blocks: [
        {
          kind: 'prose',
          text:
            '③ TurboModules 는 이미 브릿지를 없앴습니다. 그런데도 남은 비용이 있습니다. ' +
            'Nitro 를 만든 곳은 **Margelo** — `react-native-vision-camera`, ' +
            '`react-native-mmkv` 를 만든 팀입니다. 고성능 모듈을 실제로 만들어 팔던 ' +
            '사람들이 자기들 불편해서 만든 도구입니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'iOS 에서 Swift 를 쓰면 한 다리 더 건넌다',
          text:
            'C++ 과 Swift 는 원래 직접 대화를 못 했습니다. 그래서 **둘 다 알아듣는 ObjC 를 ' +
            '중간에 세웠습니다.**\n\n' +
            '문제는 이 구간이 공짜가 아니라는 것입니다. ObjC 메시지 디스패치는 런타임에 ' +
            '찾아가는 동적 호출이고, 값도 `NSNumber` 같은 객체로 한 번 감쌌다 풀어야 합니다.',
        },
        {
          kind: 'code',
          code:
            'TurboModules:  JS → C++ → Objective-C → Swift\n' +
            '                            ^^^^^^^^^^^\n' +
            '                            여기가 왜 있냐면...\n' +
            '\n' +
            'Nitro:         JS → C++ → Swift',
          highlight: [4],
        },
        {
          kind: 'prose',
          text:
            '호출 한 번이면 무시할 만합니다. **초당 수천 번이면 얘기가 다릅니다.**',
        },
      ],
    },

    {
      heading: '2. 그래서 Nitro 가 뭔데',
      question: '세 가지를 바꿨습니다',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'Nitro 는 **ObjC 를 건너뛰고, JSI 바인딩을 빌드 타임에 정적 컴파일하는 ' +
            '네이티브 모듈 프레임워크**입니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: 'ObjC 를 아예 건너뛴다',
              side: 'native',
              text:
                'Swift 5.9 부터 **C++ 상호운용**이 정식으로 들어왔습니다. ' +
                'C++ 이 Swift 를 직접 부를 수 있습니다. 중간 다리를 통째로 뺐습니다.',
            },
            {
              title: '바인딩을 빌드 타임에 정적 컴파일',
              side: 'gen',
              text:
                '`nitrogen` 이 스펙을 읽고 바인딩을 미리 다 만들어둡니다. ' +
                '런타임에 구성할 게 없습니다.',
            },
            {
              title: 'HybridObject — 양쪽에 사는 객체',
              side: 'js',
              text:
                'TurboModule 이 기본적으로 **함수 호출 창구** 하나라면, ' +
                'Nitro 의 HybridObject 는 **객체 자체가 양쪽 세계에 존재**합니다. ' +
                '프로퍼티를 갖고, 다른 HybridObject 를 주고받을 수도 있습니다.\n\n' +
                '③에서 "옛날엔 네이티브 객체를 정수 ID 로 흉내냈다" 고 했는데, ' +
                'Nitro 는 그걸 진짜 객체로 만들어줍니다.',
            },
          ],
        },
        {
          kind: 'prose',
          text:
            '이 앱에 이미 Nitro 모듈이 들어있습니다. 구현이 이렇게 짧습니다 — ' +
            '**ObjC 코드가 한 줄도 없고 브리징 헤더도 없습니다.**',
        },
        {
          kind: 'code',
          path: 'modules/react-native-nitro-lab/ios/HybridLab.swift',
          code:
            'class HybridLab: HybridLabSpec {\n' +
            '  func add(a: Double, b: Double) throws -> Double {\n' +
            '    return a + b\n' +
            '  }\n' +
            '}',
        },
      ],
    },

    {
      heading: '3. 직접 재봤습니다',
      question: '같은 일을 세 방식으로',
      blocks: [
        {
          kind: 'prose',
          text:
            '"N배 빠르다" 는 말은 **워크로드를 빼놓으면 무의미**합니다. ' +
            '그래서 이 앱에 있는 세 가지 경로에 **똑같은 `add(a, b)`** 를 시켜서 ' +
            '직접 재봤습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '경로',
          rightLabel: '특징',
          rows: [
            { label: 'raw JSI', left: '① HostObject', right: 'Codegen 없음, 직접 람다' },
            { label: 'TurboModule', left: '③ 순수 C++', right: 'Codegen 디스패치 경유' },
            { label: 'Nitro', left: 'Swift', right: '정적 컴파일 바인딩' },
          ],
        },
        {
          kind: 'demo',
          title: '3파전 · add() 5만 번',
          render: () => <BenchDemo />,
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '★ 개발 빌드에서 재면 순서가 뒤집힙니다',
          text:
            '이 레슨을 만들며 **같은 코드를 개발 빌드와 릴리즈 빌드에서 각각** 재봤습니다. ' +
            '결과가 달랐습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '개발 빌드',
          rightLabel: '릴리즈 빌드',
          rows: [
            { label: 'Nitro', left: '314 ns · 2위', right: '178 ns · 1위' },
            { label: 'TurboModule', left: '263 ns · 1위', right: '206 ns · 2위' },
            { label: 'raw JSI', left: '387 ns · 3위', right: '527 ns · 3위' },
          ],
        },
        {
          kind: 'prose',
          text:
            '**개발 빌드에서는 TurboModule 이 1위였는데 릴리즈에서는 Nitro 가 1위**입니다. ' +
            '최적화가 켜지면서 Nitro 가 가장 크게 이득을 봤습니다(314 → 178).\n\n' +
            '개발 빌드 숫자만 보고 "Nitro 별거 없네" 라고 결론 냈으면 틀렸을 겁니다. ' +
            '⑨에서 다룰 이야기가 여기서 미리 나옵니다 — **릴리즈 빌드로 재지 않으면 잰 게 아닙니다.**',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '그런데 차이가 생각보다 작습니다',
          text:
            '릴리즈에서 Nitro 가 1위지만 TurboModule 대비 **×1.16** 입니다. ' +
            '벤더 자료에서 보이는 수십 배 같은 숫자와는 거리가 멉니다.\n\n' +
            '그런 숫자는 대개 더 극단적인 조건(초당 수만 번, 복잡한 타입 변환)에서 나온 것입니다. ' +
            '`add` 처럼 단순한 호출에서는 이 정도가 현실적인 폭입니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'raw JSI 가 꼴찌인 건 JSI 탓이 아닙니다',
          text:
            '①에서 만든 HostObject 구현이 **순진하기 때문**입니다. ' +
            '`lab.add` 에 접근할 때마다 `get()` 이 불리고, 거기서 문자열을 비교한 뒤 ' +
            '**새 함수 객체를 매번 만듭니다.**\n\n' +
            '실제 라이브러리는 만든 함수를 캐시합니다. 교보재로 단순하게 쓴 대가이고, ' +
            '"JSI 가 느리다" 로 읽으면 안 됩니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '그리고 `add` 는 함수 본체가 사실상 없어서 **호출 오버헤드만** 재는 셈입니다. ' +
            '실제 앱에서 함수 본체가 무거우면 이 차이는 전부 묻힙니다.',
        },
      ],
    },

    {
      heading: '4. 언제 쓰고 언제 안 쓰나',
      blocks: [
        {
          kind: 'compare',
          leftLabel: '상황',
          rightLabel: '차이',
          rows: [
            { label: '고빈도 호출', left: '프레임·오디오·센서', right: '큼 · Nitro 유리' },
            { label: '큰 바이너리', left: 'ArrayBuffer 전달', right: '큼 · 제로카피' },
            { label: '무거운 작업', left: '가끔 호출', right: '거의 없음' },
            { label: '일반 CRUD', left: '설정·저장·조회', right: '의미 없음' },
          ],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '세 번째·네 번째 줄이 중요합니다. **대부분의 모듈은 여기 해당**합니다. ' +
            '측정 안 해봤으면 Nitro 를 꺼낼 이유가 없습니다 — 조기 최적화입니다.',
        },
        {
          kind: 'prose',
          text: '세 방식의 자리를 정리하면 이렇습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '최적화 목표',
          rightLabel: '관리 주체',
          rows: [
            { label: 'Expo Modules', left: '개발 편의', right: 'Expo' },
            { label: 'TurboModules', left: '범용성 · RN 표준', right: 'Meta' },
            { label: 'Nitro', left: '생 성능', right: 'Margelo (서드파티)' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '서드파티라는 것의 무게',
          text:
            'Nitro 는 **RN 표준이 아닙니다.** 생태계가 작고, 막히면 혼자 뚫어야 합니다. ' +
            '무엇보다 **RN 버전 대응을 따라와야** 하는데, 그 타이밍이 밀리면 ' +
            '내 앱의 업그레이드가 막힙니다.\n\n' +
            '성능 핵심부를 서드파티에 맡기는 건 그만큼의 결합을 받아들이는 일입니다.',
        },
      ],
    },

    {
      heading: '5. 정리',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '“Nitro 가 없으면 뭐가 불가능한가?” → **고빈도 호출의 고정 오버헤드를 더 줄이는 것.**\n\n' +
            'TurboModules 가 "모두를 위한 표준" 이라면 Nitro 는 ' +
            '"성능이 목숨인 소수를 위한 특수 장비" 입니다.',
        },
        {
          kind: 'prose',
          text:
            '⑦에서 확인했듯 Expo 프로젝트 안에서도 잘 돕니다. ' +
            '**대부분을 Expo Modules 로 만들고 병목 하나만 Nitro 로 빼는** 조합이 현실적입니다.\n\n' +
            '전부 Nitro 로 만드는 건 출근길에 F1 머신 타는 격입니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **⑨ 성능 계측** 입니다. 이 편에서 "측정이 먼저" 를 여러 번 말했는데, ' +
            '그럼 대체 **뭘 어떻게 재는지**가 다음 주제입니다. ' +
            'JS FPS 와 UI FPS 가 다른 숫자라는 것부터 직접 만들어 봅니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 11 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },

  table: { gap: 11 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  rank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontFamily: MONO, fontSize: 10, fontWeight: '800', color: C.ink2 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  how: { fontSize: 11, color: C.ink3 },
  bar: {
    height: 5,
    backgroundColor: C.surface2,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: { height: 5, borderRadius: 3 },
  nums: { alignItems: 'flex-end', gap: 1, minWidth: 62 },
  ns: { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: C.ink },
  rel: { fontFamily: MONO, fontSize: 10.5, color: C.ink3 },
  note: {
    fontSize: 12,
    lineHeight: 18.5,
    color: C.ink2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
})
