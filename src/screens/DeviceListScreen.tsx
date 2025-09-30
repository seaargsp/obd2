import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, Text, View, useColorScheme } from 'react-native';
import BluetoothAdapter from '../services/BluetoothAdapter';

export default function DeviceListScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
    divider: isDark ? '#222831' : '#EEEEEE',
  } as const;
  const bt = BluetoothAdapter.getInstance();
  const [devices, setDevices] = useState<any[]>([]);
  const [state, setState] = useState(bt.connectionState);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    const off1 = bt.on('device:list', setDevices);
    const off2 = bt.on('state:change', s => setState(s));
    bt.ensurePermissions().then(() => bt.listDevices());
    return () => { off1(); off2(); };
  }, [bt]);

  const connect = async (addr: string) => {
    setConnecting(addr);
    try { await bt.connect(addr); } finally { setConnecting(null); }
  };
  const disconnect = async () => { await bt.disconnect(); };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>Bluetooth Devices</Text>
      <Text style={{ color: colors.text }}>State: {state}</Text>
      <Button title="Refresh" onPress={() => bt.listDevices()} />
      <FlatList
        data={devices}
        keyExtractor={(item) => item.address}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.divider }}>
            <Text style={{ fontWeight: '600', color: colors.text }}>{item.name || item.address}</Text>
            <Text style={{ color: colors.text }}>{item.address}</Text>
            {state !== 'connected' ? (
              <Button title={connecting === item.address ? 'Connecting...' : 'Connect'} onPress={() => connect(item.address)} />
            ) : (
              <Button title="Disconnect" onPress={disconnect} />
            )}
          </View>
        )}
      />
    </View>
  );
}
