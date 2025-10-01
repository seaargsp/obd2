import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Button, ScrollView, Text, View, useColorScheme } from 'react-native';
import OBD2Client from '../services/OBD2Client';

export default function DiagInfoScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
  } as const;
  const client = OBD2Client.getInstance();
  const [vin, setVin] = useState<string>('');

  const readVIN = async () => {
    const r = await client.query(0x09, 0x02);
    setVin(String(r.value ?? ''));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>Diagnostic Info</Text>
        <Button title="Read VIN" onPress={readVIN} />
        <Text style={{ marginTop: 16, color: colors.text }}>VIN: {vin || '—'}</Text>
      </ScrollView>
    </View>
  );
}
