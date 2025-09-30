import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button, Text, View, useColorScheme } from "react-native";

export default function Index() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
  } as const;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.bg,
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={{ fontSize: 20, marginBottom: 24, color: colors.text }}>OBD2 Scanner</Text>
      <View style={{ gap: 12 }}>
  <Button title="Devices" onPress={() => (router as any).push('devices')} />
  <Button title="Dashboard" onPress={() => (router as any).push('dashboard')} />
  <Button title="DTCs" onPress={() => (router as any).push('dtc')} />
  <Button title="Settings" onPress={() => (router as any).push('settings')} />
  <Button title="Diag Info" onPress={() => (router as any).push('/diag')} />
      </View>
    </View>
  );
}
