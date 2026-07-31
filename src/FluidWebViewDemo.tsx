import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";

// 2b: Pavel Dobryakov의 오픈소스 WebGL 유체 시뮬(MIT)을 WebView로 로드.
// 드래그하면 다이가 번지는 그 화면. 터치도 그대로 동작.
// ⚠️ 원격 URL 의존(프로토타입용). 실제 앱이면 HTML/JS를 앱에 번들해야 함.
const FLUID_URL = "https://paveldogreat.github.io/WebGL-Fluid-Simulation/";

export default function FluidWebViewDemo() {
  const { width: winW } = useWindowDimensions();
  const W = Math.floor(winW - 48);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🌫️ 2b · WebView 유체 (Navier-Stokes)</Text>
      <Text style={styles.hint}>드래그 = 다이 번짐 · 원격 오픈소스 로드</Text>
      <View style={[styles.stage, { width: W, height: 360 }]}>
        <WebView
          source={{ uri: FLUID_URL }}
          style={{ flex: 1, backgroundColor: "#000" }}
          originWhitelist={["*"]}
          scrollEnabled={false}
          allowsInlineMediaPlayback
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: 6, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 13, color: "#555" },
  stage: { borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
});
