import { NitroModules } from 'react-native-nitro-modules'
import type { Lab } from './specs/Lab.nitro'

const lab = NitroModules.createHybridObject<Lab>('Lab')

export function hello(name: string): string {
  return lab.hello(name)
}

export function add(a: number, b: number): number {
  return lab.add(a, b)
}

export function delay(ms: number): Promise<void> {
  return lab.delay(ms)
}
