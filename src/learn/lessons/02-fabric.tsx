import { useCallback, useLayoutEffect, useRef, useState, type ComponentRef } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { DepthProbeView } from 'react-native-fabric-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Probe = {
  subtreeCount: number
  depth: number
  width: number
  height: number
  chain: string
}

// ─────────────────────────────────────────────
// 실험 1 · 뷰 플래트닝
//   같은 뷰를 두 가지 트리에 넣고, 네이티브 깊이를 비교한다.
// ─────────────────────────────────────────────
function FlatteningDemo() {
  const [flat, setFlat] = useState<Probe | null>(null)
  const [solid, setSolid] = useState<Probe | null>(null)

  return (
    <View style={d.wrap}>
      <View style={d.trees}>
        {/* A · 껍데기 View 3겹을 프로브 "안"에 넣는다 → 몇 개가 실제 뷰가 되나 */}
        <View style={d.treeCol}>
          <Text style={d.treeLabel}>A · 껍데기 View 3겹</Text>
          <Text style={d.treeCode}>{'padding 만 있음\n배경·테두리 없음'}</Text>
          <DepthProbeView
            label=""
            style={d.probe}
            onProbe={(e) => setFlat(e.nativeEvent)}
          >
            <View style={{ padding: 5 }}>
              <View style={{ padding: 5 }}>
                <View style={{ padding: 5 }}>
                  <View style={d.leaf} />
                </View>
              </View>
            </View>
          </DepthProbeView>
        </View>

        {/* B · 같은 3겹인데 배경색이 있음 → 실제 뷰가 필요 */}
        <View style={d.treeCol}>
          <Text style={d.treeLabel}>B · 배경 있는 View 3겹</Text>
          <Text style={d.treeCode}>{'backgroundColor 있음\n→ 실제 뷰 필요'}</Text>
          <DepthProbeView
            label=""
            style={d.probe}
            onProbe={(e) => setSolid(e.nativeEvent)}
          >
            <View style={{ padding: 5, backgroundColor: '#F3E7DA' }}>
              <View style={{ padding: 5, backgroundColor: '#EBD8C4' }}>
                <View style={{ padding: 5, backgroundColor: '#E2C9AD' }}>
                  <View style={d.leaf} />
                </View>
              </View>
            </View>
          </DepthProbeView>
        </View>
      </View>

      <View style={d.scoreRow}>
        <View style={d.score}>
          <Text style={d.scoreLabel}>A 실제 뷰</Text>
          <Text style={[d.scoreVal, { color: C.js }]}>
            {flat ? flat.subtreeCount : '—'}
          </Text>
        </View>
        <View style={d.score}>
          <Text style={d.scoreLabel}>B 실제 뷰</Text>
          <Text style={[d.scoreVal, { color: C.native }]}>
            {solid ? solid.subtreeCount : '—'}
          </Text>
        </View>
        <View style={d.score}>
          <Text style={d.scoreLabel}>차이</Text>
          <Text style={[d.scoreVal, { color: C.struct }]}>
            {flat && solid ? solid.subtreeCount - flat.subtreeCount : '—'}
          </Text>
        </View>
      </View>

      {flat && solid ? (
        <Text style={d.verdict}>
          {solid.subtreeCount > flat.subtreeCount
            ? `✅ 같은 3겹인데 A 쪽이 ${solid.subtreeCount - flat.subtreeCount}개 적습니다 — 껍데기가 실제 뷰로 안 만들어졌습니다`
            : '두 트리의 실제 뷰 개수가 같습니다'}
        </Text>
      ) : (
        <Text style={d.hint}>두 상자가 화면에 보이면 위 숫자가 채워집니다.</Text>
      )}

      {flat && solid ? (
        <Text style={d.chain}>
          조상 수는 A {flat.depth} · B {solid.depth} 로 같습니다. 조상 수는 실제 뷰
          개수가 아니라 자식을 담는 뷰(스택 컨텍스트) 개수라서 그렇습니다.
        </Text>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// 실험 2 · 동기 측정
//   useLayoutEffect + getBoundingClientRect 는 화면에 그려지기 전에 읽는다.
//   onLayout 은 한 번 그려진 뒤에 온다.
// ─────────────────────────────────────────────
function SyncMeasureDemo() {
  const [round, setRound] = useState(0)
  // Strict API 에서는 ref 에 담기는 게 컴포넌트가 아니라 인스턴스다.
  const boxRef = useRef<ComponentRef<typeof View> | null>(null)
  const [syncSize, setSyncSize] = useState<string | null>(null)
  const [asyncSize, setAsyncSize] = useState<string | null>(null)
  const [syncFirst, setSyncFirst] = useState<boolean | null>(null)
  const orderRef = useRef<string[]>([])

  const width = 120 + (round % 3) * 60

  useLayoutEffect(() => {
    // DOM 유사 API. 커밋 직후 · 화면에 그려지기 전에 동기로 읽힌다.
    // Strict API 를 켜면 getBoundingClientRect 가 제대로 타입되어 캐스팅이 필요 없다.
    const rect = boxRef.current?.getBoundingClientRect()
    if (rect) {
      orderRef.current.push('sync')
      setSyncSize(`${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}`)
    } else {
      setSyncSize('이 런타임에서 미지원')
    }
  }, [round])

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width: w, height: h } = e.nativeEvent.layout
      orderRef.current.push('async')
      setAsyncSize(`${w.toFixed(0)} × ${h.toFixed(0)}`)
      setSyncFirst(orderRef.current[0] === 'sync')
    },
    [],
  )

  return (
    <View style={d.wrap}>
      <View
        ref={boxRef}
        onLayout={onLayout}
        style={[d.measureBox, { width }]}
        collapsable={false}
      >
        <Text style={d.measureBoxText}>width {width}</Text>
      </View>

      <View style={d.kvList}>
        <View style={d.kv}>
          <Text style={d.kvKey}>getBoundingClientRect</Text>
          <Text style={[d.kvVal, { color: C.js }]}>{syncSize ?? '—'}</Text>
        </View>
        <View style={d.kv}>
          <Text style={d.kvKey}>onLayout</Text>
          <Text style={d.kvVal}>{asyncSize ?? '—'}</Text>
        </View>
        <View style={d.kv}>
          <Text style={d.kvKey}>어느 쪽이 먼저</Text>
          <Text style={[d.kvVal, { color: C.struct }]}>
            {syncFirst === null ? '—' : syncFirst ? '동기 쪽이 먼저' : 'onLayout 이 먼저'}
          </Text>
        </View>
      </View>

      <Button
        title="크기 바꾸기"
        onPress={() => {
          orderRef.current = []
          setSyncFirst(null)
          setRound((r) => r + 1)
        }}
      />
      <Text style={d.hint}>
        동기 쪽이 먼저 찍히면, 화면에 그려지기 전에 크기를 알았다는 뜻입니다.
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// 레슨 본문
// ─────────────────────────────────────────────
export const lesson02: Lesson = {
  no: '②',
  slug: 'fabric',
  title: 'Fabric',
  summary: '화면을 그리는 새 방식. 왜 트리를 불변으로 만들어야 했나',

  chapters: [
    // ── 1장
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: 'React 가 만든 화면을 어떻게 실제 폰 화면으로 옮기나',
      blocks: [
        {
          kind: 'prose',
          text:
            'React 는 사실 **화면을 그리지 않습니다.** “무엇이 어떻게 바뀌었는지” 만 계산합니다. ' +
            '실제로 그리는 건 따로 있고, 그걸 **렌더러**라고 부릅니다.\n\n' +
            '웹에서는 react-dom 이 그 역할을 합니다. React Native 에서는 ' +
            '**Fabric** 이 그 역할입니다. 계산 결과를 받아서 진짜 iOS · Android 뷰로 만듭니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '용어 정리',
          text:
            '**섀도우 트리** — 실제 뷰를 만들기 전에 “이렇게 생길 것” 을 계산해두는 중간 단계입니다. ' +
            '크기와 위치를 여기서 정하고, 그 결과만 실제 뷰에 반영합니다.',
        },
        {
          kind: 'prose',
          text:
            '옛 렌더러의 문제가 두 가지였습니다.\n\n' +
            '**첫째, 섀도우 트리가 iOS 용 · Android 용으로 각각 따로 있었습니다.** ' +
            '같은 개념을 두 번 만든 셈이라, 레이아웃이 두 플랫폼에서 미묘하게 다르게 나오는 ' +
            '버그가 주기적으로 나왔습니다.',
        },
        {
          kind: 'prose',
          text:
            '**둘째, 트리를 고칠 때 원본을 덮어썼습니다(가변).** 이게 더 근본적인 문제였습니다.\n\n' +
            '요즘 React 는 “급한 일이 생기면 그리던 걸 중단하고 버리는” 기능이 있습니다. ' +
            '그런데 트리를 이미 절반쯤 덮어써 놨다면 — **되돌릴 방법이 없습니다.** ' +
            '그래서 Suspense 같은 기능이 RN 에서 반쪽짜리였습니다.',
        },
        {
          kind: 'prose',
          text:
            '그리고 실무에서 제일 자주 걸리던 문제 하나 더. **크기를 재는 게 비동기**였습니다. ' +
            '“이 글자 높이가 얼마지?” 를 물어보면 한 프레임 뒤에 답이 옵니다. ' +
            '그래서 재고 → 다시 그리기를 하면 첫 프레임에 엉뚱한 위치로 그려졌다가 교정됩니다. ' +
            '툴팁이나 바텀시트가 깜빡이던 이유입니다.',
        },
      ],
    },

    // ── 2장
    {
      heading: '2. 그래서 Fabric 이 뭔데',
      question: '두 가지를 바꿨습니다',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'Fabric 은 **섀도우 트리를 C++ 로 내리고, 고칠 때 덮어쓰지 않고 새로 만드는(불변) 렌더러**입니다.',
        },
        {
          kind: 'prose',
          text:
            '**C++ 로 내린 이유** — iOS 와 Android 가 같은 코드를 쓰게 됩니다. ' +
            '레이아웃 계산이 하나라서 플랫폼별 차이가 구조적으로 사라집니다.',
        },
        {
          kind: 'prose',
          text:
            '**불변으로 만든 이유** — 이게 핵심입니다. 노드를 고치는 대신 ' +
            '**바뀐 노드에서 루트까지의 경로만 새로 복제**합니다. 나머지 가지는 그대로 재사용합니다.',
        },
        {
          kind: 'code',
          code:
            '변경 전            변경 후\n' +
            '   A                A′  ← 새로 만듦\n' +
            '  / \\              /  \\\n' +
            ' B   C            B    C′  ← 새로 만듦\n' +
            '    / \\                /  \\\n' +
            '   D   E              D    E′  ← 여기가 바뀜\n',
          caption:
            'E 만 바뀌었는데 A·C·E 가 새로 생깁니다. B·D 는 포인터만 재사용하므로 비용이 싸게 유지됩니다.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: '불변이면 뭐가 좋은가',
          text:
            '“지금 화면에 떠 있는 트리” 와 “지금 만들고 있는 트리” 가 **동시에 존재**할 수 있습니다. ' +
            '그러니 만들던 걸 언제든 버려도 화면은 멀쩡합니다. 중단·재개·우선순위 처리가 ' +
            '전부 여기서 가능해집니다.',
        },
        {
          kind: 'compare',
          leftLabel: '옛 렌더러',
          rightLabel: 'Fabric',
          rows: [
            { label: '섀도우 트리', left: 'iOS · Android 각각', right: 'C++ 하나로 공유' },
            { label: '트리 수정', left: '원본을 덮어씀', right: '경로만 새로 복제' },
            { label: '렌더 중단', left: '불가 (되돌릴 수 없음)', right: '가능' },
            { label: '크기 재기', left: '한 프레임 뒤', right: '같은 프레임' },
            { label: '껍데기 View', left: '실제 뷰로 만듦', right: '플래트닝으로 생략' },
          ],
        },
      ],
    },

    // ── 3장
    {
      heading: '3. 만드는 순서',
      question: '네이티브 뷰를 하나 직접 만들어 봤습니다',
      blocks: [
        {
          kind: 'prose',
          text:
            '이 앱에 `DepthProbeView` 라는 뷰를 만들었습니다. ' +
            '**자기가 네이티브 뷰 계층에서 몇 단계 깊이에 있는지 스스로 세어서 알려주는** 뷰입니다. ' +
            '이거 하나로 플래트닝이 증명됩니다.\n\n' +
            '①에서 만든 podspec 배선을 거의 그대로 재사용했습니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: '뷰의 설계도를 쓴다',
              side: 'js',
              path: 'modules/react-native-fabric-lab/src/specs/DepthProbeViewNativeComponent.ts',
              text:
                '규칙 두 개가 있습니다 — 파일명이 `*NativeComponent.ts` 여야 하고, ' +
                'props 가 `ViewProps` 를 **직접** 상속해야 합니다.',
              code:
                'export interface NativeProps extends ViewProps {\n' +
                '  label?: string\n' +
                '  onProbe?: DirectEventHandler<ProbeEvent>\n' +
                '}\n' +
                '\n' +
                'export default codegenNativeComponent<NativeProps>(\n' +
                "  'DepthProbeView')",
              highlight: [0],
            },
            {
              title: '한 단계 더 상속하면 실패한다',
              side: 'gen',
              text:
                '처음에 `DepthProbeViewProps extends NativeProps extends ViewProps` 로 ' +
                '2단 상속을 했더니 이 에러가 났습니다. Codegen 은 한 단계만 따라갑니다.',
              code:
                'Error: Failed to find definition for "ViewProps",\n' +
                'please check that you have a valid codegen typescript file',
              highlight: [0],
            },
            {
              title: 'iOS 뷰를 구현한다',
              side: 'native',
              path: 'modules/react-native-fabric-lab/ios/DepthProbeView.mm',
              text:
                '`RCTViewComponentView` 를 상속하고, Fabric 이 알아볼 수 있게 ' +
                '설명자(descriptor)를 등록합니다. ObjC++(.mm) 여야 합니다 — C++ 생성 헤더를 쓰니까요.',
              code:
                '+ (ComponentDescriptorProvider)componentDescriptorProvider {\n' +
                '  return concreteComponentDescriptorProvider<\n' +
                '    DepthProbeViewComponentDescriptor>();\n' +
                '}',
              highlight: [1, 2],
            },
            {
              title: '부모를 세는 코드',
              side: 'native',
              text:
                '이게 이번 실험의 핵심입니다. 위로 올라가며 **실제 네이티브 뷰**를 셉니다. ' +
                '플래트닝된 View 는 실제 뷰가 없으니 여기 안 잡힙니다.',
              code:
                'UIView *cursor = self.superview;\n' +
                'while (cursor != nil) {\n' +
                '  depth += 1;\n' +
                '  cursor = cursor.superview;\n' +
                '}',
              highlight: [0, 2],
            },
            {
              title: '컴포넌트를 등록한다',
              side: 'gen',
              path: 'modules/react-native-fabric-lab/package.json',
              text:
                '**여기서 한 번 막혔습니다.** 빌드는 되는데 등록 목록이 비어 있었습니다. ' +
                '컴포넌트는 `componentProvider` 매핑이 따로 필요합니다 — ' +
                '①의 모듈이 `modulesProvider` 를 썼던 것과 짝입니다.',
              code:
                '"ios": {\n' +
                '  "componentProvider": {\n' +
                '    "DepthProbeView": "DepthProbeView"\n' +
                '  }\n' +
                '}',
              highlight: [1, 2],
            },
            {
              title: '문서 예제를 그대로 쓰면 경고가 난다',
              side: 'js',
              text:
                '공식 문서는 `react-native/Libraries/...` 딥 임포트를 씁니다. ' +
                '그런데 0.86 은 그걸 쓰면 **런타임 경고**를 냅니다. ⑤ Strict TypeScript API 로 ' +
                '가는 길목이고, 0.86 에 이미 루트 export 가 있으니 그쪽을 쓰면 됩니다.',
              code:
                "// ❌ 문서 예제 — 경고 남\n" +
                "import codegenNativeComponent from\n" +
                "  'react-native/Libraries/Utilities/codegenNativeComponent'\n" +
                '\n' +
                "// ✅ 루트 export\n" +
                "import { codegenNativeComponent, type CodegenTypes }\n" +
                "  from 'react-native'",
              highlight: [5, 6],
            },
            {
              title: 'pod install → 생성물 확인',
              side: 'gen',
              text:
                '모듈보다 훨씬 많이 나옵니다. 뷰는 렌더링에 관여하니 필요한 조각이 많습니다.',
              code:
                'ComponentDescriptors.h   Fabric 이 인식하는 진입점\n' +
                'Props.h / .cpp           props 를 담는 C++ 구조체\n' +
                'ShadowNodes.h / .cpp     섀도우 트리에 들어갈 노드\n' +
                'EventEmitters.h / .cpp   onProbe 를 쏘는 코드\n' +
                'States.h / .cpp          뷰 상태\n' +
                'RCTComponentViewHelpers.h  iOS 가 지킬 계약',
            },
          ],
        },
      ],
    },

    // ── 4장
    {
      heading: '4. 실행될 때 일어나는 일',
      question: '화면이 바뀔 때 거치는 3단계',
      blocks: [
        {
          kind: 'steps',
          flavor: 'runtime',
          steps: [
            {
              title: 'Render — 새 섀도우 트리를 만든다',
              side: 'js',
              text:
                'React 가 컴포넌트를 실행해서 “이렇게 생길 것” 을 계산하고, ' +
                'C++ 섀도우 노드를 만듭니다. **덮어쓰지 않고 새로 만듭니다.**',
            },
            {
              title: 'Commit — 크기를 계산하고 확정한다',
              side: 'native',
              text:
                '새 트리에 레이아웃을 계산합니다(백그라운드 스레드). ' +
                '끝나면 “현재 트리” 로 승격시킵니다. **이 승격 직전까지는 언제든 버릴 수 있습니다.** ' +
                '중단 가능한 렌더링의 정체가 이것입니다.',
            },
            {
              title: 'Mount — 바뀐 것만 실제 뷰에 반영',
              side: 'native',
              text:
                '이전 트리와 새 트리를 비교해 차이만 뽑아서 실제 뷰를 조작합니다.',
              code:
                'Create  <Text id=7>\n' +
                'Update  <View id=3> {height: 100 → 120}\n' +
                'Insert  id=7 into id=3 at 0\n' +
                'Delete  <View id=5>',
            },
            {
              title: '이때 플래트닝도 일어난다',
              side: 'native',
              text:
                '배경색도 테두리도 없고 레이아웃 용도로만 있는 View 는 ' +
                '**실제 뷰를 아예 만들지 않습니다.** 자식들이 위 계층으로 올라붙습니다.\n\n' +
                '주의할 게 하나 있는데, **“뷰를 만든다” 와 “자식을 담는다” 는 별개 조건**입니다. ' +
                '배경만 있는 뷰는 만들어지지만 자식은 담지 않아서, 자식들이 위로 올라가 형제가 됩니다. ' +
                '아래 실험에서 이걸 숫자로 봅니다.',
            },
          ],
        },
      ],
    },

    // ── 5장
    {
      heading: '5. 직접 확인',
      question: '위 설명이 사실인지 눌러서 봅니다',
      blocks: [
        {
          kind: 'demo',
          title: '실험 1 · 뷰 플래트닝',
          text:
            '**똑같이 3겹으로 감싼 두 트리**입니다. A 는 껍데기(padding 만), B 는 배경색이 있습니다. ' +
            '각 상자가 자기 안에 **실제로 만들어진 네이티브 뷰가 몇 개인지** 세어서 알려줍니다.',
          render: () => <FlatteningDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            'A 는 1, B 는 4 가 나옵니다. 차이가 정확히 **3** — A 쪽 껍데기 3겹이 ' +
            '네이티브 뷰를 하나도 안 만든 것입니다. 레이아웃 계산은 섀도우 트리에서 끝났으니 ' +
            '실제 뷰가 필요 없었던 거죠.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '처음에 틀렸던 것',
          text:
            '이 실험을 원래 **조상 수를 세는** 방식으로 만들었는데, A 와 B 가 똑같이 10 이 나왔습니다. ' +
            '조상 수는 실제 뷰 개수가 아니었기 때문입니다.\n\n' +
            'Fabric 은 조건을 **두 가지로 따로** 봅니다 — “실제 뷰가 필요한가(배경·테두리·그림자)” 와 ' +
            '“자식을 자기 안에 담아야 하는가(overflow·opacity·transform 등, 스택 컨텍스트)”. ' +
            '**배경색은 앞의 조건만 만족**시킵니다. 그래서 배경 뷰는 만들어지되 자식들은 위로 끌어올려져 ' +
            '형제로 붙습니다. 조상 체인에 안 잡히는 이유입니다.',
        },
        {
          kind: 'demo',
          title: '실험 2 · 동기 측정',
          text:
            '`useLayoutEffect` 안에서 `getBoundingClientRect()` 로 크기를 읽습니다. ' +
            '**화면에 그려지기 전에** 값이 나오면 동기 측정이 된 것입니다.',
          render: () => <SyncMeasureDemo />,
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '주의',
          text:
            '`onLayout` 은 여전히 한 번 그려진 뒤에 옵니다. 둘은 용도가 다릅니다 — ' +
            '**측정해서 바로 다시 그려야 하면 동기**, 크기 변화를 감시만 하면 `onLayout` 입니다.',
        },
      ],
    },

    // ── 6장
    {
      heading: '6. 정리',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          text:
            '“Fabric 이 없으면 뭐가 불가능한가?” → **렌더링을 중단하고 버리는 것, ' +
            '그리고 크기를 같은 프레임에 아는 것.**\n\n' +
            '자료구조를 불변으로 바꿨더니 위층 기능이 통째로 열린 사례입니다.',
        },
        {
          kind: 'prose',
          text:
            '대가도 있었습니다. Fabric 은 렌더러 교체라서, **커스텀 네이티브 뷰를 제공하는 ' +
            '라이브러리는 전부 대응이 필요했습니다.** 옛 방식으로 만든 뷰는 이제 그냥 안 돕니다.\n\n' +
            '그래서 새 구조로 옮기는 작업의 실제 비용 대부분은 내 코드가 아니라 ' +
            '**의존성 전수조사**에서 나옵니다.',
        },
        {
          kind: 'prose',
          text:
            '이번에 세 번 막혔고 3장에 다 기록해뒀습니다 — `ViewProps` 2단 상속 실패, ' +
            '`componentProvider` 누락, 문서 예제의 딥 임포트 경고.\n\n' +
            '특히 두 번째가 고약합니다. **빌드는 성공하는데 동작만 안 됩니다.** ' +
            '이런 유형은 컴파일러가 안 잡아주니 등록 목록을 직접 열어보는 수밖에 없습니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '한 가지 더',
          text:
            '스펙 파일을 고치고 저장하면 Fast Refresh 가 컴포넌트를 **두 번 등록**하려다 ' +
            '`Tried to register two views with the same name` 으로 터집니다. ' +
            '코드 문제가 아니라 HMR 한계입니다. Metro 를 `--clear` 로 재시작하면 됩니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **③ TurboModules** 입니다. 뷰가 아니라 기능 쪽이고, ' +
            '모듈이 언제 만들어지는지를 로그로 잡아봅니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 13, lineHeight: 20, color: C.ink3 },

  trees: { flexDirection: 'row', gap: 10 },
  treeCol: { flex: 1, gap: 5 },
  treeLabel: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  treeCode: { fontFamily: MONO, fontSize: 9.5, lineHeight: 14, color: C.ink3 },
  probe: { borderRadius: 5, padding: 4 },
  leaf: { height: 26, borderRadius: 3, backgroundColor: '#7A4412' },

  scoreRow: { flexDirection: 'row', gap: 8 },
  score: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    gap: 2,
  },
  scoreLabel: { fontFamily: MONO, fontSize: 9, color: C.ink3, letterSpacing: 0.3 },
  scoreVal: { fontSize: 21, fontWeight: '800' },
  verdict: { fontSize: 13.5, lineHeight: 21, color: C.ok, fontWeight: '600' },
  chain: { fontFamily: MONO, fontSize: 9.5, lineHeight: 15, color: C.ink3 },

  measureBox: {
    height: 54,
    borderRadius: 6,
    backgroundColor: C.jsSoft,
    borderWidth: 1,
    borderColor: C.js,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureBoxText: { fontFamily: MONO, fontSize: 12, color: C.js, fontWeight: '700' },

  kvList: { gap: 1 },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  kvKey: { fontFamily: MONO, fontSize: 11, color: C.ink3 },
  kvVal: { fontFamily: MONO, fontSize: 12.5, fontWeight: '700', color: C.ink },
})
