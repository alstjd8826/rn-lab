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
import { lesson10 } from './10-react-compiler'

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
  lesson10,
]
