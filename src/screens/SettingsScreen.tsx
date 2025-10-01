import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import LiveDataManager from '../services/LiveDataManager';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    bg: isDark ? '#0B0F13' : '#FFFFFF',
    text: isDark ? '#E6EDF3' : '#111111',
    border: isDark ? '#2B3138' : '#CCCCCC',
    inputBg: isDark ? '#12161B' : '#FFFFFF',
  } as const;
  const live = LiveDataManager.getInstance();
  const [interval, setInterval] = useState('200');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 20, marginBottom: 8, color: colors.text }}>Settings</Text>
        <Text style={{ color: colors.text }}>Sample interval (ms)</Text>
        <TextInput
          value={interval}
          onChangeText={(t) => { setInterval(t); const v = parseInt(t, 10); if (!Number.isNaN(v)) live.setSampleInterval(v); }}
          keyboardType="numeric"
          placeholder="200"
          placeholderTextColor={isDark ? '#7A8694' : '#999999'}
          style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, padding: 8, borderRadius: 6, width: 200 }}
        />
      </ScrollView>
    </View>
  );
}
