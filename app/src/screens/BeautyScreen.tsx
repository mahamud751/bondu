import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, apiErrorMessage } from '../api/client';
import { Button, Eyebrow, Screen, Title } from '../components/UI';
import { colors, spacing } from '../theme';

const FILTERS = ['natural', 'soft', 'warm', 'cool', 'glow'];

export function BeautyScreen() {
  const [preset, setPreset] = useState({
    smooth: 40,
    whiten: 20,
    slim: 10,
    bigEye: 0,
    filterId: 'natural',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/beauty/me');
      setPreset({
        smooth: data.smooth ?? 40,
        whiten: data.whiten ?? 20,
        slim: data.slim ?? 10,
        bigEye: data.bigEye ?? 0,
        filterId: data.filterId ?? 'natural',
      });
    } catch (error: any) {
      Alert.alert('Could not load beauty preset', apiErrorMessage(error, 'Try again'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bump = (key: keyof typeof preset, delta: number) => {
    if (key === 'filterId') return;
    setPreset((p) => ({
      ...p,
      [key]: Math.min(100, Math.max(0, (p[key] as number) + delta)),
    }));
  };

  const save = async () => {
    try {
      setSaving(true);
      await api.post('/beauty/me', preset);
      Alert.alert('Saved', 'Beauty memory will apply next time you go live.');
    } catch (error: any) {
      Alert.alert('Could not save', apiErrorMessage(error, 'Try again'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Eyebrow>CAMERA READY</Eyebrow>
      <Title subtitle="Makeup memory — set once, reuse every stream">
        Beauty presets
      </Title>

      {(['smooth', 'whiten', 'slim', 'bigEye'] as const).map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{key}</Text>
          <Pressable style={styles.btn} onPress={() => bump(key, -5)}>
            <Text style={styles.btnText}>−</Text>
          </Pressable>
          <Text style={styles.value}>{preset[key]}</Text>
          <Pressable style={styles.btn} onPress={() => bump(key, 5)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>Filter</Text>
      <View style={styles.filters}>
        {FILTERS.map((id) => {
          const active = preset.filterId === id;
          return (
            <Pressable
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPreset((p) => ({ ...p, filterId: id }))}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {id}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button title={saving ? 'Saving…' : 'Save beauty memory'} onPress={save} />
      <Text style={styles.hint}>
        On devices with Agora beauty extensions, these values drive the camera
        pipeline. Until then they store your preferred look for live start.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  value: {
    width: 48,
    textAlign: 'center',
    color: colors.gold,
    fontWeight: '900',
  },
  section: {
    color: colors.textSoft,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 14, lineHeight: 18 },
});
