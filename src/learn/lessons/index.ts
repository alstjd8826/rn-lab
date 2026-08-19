import type { Lesson } from '../types'
import { lesson01 } from './01-jsi'
import { lesson02 } from './02-fabric'
import { lesson03 } from './03-turbomodules'
import { lesson04 } from './04-codegen'
import { lesson05 } from './05-strict-ts'
import { lesson06 } from './06-hermes'
import { lesson07 } from './07-expo'
import { lesson08 } from './08-nitro'
import { lesson09 } from './09-perf'

// ①~⑩. 아직 안 만든 것도 등록해두면 전체 지도가 보인다.
export const LESSONS: Lesson[] = [
  lesson01,
  lesson02,
  lesson03,
  lesson04,
  lesson05,
  lesson06,
  lesson07,
  lesson08,
  lesson09,
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
