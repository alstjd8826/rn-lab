import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { DepthProbeView } from 'react-native-fabric-lab'
import { installJsiLab } from 'react-native-jsi-lab'
import { hello } from 'react-native-nitro-lab'
import { turboLab } from 'react-native-turbo-lab'
import { C, MONO } from '../theme'
import type { Lesson } from '../types'

type Check = { name: string; how: string; ok: boolean; detail: string }

// ios/ 를 통째로 지우고 prebuild 로 다시 만든 뒤, 로컬 네이티브 모듈들이
// 그대로 붙어 있는지 점검한다. CNG 가 복원했다는 직접 증거.
function WiringDemo() {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [probe, setProbe] = useState<number | null>(null)

  const run = useCallback(() => {
    const out: Check[] = []

    const t = (name: string, how: string, fn: () => string) => {
      try {
        out.push({ name, how, ok: true, detail: fn() })
      } catch (e) {
        out.push({ name, how, ok: false, detail: (e as Error).message })
      }
    }

    t('react-native-jsi-lab', '순수 C++ TurboModule + raw JSI', () => {
      const lab = installJsiLab()
      return `kind = ${lab.kind}`
    })

    t('react-native-turbo-lab', '순수 C++ TurboModule', () => {
      return `uptime ${(turboLab.getUptimeMs() / 1000).toFixed(1)}초`
    })

    t('react-native-nitro-lab', 'Nitro (Swift)', () => hello('Expo'))

    out.push({
      name: 'react-native-fabric-lab',
      how: 'Fabric 컴포넌트',
      ok: probe !== null,
      detail:
        probe !== null
          ? `onProbe 수신 · 실제 뷰 ${probe}개`
          : '아래 상자가 보이면 성공 (이벤트 대기 중)',
    })

    setChecks(out)
  }, [probe])

  return (
    <View style={d.wrap}>
      <Text style={d.hint}>
        조금 전 `ios/` 폴더를 통째로 지우고 prebuild 로 다시 만들었습니다. 그런데도
        로컬 네이티브 모듈 4개가 그대로 붙어 있는지 확인합니다.
      </Text>

      <DepthProbeView
        label=""
        style={d.probe}
        onProbe={(e) => setProbe(e.nativeEvent.subtreeCount)}
      >
        <View style={d.probeInner} />
      </DepthProbeView>

      <Button title="배선 점검" onPress={run} />

      {checks ? (
        <View style={d.list}>
          {checks.map((c) => (
            <View key={c.name} style={d.row}>
              <Text style={[d.badge, c.ok ? d.ok : d.bad]}>
                {c.ok ? 'OK' : '실패'}
              </Text>
              <View style={d.body}>
                <Text style={d.name}>{c.name}</Text>
                <Text style={d.how}>{c.how}</Text>
                <Text style={d.detail}>{c.detail}</Text>
              </View>
            </View>
          ))}
          <Text style={d.note}>
            네 개가 다 OK 라면 — 네이티브 폴더를 버리고 다시 만들었는데도 배선이
            전부 복원됐다는 뜻입니다. 손으로 유지하는 게 아니라 설정에서 생성되기
            때문입니다.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export const lesson07: Lesson = {
  no: '⑦',
  slug: 'expo',
  title: 'Expo',
  summary: '네이티브 폴더를 산출물로 취급해 업그레이드 고통을 없앤 방식',

  chapters: [
    {
      heading: '1. 무슨 문제를 푸는 건가',
      question: 'RN 버전 올리는 게 왜 그렇게 무서웠나',
      blocks: [
        {
          kind: 'prose',
          text:
            '①~⑥ 은 RN **내부 구조**였습니다. ⑦ 부터는 성격이 바뀝니다 — ' +
            '엔진이나 아키텍처가 아니라 **개발·빌드·배포를 어떤 도구로 굴리느냐**입니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '옛 Expo 에 대한 인상은 사실이었습니다',
          text:
            '초기 Expo 는 미리 만들어진 컨테이너 앱(Expo Go) 안에서만 돌았습니다. ' +
            '거기 없는 네이티브 모듈은 못 썼고, 정 필요하면 `eject` — 그러면 ' +
            '`ios/`·`android/` 가 튀어나오고 **다시는 돌아올 수 없었습니다.**\n\n' +
            '그래서 "진지한 앱은 bare 로" 가 상식이었습니다. **지금은 이 전제가 전부 무너졌습니다.**',
        },
        {
          kind: 'prose',
          text:
            '그런데 bare 에는 다른 고통이 있었습니다. **RN 버전을 올릴 때마다 ' +
            '`ios/`·`android/` 안의 수십 개 파일이 바뀝니다.** 그 파일들엔 내가 손으로 ' +
            '고쳐둔 것도 섞여 있고요.\n\n' +
            '그래서 업그레이드할 때마다 diff 를 떠놓고 한 줄씩 대조하는 **충돌 지옥**을 뚫어야 했습니다.',
        },
      ],
    },

    {
      heading: '2. 그래서 Expo 가 뭔데',
      question: '핵심은 하나입니다',
      blocks: [
        {
          kind: 'callout',
          tone: 'key',
          title: '정의',
          text:
            'Expo 는 **RN 을 감싸는 개발·빌드·배포 프레임워크**입니다.\n' +
            '그중 제일 중요한 건 **네이티브 폴더를 소스가 아니라 산출물로 취급**한다는 것입니다.',
        },
        {
          kind: 'prose',
          text: '조각이 몇 개 있는데, 인상을 뒤집은 순서대로 보면 이렇습니다.',
        },
        {
          kind: 'steps',
          flavor: 'build',
          steps: [
            {
              title: 'Development Build — Expo Go 탈출',
              side: 'js',
              text:
                '남이 만든 컨테이너에 얹히는 게 아니라 **내 프로젝트 전용 개발 앱을 직접 빌드**합니다. ' +
                '필요한 네이티브 모듈이 다 들어있고, 핫 리로드 같은 편의는 그대로입니다.\n\n' +
                '"Expo 는 네이티브를 못 건드린다" 는 말이 여기서 끝났습니다.',
            },
            {
              title: 'Config Plugins — 네이티브 설정을 코드로',
              side: 'native',
              text:
                'bare 에서 손으로 고치던 `Info.plist`·`AndroidManifest.xml`·Gradle 설정을 ' +
                '**조작하는 함수**로 씁니다. 못 하는 게 없습니다.',
              code:
                "const { withInfoPlist } = require('@expo/config-plugins')\n" +
                '\n' +
                'module.exports = function withLearnMarker(config) {\n' +
                '  return withInfoPlist(config, (cfg) => {\n' +
                "    cfg.modResults.LearnLabMarker = '...'\n" +
                '    return cfg\n' +
                '  })\n' +
                '}',
              highlight: [3, 4],
            },
            {
              title: 'CNG — 네이티브 폴더를 버리고 다시 만든다',
              side: 'gen',
              text:
                '`ios/`·`android/` 를 **빌드 산출물로 취급**합니다. git 에 안 넣습니다. ' +
                '설정이 바뀌면 버리고 다시 생성합니다.',
              code: '$ npx expo prebuild --clean -p ios',
            },
            {
              title: 'EAS — 빌드·배포 인프라',
              side: 'js',
              text:
                '클라우드 네이티브 빌드(맥 없이 iOS 빌드), JS 번들 OTA 배포, 스토어 제출. ' +
                '단 OTA 로는 **JS 와 에셋만** 바꿀 수 있습니다. 네이티브가 바뀌면 새로 빌드해야 합니다.',
            },
          ],
        },
      ],
    },

    {
      heading: '3. 실제로 ios/ 를 날려봤습니다',
      question: '뭐가 살아남고 뭐가 사라지나',
      blocks: [
        {
          kind: 'prose',
          text:
            '이 레슨을 만들면서 **대조 실험**을 했습니다. Info.plist 에 값 두 개를 ' +
            '서로 다른 방법으로 넣고 `ios/` 를 통째로 지웠습니다.\n\n' +
            '· `HandEditedKey` — PlistBuddy 로 **손으로** 직접 추가\n' +
            '· `LearnLabMarker` — **config plugin** 이 넣도록 설정',
        },
        {
          kind: 'code',
          path: 'prebuild 전',
          code:
            '손으로 넣은 값 : 손으로 직접 넣은 값\n' +
            '플러그인 값    : Does Not Exist',
          caption: '아직 prebuild 를 안 돌렸으니 플러그인 값은 없습니다.',
        },
        {
          kind: 'code',
          path: '$ npx expo prebuild --clean -p ios',
          code:
            '손으로 넣은 값 : Does Not Exist\n' +
            '플러그인 값    : config-plugin 이 넣은 값\n' +
            '플러그인 날짜  : 2026-08-19',
          highlight: [0, 1],
        },
        {
          kind: 'callout',
          tone: 'key',
          text:
            '**정확히 뒤집혔습니다.** 손으로 고친 건 사라지고, 코드로 선언한 건 복원됐습니다.\n\n' +
            '이게 CNG 의 전부입니다 — 네이티브 폴더는 언제든 버려도 되는 산출물이고, ' +
            '진짜 소스는 `app.json` 과 config plugin 입니다.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: '그래서 제약이 하나 생깁니다',
          text:
            '**네이티브 파일을 직접 열어서 고치는 방식이 안 됩니다.** 고쳐도 다음 prebuild 에서 날아갑니다. ' +
            '모든 커스터마이징이 config plugin 을 거쳐야 합니다.\n\n' +
            '처음엔 귀찮은데, 이 제약 덕에 업그레이드가 쉬워지는 거라 값을 하는 제약입니다.',
        },
      ],
    },

    {
      heading: '4. ③에서 겪은 일의 정체',
      blocks: [
        {
          kind: 'prose',
          text:
            '③ TurboModules 편을 만들 때 빌드가 링커 에러로 깨졌던 걸 기억하실 겁니다. ' +
            'RN 코어의 디버그 심볼 22개를 못 찾는 증상이었고, **원인을 끝내 특정하지 못했습니다.** ' +
            '새로 추가한 모듈을 빼도 같은 에러가 났고요.',
        },
        {
          kind: 'code',
          code:
            "error: Undefined symbols: 'facebook::react::Sealable::Sealable()'\n" +
            "         'facebook::react::DebugStringConvertible::getDebugName()'\n" +
            '         ... 22개',
        },
        {
          kind: 'callout',
          tone: 'key',
          title: '해결은 한 줄이었습니다',
          text:
            '`npx expo prebuild --clean -p ios`\n\n' +
            '원인을 모르는 채로 고쳤습니다. 그래도 됩니다 — **`ios/` 는 버려도 되는 산출물**이니까요. ' +
            'bare 였다면 손으로 고쳐둔 것들이 섞여 있어서 이 선택지를 못 씁니다. ' +
            '"의심스러우면 버리고 다시 만든다" 가 가능한 게 CNG 의 실질적 값어치입니다.',
        },
      ],
    },

    {
      heading: '5. 직접 확인',
      question: '날렸는데 정말 다 복원됐나',
      blocks: [
        {
          kind: 'demo',
          title: '배선 점검 · 로컬 네이티브 모듈 4개',
          text:
            '①③에서 만든 순수 C++ TurboModule, ②의 Fabric 컴포넌트, 그리고 기존 Nitro 모듈. ' +
            '**전부 podspec 과 autolinking 으로 연결된 것들**이고, 조금 전 `ios/` 와 함께 사라졌던 것들입니다.',
          render: () => <WiringDemo />,
        },
        {
          kind: 'callout',
          tone: 'info',
          text:
            '이 모듈들의 배선은 `ios/` 안에 있지 않습니다. 각 모듈의 `package.json` 과 ' +
            '`*.podspec` 에 있고, prebuild 가 그걸 읽어서 다시 연결합니다. ' +
            '그래서 폴더를 날려도 살아납니다.',
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
            '“Expo 가 없으면 뭐가 불가능한가?” → **네이티브 폴더를 버리고 다시 만드는 것.**\n\n' +
            'RN 업그레이드가 그렇게 무서웠던 이유가 네이티브 폴더의 수동 변경분이었는데, ' +
            'CNG 는 그걸 아예 없애버렸습니다.',
        },
        {
          kind: 'prose',
          text:
            '한계도 있습니다. config plugin 으로 표현하기 어려운 특이한 빌드 커스터마이징, ' +
            '이미 거대한 네이티브 앱에 RN 을 얹는 경우(brownfield), EAS 클라우드 빌드 비용 등. ' +
            'CNG 를 포기하고 네이티브 폴더를 커밋하는 절충안도 선택할 수 있습니다.\n\n' +
            '다만 신규 RN 프로젝트의 **70% 이상**이 Expo 인 데는 이유가 있습니다.',
        },
        {
          kind: 'prose',
          text:
            '다음은 **⑧ Nitro Modules** 입니다. 이 앱에 이미 Nitro 모듈이 들어있으니, ' +
            '③에서 만든 TurboModule 과 같은 일을 시켜서 **나란히 재보는** 편이 되겠습니다.',
        },
      ],
    },
  ],
}

const d = StyleSheet.create({
  wrap: { gap: 11 },
  hint: { fontSize: 13.5, lineHeight: 21, color: C.ink2 },
  probe: { borderRadius: 5, padding: 5, alignSelf: 'stretch' },
  probeInner: { height: 20, borderRadius: 3, backgroundColor: '#7A4412' },

  list: { gap: 9 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  badge: {
    fontFamily: MONO,
    fontSize: 9.5,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    overflow: 'hidden',
    minWidth: 34,
    textAlign: 'center',
  },
  ok: { backgroundColor: C.okSoft, color: C.ok },
  bad: { backgroundColor: C.warnSoft, color: C.warn },
  body: { flex: 1, gap: 1 },
  name: { fontFamily: MONO, fontSize: 11.5, fontWeight: '700', color: C.ink },
  how: { fontSize: 11, color: C.ink3 },
  detail: { fontSize: 12.5, lineHeight: 18, color: C.ink2 },
  note: {
    fontSize: 12,
    lineHeight: 18.5,
    color: C.ink2,
    marginTop: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
})
