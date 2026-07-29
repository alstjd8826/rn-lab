import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

// 끌어서 옮기고, 놓으면 던진 속도(velocity)를 스프링에 실어 중앙으로 복귀.
// onChange/onEnd 콜백은 gesture-handler v2 + reanimated 조합에서
// 자동으로 워클릿화되어 UI 스레드에서 실행됨(JS 브릿지 안 탐 → 60fps).
export default function GestureDemo() {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const scale = useSharedValue(1)

  const pan = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.2)
    })
    .onChange((e) => {
      tx.value += e.changeX
      ty.value += e.changeY
    })
    .onEnd((e) => {
      // 던진 속도를 그대로 스프링 초기 속도로 → 관성 튕김
      tx.value = withSpring(0, { velocity: e.velocityX, damping: 14 })
      ty.value = withSpring(0, { velocity: e.velocityY, damping: 14 })
    })
    .onFinalize(() => {
      scale.value = withSpring(1)
    })

  const boxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>👆 제스처 드래그 + 관성 스프링</Text>
      <Text style={styles.hint}>끌었다 놓으면 속도 실려 튕겨 돌아옴</Text>
      <View style={styles.stage}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.box, boxStyle]} />
        </GestureDetector>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 13, color: '#555' },
  stage: {
    alignSelf: 'stretch',
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#e67e22',
  },
})
