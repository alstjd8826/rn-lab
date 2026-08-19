import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CARDS, type HoloCard as CardData } from "./cards";
import { isPorted } from "./effects";
import HoloCard from "./HoloCard";

// poke-holo.simey.me 를 그대로 옮긴 갤러리.
//  사이트와 같은 88장, 같은 섹션 구성, 같은 등급별 효과.

type Section = { key: string; label: string; cards: CardData[] };

function group(): Section[] {
  const out: Section[] = [];
  for (const c of CARDS) {
    const last = out[out.length - 1];
    if (last && last.key === c.section) last.cards.push(c);
    else out.push({ key: c.section, label: c.sectionLabel, cards: [c] });
  }
  return out;
}

export default function HoloGallery() {
  const { width: screenW } = useWindowDimensions();
  const CARD_W = Math.min(300, screenW - 60);
  const sections = useMemo(() => group(), []);
  const [si, setSi] = useState(4); // 기본값
  const sec = sections[si];

  const doneCount = CARDS.filter((c) => isPorted(c.effect)).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>✨ 포켓몬 홀로 카드</Text>
      <Text style={styles.hint}>
        카드 {CARDS.length}장 · 효과 {doneCount}장 구현
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {sections.map((s, i) => {
          const ok = s.cards.every((c) => isPorted(c.effect));
          return (
            <Pressable
              key={s.key}
              onPress={() => setSi(i)}
              style={[styles.tab, i === si && styles.tabOn]}
            >
              <Text style={[styles.tabText, i === si && styles.tabTextOn]}>
                {ok ? "" : "· "}
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sub}>
        {sec.cards[0].rarity} — {sec.cards[0].effect}
        {isPorted(sec.cards[0].effect) ? "" : " (미구현 · basic 으로 대체)"}
      </Text>

      {sec.cards.map((c) => (
        <View key={c.id} style={styles.item}>
          <Text style={styles.name}>
            {c.name} <Text style={styles.id}>{c.id}</Text>
          </Text>
          <HoloCard card={c} width={CARD_W} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", gap: 6 },
  title: { fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 12, color: "#666" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  tabs: { gap: 6, paddingHorizontal: 4, paddingVertical: 6 },
  tab: {
    borderWidth: 1,
    borderColor: "#dcdcdc",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    backgroundColor: "#fafafa",
  },
  tabOn: { backgroundColor: "#111", borderColor: "#111" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#333" },
  tabTextOn: { color: "#fff" },
  item: { alignItems: "center" },
  name: { fontSize: 14, fontWeight: "600" },
  id: { fontSize: 11, color: "#999", fontWeight: "400" },
});
