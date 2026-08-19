import type { Lesson } from '../types'
import { lesson01 } from './01-jsi'
import { lesson02 } from './02-fabric'
import { lesson03 } from './03-turbomodules'
import { lesson04 } from './04-codegen'
import { lesson05 } from './05-strict-ts'
import { lesson06 } from './06-hermes'
import { lesson07 } from './07-expo'

// ①~⑩. 아직 안 만든 것도 등록해두면 전체 지도가 보인다.
export const LESSONS: Lesson[] = [
  lesson01,
  lesson02,
  lesson03,
  lesson04,
  lesson05,
  lesson06,
  lesson07,
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
