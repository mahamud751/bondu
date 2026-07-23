import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, apiErrorMessage } from '../api/client';
import { Eyebrow, Screen, Title } from '../components/UI';
import { colors, spacing } from '../theme';

const SCOPES = [
  { key: 'wealth', label: 'Wealth' },
  { key: 'charm', label: 'Charm' },
  { key: 'host', label: 'Host' },
  { key: 'gifts', label: 'Gifts 7d' },
] as const;

export function LeaderboardScreen() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]['key']>('wealth');
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [lb, ev] = await Promise.all([
        api.get('/leaderboards', { params: { scope, limit: 30 } }),
        api.get('/events'),
      ]);
      setRows(lb.data);
      setEvents(ev.data);
    } catch (error: any) {
      Alert.alert('Could not load', apiErrorMessage(error, 'Try again'));
    }
  }, [scope]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen scroll>
      <Eyebrow>SEASON</Eyebrow>
      <Title subtitle="Transparent ranks — no pay-to-rank dark patterns">
        Leaderboards
      </Title>

      {events[0] ? (
        <View style={styles.event}>
          <Text style={styles.eventTitle}>{events[0].title}</Text>
          <Text style={styles.eventBody}>{events[0].description}</Text>
          <Text style={styles.eventMeta}>
            Gift bonus +{events[0].giftBonusPct}% · ends{' '}
            {new Date(events[0].endsAt).toLocaleDateString()}
          </Text>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {SCOPES.map((item) => {
          const active = scope === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setScope(item.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {rows.map((row) => (
        <View key={`${row.userId}-${row.rank}`} style={styles.row}>
          <Text style={styles.rank}>#{row.rank}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {row.displayName}
              {row.isVerified ? ' ✓' : ''}
            </Text>
            {row.level ? (
              <Text style={styles.meta}>Level {row.level}</Text>
            ) : null}
          </View>
          <Text style={styles.score}>{row.score}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  event: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventTitle: { color: colors.gold, fontWeight: '900', fontSize: 15 },
  eventBody: { color: colors.muted, marginTop: 4, fontSize: 12 },
  eventMeta: {
    color: colors.textSoft,
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rank: {
    width: 40,
    color: colors.gold,
    fontWeight: '900',
    fontSize: 14,
  },
  name: { color: colors.text, fontWeight: '800', fontSize: 14 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  score: { color: colors.primary, fontWeight: '900', fontSize: 14 },
});
