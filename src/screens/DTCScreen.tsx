import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Button, ScrollView, Text, View, useColorScheme } from 'react-native';
import OBD2Client from '../services/OBD2Client';

export default function DTCScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
  } as const;
  const client = OBD2Client.getInstance();
  const [codes, setCodes] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  React.useEffect(() => {
    const offC = client.on('connected', () => setConnected(true));
    const offD = client.on('disconnected', () => setConnected(false));
    // Initialize from current state
    setConnected(client.isConnected());
    return () => { offC(); offD(); };
  }, [client]);

  const read = async () => {
    setBusy(true);
    try {
      const r = await client.readDTCs();
      if ((r as any).success === false) {
        setCodes('');
      } else {
        setCodes(String((r as any).value ?? ''));
      }
    } finally { setBusy(false); }
  };
  const clear = async () => { setBusy(true); try { await client.clearDTCs(); setCodes(''); } finally { setBusy(false); } };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>Diagnostic Trouble Codes</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={busy ? 'Working…' : 'Read DTCs'} onPress={read} disabled={busy || !connected} />
          <Button title="Clear DTCs" onPress={clear} disabled={busy || !connected} />
        </View>
        <Text style={{ marginTop: 16, color: colors.text }}>{connected ? (codes || 'No codes') : 'Connect to a device to read codes.'}</Text>
      </ScrollView>
    </View>
  );
}
