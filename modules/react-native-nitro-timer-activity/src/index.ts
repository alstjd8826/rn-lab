import { NitroModules } from 'react-native-nitro-modules'
import type {
  TimerActivity,
  TimerActivityState,
} from './specs/TimerActivity.nitro'

export type { TimerActivityState } from './specs/TimerActivity.nitro'

const timer = NitroModules.createHybridObject<TimerActivity>('TimerActivity')

export function isTimerActivitySupported(): boolean {
  return timer.isSupported()
}

export function startTimer(state: TimerActivityState): Promise<string> {
  return timer.start(state)
}

export function updateTimer(
  id: string,
  state: TimerActivityState,
): Promise<void> {
  return timer.update(id, state)
}

export function endTimer(id: string): Promise<void> {
  return timer.end(id)
}
