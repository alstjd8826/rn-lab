import {
  codegenNativeComponent,
  type CodegenTypes,
  type HostComponent,
  type ViewProps,
} from 'react-native'

/**
 * Fabric 네이티브 뷰 스펙.
 *
 * 규칙 두 개를 지켜야 Codegen 이 알아본다.
 *   1. 파일명이 `*NativeComponent.ts`
 *   2. props 인터페이스가 `ViewProps` 를 **직접** 상속
 *      (한 단계 더 상속하면 "Failed to find definition for ViewProps" 로 실패)
 *
 * 이 뷰는 화면에 붙은 뒤 자기 위쪽 네이티브 뷰(superview)를 세어서
 * 몇 단계 깊이에 있는지 보고한다. 뷰 플래트닝을 눈으로 확인하는 용도.
 *
 * ⑤ Strict TypeScript API 관련: 문서 예제는 아직
 * `react-native/Libraries/Utilities/codegenNativeComponent` 딥 임포트를 쓰지만,
 * 0.86 은 그걸 쓰면 런타임 경고를 낸다. 루트 export 가 이미 있으니 그쪽을 쓴다.
 */
type ProbeEvent = Readonly<{
  /** 루트까지 올라가며 센 실제 네이티브 뷰 개수 */
  depth: CodegenTypes.Int32
  /** 네이티브가 측정한 크기 */
  width: CodegenTypes.Double
  height: CodegenTypes.Double
  /** 올라가며 만난 클래스 이름들 */
  chain: string
}>

export interface NativeProps extends ViewProps {
  /** 뷰 안에 표시할 이름 */
  label?: string
  onProbe?: CodegenTypes.DirectEventHandler<ProbeEvent>
}

export default codegenNativeComponent<NativeProps>(
  'DepthProbeView',
) as HostComponent<NativeProps>
