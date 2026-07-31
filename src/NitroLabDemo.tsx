import { useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { add, delay, hello } from "react-native-nitro-lab";
import {
  endTimer,
  isTimerActivitySupported,
  startTimer,
} from "react-native-nitro-timer-activity";

// Nitro 모듈(hello/add/delay) + Live Activity 타이머(다중).
export default function NitroLabDemo() {
  const [greeting] = useState(() => hello("Nitro"));
  const [sum] = useState(() => add(2, 3));
  const [delayMsg, setDelayMsg] = useState("아직 안 함");

  const [timerIds, setTimerIds] = useState<string[]>([]);
  const [timerMsg, setTimerMsg] = useState(
    isTimerActivitySupported() ? "지원됨" : "미지원(iOS 16.2+/활성화 필요)",
  );
  const seqRef = useRef(0);

  const runDelay = async () => {
    setDelayMsg("대기 중…");
    const start = Date.now();
    await delay(800);
    setDelayMsg(`delay(800) 완료 · 실측 ${Date.now() - start}ms`);
  };

  const addTimer = async () => {
    try {
      const n = (seqRef.current += 1);
      const seconds = 20 + n * 10;
      const id = await startTimer({
        title: `타이머 ${n}`,
        endTimeEpochMs: Date.now() + seconds * 1000,
      });
      setTimerIds((prev) => [...prev, id]);
      setTimerMsg(`타이머 ${n} 시작 (${seconds}초)`);
      setTimeout(() => {
        endTimer(id);
        setTimerIds((prev) => prev.filter((x) => x !== id));
      }, seconds * 1000);
    } catch (e) {
      setTimerMsg(`실패: ${String(e)}`);
    }
  };

  const stopAll = async () => {
    await Promise.all(timerIds.map((id) => endTimer(id)));
    setTimerIds([]);
    setTimerMsg("전체 종료됨");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🧪 Nitro Lab</Text>
      <Text style={styles.line}>hello: {greeting}</Text>
      <Text style={styles.line}>add(2,3): {sum}</Text>
      <Text style={styles.line}>delay: {delayMsg}</Text>
      <View style={styles.btn}>
        <Button title="delay(800) 실행" onPress={runDelay} />
      </View>

      <View style={styles.divider} />

      <Text style={styles.title}>⏱️ Live Timer (다중)</Text>
      <Text style={styles.line}>{timerMsg}</Text>
      <Text style={styles.line}>활성: {timerIds.length}개</Text>
      <View style={styles.btn}>
        <Button title="타이머 추가" onPress={addTimer} />
      </View>
      <View style={styles.btn}>
        <Button title="전체 종료" color="#c0392b" onPress={stopAll} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: 8, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  line: { fontSize: 16, textAlign: "center" },
  btn: { marginTop: 8 },
  divider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: "#eee",
    marginVertical: 20,
  },
});
