import { useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { installJsiLab, type JsiLab } from 'react-native-jsi-lab'
import { turboLab } from 'react-native-turbo-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Shot = { label: string; ok: boolean; detail: string }

// 계약이 없는 쪽(raw JSI)과 있는 쪽(Codegen)을 같은 화면에서 때려본다.
function ContractDemo() {
  const [lab, setLab] = useState<JsiLab | null>(null)
  const [shots, setShots] = useState<Shot[]>([])

  const add = (s: Shot) => setShots((prev) => [...prev, s])

  const install = () => {
    try {
      setLab(installJsiLab())
    } catch (e) {
      add({ label: 'HostObject 설치', ok: false, detail: String(e) })
    }
  }

  // ── 계약 없음: 이름을 틀리게 부른다
  const wrongName = () => {
    if (!lab) return
    try {
      // 타입에 없는 이름. TS 를 우회해야 쓸 수 있다는 게 이미 신호다.
      const fn = (lab as unknown as Record<string, unknown>)['bufferAddr']
      const result = (fn as (b: ArrayBuffer) => string)(new ArrayBuffer(8))
      add({ label: "lab.bufferAddr(...) — 오타", ok: true, detail: String(result) })
    } catch (e) {
      add({
        label: "lab.bufferAddr(...) — 오타",
        ok: false,
        detail: (e as Error).message,
      })
    }
  }

  // ── 계약 없음: 타입을 틀리게 부른다
  const wrongType = () => {
    if (!lab) return
    try {
      const bad = lab.add as unknown as (a: string, b: string) => number
      const result = bad('a', 'b')
      add({ label: "lab.add('a','b') — 타입", ok: true, detail: String(result) })
    } catch (e) {
      add({
        label: "lab.add('a','b') — 타입",
        ok: false,
        detail: (e as Error).message,
      })
    }
  }

  // ── 계약 있음: Codegen 거친 모듈
  const codegenCall = () => {
    try {
      const n = turboLab.ping()
      add({ label: 'turboLab.ping() — 정상', ok: true, detail: `${n} 번째` })
    } catch (e) {
      add({ label: 'turboLab.ping()', ok: false, detail: (e as Error).message })
    }
  }

  return (
    <View style={d.wrap}>
      {lab === null ? (
        <>
          <Text style={d.hint}>
            먼저 ① 에서 만든 raw JSI 객체를 설치합니다. 이쪽은 타입을 손으로 적었습니다.
          </Text>
          <Button title="HostObject 설치" onPress={install} />
        </>
      ) : (
        <>
          <View style={d.group}>
            <Text style={d.groupTitle}>계약 없는 쪽 · raw JSI</Text>
            <Text style={d.groupNote}>
              손으로 적은 타입. 검사해주는 사람이 없습니다.
            </Text>
            <View style={d.btnRow}>
              <View style={d.btn}>
                <Button title="이름 오타" color={C.warn} onPress={wrongName} />
              </View>
              <View style={d.btn}>
                <Button title="타입 틀리기" color={C.warn} onPress={wrongType} />
              </View>
            </View>
          </View>

          <View style={d.group}>
            <Text style={d.groupTitle}>계약 있는 쪽 · Codegen</Text>
            <Text style={d.groupNote}>
              스펙에서 생성된 계약. 틀린 호출은 애초에 못 씁니다.
            </Text>
            <Button title="정상 호출" onPress={codegenCall} />
          </View>

          {shots.length > 0 ? (
            <View style={d.log}>
              {shots.map((s, i) => (
                <View key={i} style={d.logRow}>
                  <Text style={[d.badge, s.ok ? d.badgeOk : d.badgeBad]}>
                    {s.ok ? '통과' : '터짐'}
                  </Text>
                  <View style={d.logBody}>
                    <Text style={d.logLabel}>{s.label}</Text>
                    <Text style={d.logDetail}>{s.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}

export const lesson04: Lesson = {
  no: '④',
  slug: 'codegen',
  title: 'Codegen',
  summary: 'TypeScript 한 장에서 C++ · ObjC · Java 계약을 자동 생성',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: '세 언어가 같은 함수를 두고 어떻게 말을 맞추나',
      blocks: [
        {
          kind: 'prose',
          text:
            'React Native 에는 **세 개의 세계**가 있습니다 — JavaScript, C++, ' +
            '그리고 플랫폼 네이티브(Swift · Kotlin). 이 셋이 같은 함수를 두고 ' +
            '각자 다른 언어로 이야기해야 합니다.',
        },
        {
          kind: 'prose',
          text: '예전엔 이 약속을 **세 군데에 손으로** 적었습니다.',
        },
        {
          kind: 'code',
          code:
            'JS      add(a: number, b: number): number\n' +
            'iOS     - (NSNumber *)add:(double)a b:(double)b\n' +
            'Android public double add(double a, double b)',
          caption:
            '셋이 항상 일치한다는 보장이 아무 데도 없습니다. 하나만 고치면 나머지 둘은 모릅니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '어디서 터지나',
          text:
            '**유저 폰에서** 터집니다. 이름이 틀리면 `undefined is not a function`, ' +
            '타입이 틀리면 이상한 값이 넘어가거나 크래시입니다. ' +
            '빌드는 멀쩡히 성공하니 미리 알 방법이 없습니다.',
        },
      ],
    },

    {
      heading: '2. 그래서 Codegen 이 뭔데',
      question: '한 줄로',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'Codegen 은 **TypeScript 스펙 하나를 읽어서 C++ · ObjC · Java 계약 코드를 ' +
            '빌드 타임에 뽑아내는 코드 생성기**입니다.',
        },
        {
          kind: 'prose',
          text:
            '중요한 건 **빌드 타임**이라는 점입니다. 앱이 실행될 때 뭘 생성하는 게 아니라, ' +
            '컴파일 전에 소스 파일을 뱉어놓습니다.\n\n' +
            '그래서 스펙을 고치고 JS 만 리로드하면 반영이 안 됩니다. ' +
            '**네이티브를 다시 빌드해야** 합니다. 이거 모르고 한참 헤매기 쉽습니다.',
        },
        {
          kind: 'prose',
          text: '실행 시점은 이렇습니다.',
        },
        {
          kind: 'compare',
          leftLabel: '플랫폼',
          rightLabel: '언제 도나',
          rows: [
            { label: 'iOS', left: 'pod install', right: '+ 빌드 페이즈' },
            { label: 'Android', left: 'Gradle 태스크', right: '빌드 그래프에 포함' },
          ],
        },
        {
          kind: 'prose',
          text:
            '그리고 한 방에 코드를 뽑는 게 아니라 **중간에 한 번 끊습니다.** ' +
            '이 구조가 나중에 플랫폼을 늘릴 때 값을 합니다.',
        },
        {
          kind: 'code',
          code:
            'NativeTurboLab.ts   (TypeScript 스펙)\n' +
            '        ↓  ① Parser\n' +
            '   schema (언어 중립 중간 표현)\n' +
            '        ↓  ② Generator × 플랫폼 수\n' +
            '   C++ / ObjC / Java 계약 코드',
          caption:
            '새 플랫폼을 지원하려면 Generator 만 하나 더 만들면 됩니다. Parser 와 스펙은 그대로입니다.',
        },
      ],
    },

    {
      heading: '3. 규칙과 제약',
      question: '왜 내 스펙을 못 알아보나',
      blocks: [
        {
          kind: 'prose',
          text:
            'Codegen 은 TypeScript 를 **전부** 이해하는 게 아니라 **일부만** 이해합니다. ' +
            '세 언어로 다 번역돼야 하니 당연한 제약입니다.',
        },
        {
          kind: 'code',
          code:
            '// 되는 것\n' +
            'boolean · number · string\n' +
            'CodegenTypes.Int32 / Float / Double\n' +
            'Array<T> · { foo: string } · \'a\' | \'b\'\n' +
            'Promise<T> · T | null\n' +
            '\n' +
            '// 안 되는 것\n' +
            'any · unknown · Record<string, T>\n' +
            'A & B · Map · Set · Date · 제네릭 함수',
          highlight: [6, 7, 8],
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '`any` 를 못 쓰는 건 버그가 아니라 **설계**입니다. 타입 계약을 강제하려고 ' +
            '만든 물건인데 구멍을 하나 뚫어주면 다들 그리로 갑니다.',
        },
        {
          kind: 'prose',
          text:
            '파일 이름 규칙도 있습니다. 안 지키면 **Codegen 이 그냥 못 본 척합니다.** ' +
            '“스펙 다 썼는데 아무것도 생성이 안 돼요” 의 대부분이 이것입니다.',
        },
        {
          kind: 'compare',
          leftLabel: '종류',
          rightLabel: '파일명 규칙',
          rows: [
            { label: '모듈', left: 'TurboModule', right: 'Native*.ts' },
            { label: '뷰', left: 'Fabric 컴포넌트', right: '*NativeComponent.ts' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '②에서 겪은 것',
          text:
            'Fabric 컴포넌트 스펙은 props 가 `ViewProps` 를 **직접** 상속해야 합니다. ' +
            '한 단계 더 상속했다가 `Failed to find definition for "ViewProps"` 로 실패했습니다. ' +
            'Codegen 은 상속을 한 단계만 따라갑니다.',
        },
      ],
    },

    {
      heading: '4. 무엇이 생성되나',
      question: '이 앱에 실제로 만들어진 것들',
      blocks: [
        {
          kind: 'prose',
          text:
            '이 앱에는 모듈 스펙 두 개(①③)와 뷰 스펙 하나(②)가 있습니다. ' +
            '**뷰가 훨씬 많이 생성됩니다** — 렌더링에 관여하니 필요한 조각이 많습니다.',
        },
        {
          kind: 'code',
          path: '모듈 (③ TurboLabSpecs)',
          code:
            'TurboLabSpecsJSI.h        JS 호출 → C++ 함수 연결\n' +
            'TurboLabSpecs.h / .mm     iOS 계약',
        },
        {
          kind: 'code',
          path: '뷰 (② FabricLabSpecs)',
          code:
            'ComponentDescriptors.h    Fabric 이 인식하는 진입점\n' +
            'Props.h / .cpp            props 를 담는 C++ 구조체\n' +
            'ShadowNodes.h / .cpp      섀도우 트리 노드\n' +
            'EventEmitters.h / .cpp    onProbe 를 쏘는 코드\n' +
            'States.h / .cpp           뷰 상태\n' +
            'RCTComponentViewHelpers.h iOS 가 지킬 계약',
        },
        {
          kind: 'prose',
          text:
            '생성된 코드의 핵심은 **디스패치**입니다. JSI 로 들어온 값을 네이티브 타입으로 ' +
            '까서 구현에 넘깁니다. 여기 **JSON 이 없다**는 게 ① 에서 본 “직렬화 제거” 의 실체입니다.',
        },
        {
          kind: 'code',
          path: '생성물 · TurboLabSpecsJSI.h',
          code:
            'methodMap_["ping"] = MethodMetadata {\n' +
            '  .argCount = 0, .invoker = __ping };\n' +
            '\n' +
            'static_assert(\n' +
            '  bridging::getParameterCount(&T::ping) == 1,\n' +
            '  "Expected ping(...) to have 1 parameters");',
          highlight: [3, 4, 5],
          caption:
            'JS 는 인자 0개, C++ 은 1개. 그 차이가 jsi::Runtime& 이고 컴파일 타임에 강제됩니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '생성물은 커밋하지 않는다',
          text:
            '빌드 산출물입니다. 커밋해두면 스펙과 어긋난 채로 굳어서 더 골치 아파집니다. ' +
            '이 앱에서는 `ios/` 전체가 `.gitignore` 에 있습니다.',
        },
      ],
    },

    {
      heading: '5. 계약을 어기면 — 실제 에러',
      question: '정말 빌드가 막히나',
      blocks: [
        {
          kind: 'prose',
          text:
            '이 레슨을 만들면서 **일부러 두 가지를 어겨봤습니다.** ' +
            '아래는 실제로 나온 에러 메시지입니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: 'C++ 에서 jsi::Runtime& 파라미터를 빼봤다',
              side: 'native',
              text:
                '스펙은 그대로 두고 C++ 만 `double ping()` 으로 바꿨습니다. ' +
                '`static_assert` 가 정확히 이걸 잡습니다.',
              code:
                'TurboLabSpecsJSI.h:48:7: error: static assertion failed\n' +
                "due to requirement 'bridging::getParameterCount(\n" +
                "  &NativeTurboLab::ping) == 1':\n" +
                'Expected ping(...) to have 1 parameters',
              highlight: [3],
            },
            {
              title: '스펙에만 메서드를 추가하고 구현을 안 했다',
              side: 'js',
              text:
                '스펙에 `reset: () => void` 를 넣고 C++ 구현은 안 만들었습니다. ' +
                '실무에서 제일 흔한 실수입니다.',
              code:
                'TurboLabSpecsJSI.h:63:39: error: no member named\n' +
                "'reset' in 'facebook::react::NativeTurboLab'",
              highlight: [1],
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '두 경우 다 **유저 폰이 아니라 제 맥에서** 터졌습니다. ' +
            '이게 Codegen 이 하는 일의 전부입니다 — 런타임 폭발을 빌드 에러로 앞당기는 것.',
        },
      ],
    },

    {
      heading: '6. 직접 확인',
      question: '계약이 없으면 어떻게 되나',
      blocks: [
        {
          kind: 'prose',
          text:
            '빌드 에러는 앱에서 재현할 수 없습니다. 대신 **계약이 없는 쪽**을 때려봅니다.\n\n' +
            '①에서 만든 `global.__jsiLab` 은 Codegen 을 안 거쳤고 타입을 손으로 적었습니다. ' +
            '그래서 검사해주는 사람이 없습니다.',
        },
        {
          kind: 'demo',
          title: '계약 있는 쪽 vs 없는 쪽',
          text:
            '**주의**: 왼쪽 두 버튼은 TypeScript 를 강제로 우회해서 호출합니다. ' +
            '캐스팅을 해야 쓸 수 있다는 것 자체가 이미 신호입니다.',
          render: () => <ContractDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '“이름 오타” 는 `undefined is not a function` 계열로 터집니다. ' +
            '“타입 틀리기” 는 C++ 이 인자를 검사해서 던진 에러가 JS 의 `catch` 로 잡힙니다 — ' +
            '①에서 본 `jsi::JSError` 가 언어 경계를 넘는 그것입니다.\n\n' +
            '다만 **이 검사는 제가 손으로 넣은 것**입니다. Codegen 쪽은 안 넣어도 됩니다.',
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
            '“Codegen 이 없으면 뭐가 불가능한가?” → **타입 불일치를 빌드 타임에 잡는 것.**\n\n' +
            '그리고 JSI 디스패치 코드를 손으로 안 쓰는 것.',
        },
        {
          kind: 'prose',
          text:
            '2026 년의 변화가 하나 있습니다. Codegen 이 이제 **RN 자체의 public TypeScript ' +
            '타입까지 생성**합니다.\n\n' +
            '원래 RN 타입은 손으로 관리됐습니다. 남의 신발은 만들어주면서 자기는 맨발로 ' +
            '다닌 셈이었죠. 그걸 자기 자신에게 적용한 결과가 다음 편입니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **⑤ Strict TypeScript API** 입니다. 지금 RN 0.86 은 opt-in 상태라, ' +
            '켜서 뭐가 깨지는지 미리 겪어볼 수 있습니다. ' +
            '②에서 이미 딥 임포트 경고를 한 번 만났던 그 이야기입니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },

  group: {
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 12,
    gap: 6,
    backgroundColor: C.bg,
  },
  groupTitle: { fontSize: 14.5, fontWeight: '800', color: C.ink },
  groupNote: { fontSize: 12.5, lineHeight: 19, color: C.ink3 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },

  log: { gap: 7, paddingTop: 2 },
  logRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  badge: {
    fontFamily: MONO,
    fontSize: 9.5,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  badgeOk: { backgroundColor: C.okSoft, color: C.ok },
  badgeBad: { backgroundColor: C.warnSoft, color: C.warn },
  logBody: { flex: 1, gap: 1 },
  logLabel: { fontFamily: MONO, fontSize: 11.5, color: C.ink },
  logDetail: { fontSize: 12, lineHeight: 18, color: C.ink2 },
})
