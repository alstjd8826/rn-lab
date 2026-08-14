import type { Lesson } from '../types'
import { lesson01 } from './01-jsi'

// ①~⑩. 아직 안 만든 것도 등록해두면 전체 지도가 보인다.
export const LESSONS: Lesson[] = [
  lesson01,
  {
    no: '②',
    slug: 'fabric',
    title: 'Fabric',
    summary: '화면을 그리는 새 방식. 왜 트리를 불변으로 만들어야 했나',
    comingUp:
      'codegenNativeComponent 로 네이티브 뷰를 직접 만들어서, 레이아웃을 동기로 재는 것과 ' +
      '껍데기 View 가 실제 뷰로 안 만들어지는 것(뷰 플래트닝)을 확인합니다.',
  },
  {
    no: '③',
    slug: 'turbomodules',
    title: 'TurboModules',
    summary: '네이티브 기능을 필요할 때만 만드는 방식',
    comingUp:
      '순수 TurboModule 을 하나 더 만들어서, 모듈이 언제 생성되는지 로그로 증명합니다. ' +
      'Android 쪽도 여기서 함께 뚫을 예정입니다.',
  },
  {
    no: '④',
    slug: 'codegen',
    title: 'Codegen',
    summary: 'TS 한 장으로 C++ · Swift · Kotlin 계약을 자동 생성',
    comingUp:
      '①에서 손으로 적은 __jsiLab 타입과, 생성기가 만든 계약을 나란히 놓고 비교합니다. ' +
      '일부러 타입을 틀리게 써서 빌드가 막히는 것까지 봅니다.',
  },
  {
    no: '⑤',
    slug: 'strict-ts',
    title: 'Strict TypeScript API',
    summary: 'RN 타입을 손으로 안 적고 소스에서 생성',
    comingUp:
      '지금 RN 0.86 은 opt-in 상태입니다. 켜서 딥 임포트가 어떻게 깨지는지 직접 봅니다. ' +
      '0.87 로 올리면 강제되는 것을 미리 겪는 셈입니다.',
  },
  {
    no: '⑥',
    slug: 'hermes',
    title: 'Hermes',
    summary: '앱 켤 때 JS 를 해석하지 않게 만든 엔진',
    comingUp:
      '바이트코드 파일 크기를 재보고, 샘플링 프로파일러로 JS 스레드가 어디에 ' +
      '시간을 쓰는지 떠봅니다.',
  },
  {
    no: '⑦',
    slug: 'expo',
    title: 'Expo',
    summary: '네이티브 폴더를 산출물로 취급해 업그레이드 고통을 없앤 방식',
    comingUp:
      'config plugin 을 직접 하나 써보고, prebuild --clean 으로 ios/ 를 날린 뒤 ' +
      '설정이 그대로 복원되는 것을 확인합니다.',
  },
  {
    no: '⑧',
    slug: 'nitro',
    title: 'Nitro Modules',
    summary: 'ObjC 를 건너뛰고 바인딩을 미리 컴파일해 더 빠르게',
    comingUp:
      '이 앱에 이미 Nitro 모듈이 있습니다. 같은 기능을 TurboModule 로도 만들어 ' +
      '나란히 벤치마크합니다.',
  },
  {
    no: '⑨',
    slug: 'perf',
    title: '성능 계측',
    summary: 'JS FPS 와 UI FPS 는 다른 숫자다',
    comingUp:
      'JS 스레드를 일부러 막아서 화면은 멀쩡한데 반응만 없는 상태를 만들어 봅니다. ' +
      '두 FPS 를 따로 재는 이유가 손에 잡힙니다.',
  },
  {
    no: '⑩',
    slug: 'react-compiler',
    title: 'React Compiler',
    summary: 'useMemo 를 컴파일러가 대신 발라준다 — 조용히 실패하는 함정까지',
    comingUp:
      'Expo 설정으로 켜고, healthcheck 로 커버리지를 보고, 규칙을 어긴 컴포넌트가 ' +
      '어떻게 조용히 스킵되는지 확인합니다.',
  },
]
