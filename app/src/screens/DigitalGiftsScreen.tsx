import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { Card, EmptyState, Eyebrow, Screen, Title } from '../components/UI';
import { colors, radius, shadowSm, spacing } from '../theme';

export function DigitalGiftsScreen() {
  const navigation = useNavigation<any>();
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    api.get('/gifts').then(({ data }) => setGifts(data)).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const found = [...new Set(gifts.map((g: any) => g.category))].sort();
    return ['ALL', ...found];
  }, [gifts]);

  const visible = category === 'ALL' ? gifts : gifts.filter((g: any) => g.category === category);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Eyebrow>SEND SOMETHING SPECIAL</Eyebrow>
        <Title subtitle="Digital gifts support your favorite creators in real time">
          Digital gifts
        </Title>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map((c) => {
            const active = c === category;
            return (
              <Pressable key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visible.length ? (
          <View style={styles.grid}>
            {visible.map((gift: any) => (
              <Pressable
                key={gift.id}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
                onPress={() => navigation.navigate('SendGift', { gift })}
              >
                <Card style={styles.tileCard}>
                  <Text style={styles.tileIcon}>{gift.iconUrl}</Text>
                  <Text style={styles.tileName} numberOfLines={1}>{gift.name}</Text>
                  <Text style={styles.tilePrice}>{gift.pointPrice} pts</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : !loading ? (
          <EmptyState icon="✦" title="No gifts here yet" body="Check back soon for new digital gifts." />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120 },
  chips: { gap: 8, paddingVertical: spacing.md },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: spacing.sm },
  tile: { width: '31%' },
  tileCard: { alignItems: 'center', paddingVertical: 18, marginBottom: 0, ...shadowSm },
  tileIcon: { fontSize: 30, marginBottom: 8 },
  tileName: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  tilePrice: { color: colors.primaryDark, fontWeight: '800', fontSize: 12, marginTop: 4 },
});
