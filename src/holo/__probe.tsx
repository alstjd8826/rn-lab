import { StyleSheet, Text, View } from 'react-native'
import { CARDS } from './cards'
import HoloCard from './HoloCard'

// 대조용 화면. 카드 한 장을 고정 위치·고정 포인터로 그린다.
//  원본 CSS 를 띄운 Safari 스크린샷과 픽셀 비교하기 위한 것이고,
//  PROBE_ID 를 스크립트가 바꿔가며 22개 효과를 한 바퀴 돌린다.
//  포인터 값은 정답 페이지(ref-*.html)와 같아야 한다 — 25% / 10%.
export const PROBE_ID = 'swsh12pt5-160'

export default function HoloProbe() {
  const card = CARDS.find((c) => c.id === PROBE_ID) ?? CARDS[0]
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {card.effect} — {card.name} {card.id}
      </Text>
      <HoloCard card={card} width={300} probe={{ x: 0.25, y: 0.1 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center' },
  label: { fontSize: 12, color: '#555' },
})
