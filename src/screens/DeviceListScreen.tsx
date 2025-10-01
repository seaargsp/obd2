import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Button, FlatList, ScrollView, Text, View, useColorScheme } from 'react-native';
import BluetoothAdapter from '../services/BluetoothAdapter';
import OBD2Client from '../services/OBD2Client';

export default function DeviceListScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
    divider: isDark ? '#222831' : '#EEEEEE',
    sub: isDark ? '#88929D' : '#445566',
    debugBg: isDark ? '#0E141A' : '#F5F7FA',
    debugText: isDark ? '#B3C0CC' : '#22323F',
  } as const;

  const bt = BluetoothAdapter.getInstance();
  const client = OBD2Client.getInstance();

  const [devices, setDevices] = useState<any[]>([]);
  const [state, setState] = useState(bt.connectionState);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedAddr, setConnectedAddr] = useState<string | null>(null);

  // Debug panel state
  const [debugVisible, setDebugVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const appendLog = (line: string) => {
    const ts = new Date().toISOString().split('T')[1]?.replace('Z', '');
    const text = `[${ts}] ${line}`;
    setLogs(prev => {
      const next = [...prev, text];
      // keep last 300 lines
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  };

  useEffect(() => {
    const offList = bt.on('device:list', setDevices);
    const offState = bt.on('state:change', s => setState(s));
    const offConnected = bt.on('connected', d => {
      setConnectedAddr(d.address);
      appendLog(`[BT] connected: ${d.name ?? d.address}`);
    });
    const offDisconnected = bt.on('disconnected', d => {
      appendLog(`[BT] disconnected: ${d?.address ?? ''}`);
      setConnectedAddr(null);
    });
    const offData = bt.on('data', (raw: string) => {
      // Raw ELM327 lines including '>' prompt; trim noisy CRLFs for readability
      const line = raw.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      appendLog(`[RX] ${line}`);
    });
    const offError = bt.on('error', e => appendLog(`[ERR] ${e.message}`));

    bt.ensurePermissions().then(() => bt.listDevices());

    return () => {
      offList();
      offState();
      offConnected();
      offDisconnected();
      offData();
      offError();
    };
  }, [bt]);

  useEffect(() => {
    if (debugVisible && scrollRef.current) {
      // Auto-scroll to bottom on new logs
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [logs, debugVisible]);

  const connect = async (addr: string) => {
    setConnecting(addr);
    appendLog(`[TX] Connect -> ${addr}`);
    try {
      // Use high-level client so ELM327 gets initialized and app connection state propagates.
      await client.connect(addr);
    } catch (e: any) {
      appendLog(`[ERR] Connect failed: ${e?.message ?? String(e)}`);
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async () => {
    appendLog(`[TX] Disconnect`);
    try {
      await client.disconnect();
    } catch (e: any) {
      appendLog(`[ERR] Disconnect failed: ${e?.message ?? String(e)}`);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isConnectedGlobal = state === 'connected';
    const isThisConnected = isConnectedGlobal && connectedAddr === item.address;
    const disableOther = isConnectedGlobal && !isThisConnected;

    // While connecting, disable all other rows except the one being connected
    const isThisConnecting = connecting === item.address;
    const disableDueToConnectInFlight = connecting !== null && !isThisConnecting;

    const disableConnectBtn = disableOther || disableDueToConnectInFlight;

    return (
      <View
        style={{
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderColor: colors.divider,
          opacity: disableOther ? 0.5 : 1,
        }}
      >
        <Text style={{ fontWeight: '600', color: colors.text }}>
          {item.name || item.address}
        </Text>
        <Text style={{ color: colors.sub }}>{item.address}</Text>

        {isThisConnected ? (
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.sub }}>Connected</Text>
            <Button title="Disconnect" onPress={disconnect} />
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            <Button
              title={isThisConnecting ? 'Connecting...' : 'Connect'}
              onPress={() => connect(item.address)}
              disabled={disableConnectBtn}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>
        Bluetooth Devices
      </Text>
      <Text style={{ color: colors.text, marginBottom: 8 }}>
        State: {state}{connectedAddr ? ` • ${connectedAddr}` : ''}
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button title="Refresh" onPress={() => bt.listDevices()} />
        <Button
          title={debugVisible ? 'Hide Debug' : 'Show Debug'}
          onPress={() => setDebugVisible(v => !v)}
        />
        {connectedAddr ? <Button title="Disconnect" onPress={disconnect} /> : null}
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.address}
        renderItem={renderItem}
      />

      {debugVisible ? (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: colors.divider }}>
          <Text style={{ color: colors.text, marginVertical: 8, fontWeight: '600' }}>
            Debug (raw Bluetooth)
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Button title="Clear" onPress={() => setLogs([])} />
            <Button title="Refresh Devices" onPress={() => bt.listDevices()} />
          </View>
          <View
            style={{
              height: 180,
              backgroundColor: colors.debugBg,
              borderWidth: 1,
              borderColor: colors.divider,
              borderRadius: 6,
              padding: 8,
            }}
          >
            <ScrollView ref={scrollRef}>
              {logs.map((l, i) => (
                <Text
                  key={i}
                  style={{ color: colors.debugText, fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }}
                >
                  {l}
                </Text>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}
