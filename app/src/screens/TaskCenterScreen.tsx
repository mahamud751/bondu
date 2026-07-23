import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, apiErrorMessage } from '../api/client';
import { Button, Screen, Title, Eyebrow } from '../components/UI';
import { colors, spacing } from '../theme';

type Task = {
  code: string;
  title: string;
  description: string;
  rewardPoints: number;
  period: string;
  targetCount: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

type Levels = {
  wealthLevel: number;
  charmLevel: number;
  hostLevel: number;
  wealthXp: number;
  charmXp: number;
  hostXp: number;
};

export function TaskCenterScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [levels, setLevels] = useState<Levels | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        api.get('/tasks'),
        api.get('/levels/me'),
      ]);
      setTasks(t.data);
      setLevels(l.data);
    } catch (error: any) {
      Alert.alert('Could not load tasks', apiErrorMessage(error, 'Try again'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const claim = async (code: string) => {
    try {
      setClaiming(code);
      const { data } = await api.post('/tasks/claim', { code });
      Alert.alert('Reward claimed', `+${data.amount} points`);
      await load();
    } catch (error: any) {
      Alert.alert('Could not claim', apiErrorMessage(error, 'Try again'));
    } finally {
      setClaiming(undefined);
    }
  };

  return (
    <Screen scroll>
      <Eyebrow>BETTER THAN BIGO</Eyebrow>
      <Title subtitle="Daily & weekly quests with transparent rewards">
        Task Center
      </Title>
      <Button title={loading ? 'Refreshing…' : 'Refresh'} onPress={load} />

      {levels ? (
        <View style={styles.levelRow}>
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>Wealth</Text>
            <Text style={styles.levelValue}>Lv {levels.wealthLevel}</Text>
            <Text style={styles.levelXp}>{levels.wealthXp} XP</Text>
          </View>
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>Charm</Text>
            <Text style={styles.levelValue}>Lv {levels.charmLevel}</Text>
            <Text style={styles.levelXp}>{levels.charmXp} XP</Text>
          </View>
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>Host</Text>
            <Text style={styles.levelValue}>Lv {levels.hostLevel}</Text>
            <Text style={styles.levelXp}>{levels.hostXp} XP</Text>
          </View>
        </View>
      ) : null}

      {tasks.map((task) => {
        const pct = Math.min(
          100,
          Math.round((task.progress / Math.max(1, task.targetCount)) * 100),
        );
        return (
          <View key={task.code} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <Text style={styles.cardBody}>{task.description}</Text>
                <Text style={styles.meta}>
                  {task.period} · {task.progress}/{task.targetCount} · +
                  {task.rewardPoints} pts
                </Text>
              </View>
              {task.claimed ? (
                <Text style={styles.done}>Done</Text>
              ) : task.completed ? (
                <Pressable
                  style={styles.claimBtn}
                  disabled={claiming === task.code}
                  onPress={() => void claim(task.code)}
                >
                  <Text style={styles.claimText}>
                    {claiming === task.code ? '…' : 'Claim'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.progressPct}>{pct}%</Text>
              )}
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  levelCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  levelValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  levelXp: { color: colors.gold, fontSize: 11, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  cardBody: { color: colors.muted, fontSize: 12, marginTop: 2 },
  meta: { color: colors.textSoft, fontSize: 11, fontWeight: '600', marginTop: 6 },
  claimBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  done: { color: colors.success, fontWeight: '800' },
  progressPct: { color: colors.muted, fontWeight: '800' },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
});
