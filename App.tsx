import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { add, delay, hello } from 'react-native-nitro-lab'

export default function App() {
  const [greeting] = useState(() => hello('Nitro'))
  const [sum] = useState(() => add(2, 3))
  const [delayMsg, setDelayMsg] = useState('아직 안 함')

  const runDelay = async () => {
    setDelayMsg('대기 중…')
    const start = Date.now()
    await delay(800)
    setDelayMsg(`delay(800) 완료 · 실측 ${Date.now() - start}ms`)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Nitro Lab</Text>
      <Text style={styles.line}>hello: {greeting}</Text>
      <Text style={styles.line}>add(2,3): {sum}</Text>
      <Text style={styles.line}>delay: {delayMsg}</Text>
      <View style={styles.btn}>
        <Button title="delay(800) 실행" onPress={runDelay} />
      </View>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  line: { fontSize: 16 },
  btn: { marginTop: 12 },
})
