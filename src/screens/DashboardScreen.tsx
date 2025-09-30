import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { DEFAULT_PID_GROUPS, PID_DEFINITIONS } from '../data/pidDefinitions';
import LiveDataManager from '../services/LiveDataManager';
import OBD2Client from '../services/OBD2Client';

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
    cardBorder: isDark ? '#2A2F36' : '#DDDDDD',
    cardBg: isDark ? '#11161C' : '#FFFFFF',
    primary: isDark ? '#4EA8FF' : '#1976D2',
    primaryText: '#FFFFFF',
  } as const;
  const live = LiveDataManager.getInstance();
  const client = OBD2Client.getInstance();
  const [values, setValues] = useState<Record<string, any>>({});
  const [running, setRunning] = useState(false);
  const [supported01, setSupported01] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const off = live.on('sample', (s) => setValues((v) => ({ ...v, [s.key]: s.value })));
    const offE = live.on('error', (e) => setStatusMsg(e.message));
    // listen for supported PID updates
    const offSup = client.on('supported:update', (evt) => {
      if (evt.mode === 0x01) setSupported01(evt.pids);
    });
    const offC = client.on('connected', () => { setConnected(true); setStatusMsg(null); });
    const offD = client.on('disconnected', () => { setConnected(false); setStatusMsg('Waiting for connection…'); setRunning(false); });
    // initial: if already connected and cached, set now
    setSupported01(client.getSupported(0x01));
    // subscribe defaults (LiveDataManager will drop unsupported when known)
    DEFAULT_PID_GROUPS.forEach(g => g.pids.forEach(p => live.subscribe(p.mode, p.pid)));
    return () => { off(); offE(); offSup(); offC(); offD(); live.stop(); };
  }, [live, client]);

  const start = () => { live.start(); setRunning(true); };
  const stop = () => { live.stop(); setRunning(false); };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>Dashboard</Text>
      {!!statusMsg && (
        <Text style={{ color: colors.text, marginBottom: 8 }}>{statusMsg}</Text>
      )}
      <View style={{ width: '100%', flexDirection: 'column', gap: 16 }}>
        {!running ? (
          <Pressable
            accessibilityRole="button"
            onPress={start}
            style={{
              width: '100%',
              borderRadius: 10,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 24, // ~2x default height
            }}
            disabled={!connected}
          >
            <Text style={{ color: colors.primaryText, fontSize: 18, fontWeight: '600', opacity: connected ? 1 : 0.6 }}>{connected ? 'Start' : 'Connect a device to start'}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={stop}
            style={{
              width: '100%',
              borderRadius: 10,
              backgroundColor: '#E53935',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 24,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Stop</Text>
          </Pressable>
        )}
      </View>
      {DEFAULT_PID_GROUPS.map(group => (
        <View key={group.id} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{group.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {group.pids
              .filter(p => p.mode !== 0x01 || supported01.length === 0 || supported01.includes(p.pid))
              .map(p => {
              const key = `${p.mode}:${p.pid}`;
              const val = values[key];
              const def = PID_DEFINITIONS.find(d => d.mode === p.mode && d.pid === p.pid);
              return (
                <View key={key} style={{ width: '48%', margin: '1%', padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8, backgroundColor: colors.cardBg }}>
                  <Text style={{ fontWeight: '600', color: colors.text }}>{def?.name || key}</Text>
                  <Text style={{ fontSize: 24, color: colors.text }}>{String(val ?? '—')} {def?.unit || ''}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
