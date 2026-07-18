// @ts-nocheck
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import {
  Card,
  EmptyState,
  Eyebrow,
  Metric,
  Pill,
  Screen,
  SectionTitle,
  Title,
} from '../components/UI';
import { colors, radius, shadow, spacing } from '../theme';

const icon: Record<string, string> = {
  DEPOSIT: '＋',
  PACKAGE_PURCHASE: '◫',
  GIFT_PURCHASE: '♥',
  CALL_CHARGE: '◉',
  CHAT_CHARGE: '✉',
  VENDOR_EARNING: '↗',
  WITHDRAWAL: '↙',
  PROMOTIONAL_BONUS: '✦',
  RELEASE: '✓',
};

export function WalletScreen() {
  const [wallet, setWallet] = useState<any>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([api.get('/wallet'), api.get('/wallet/transactions')])
      .then(([w, l]) => {
        setWallet(w.data);
        setTransactions(l.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const available =
    (wallet?.purchased ?? 0) + (wallet?.promotional ?? 0) - (wallet?.reserved ?? 0);

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Eyebrow>Balance</Eyebrow>
            <Title subtitle="Points power every call, message and gift">
              Wallet
            </Title>

            <View style={styles.balanceCard}>
              <View style={styles.glow} />
              <Text style={styles.balanceLabel}>Available points</Text>
              <Text style={styles.balance}>{available.toLocaleString()}</Text>
              <View style={styles.balanceMeta}>
                <Text style={styles.metaText}>Buy {wallet?.purchased ?? 0}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>Bonus {wallet?.promotional ?? 0}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>Held {wallet?.reserved ?? 0}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
                onPress={() => navigation.navigate('AddMoney')}
              >
                <Text style={styles.addText}>＋  Add points</Text>
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {[
                { icon: '◫', label: 'Packages', route: 'Packages' },
                { icon: '◇', label: 'Gift cards', route: 'GiftCards' },
                { icon: '✦', label: 'Digital gifts', route: 'DigitalGifts' },
                { icon: '↗', label: 'Earnings', route: 'VendorDashboard' },
              ].map((a) => (
                <Pressable
                  key={a.route}
                  style={styles.action}
                  onPress={() => navigation.navigate(a.route)}
                >
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                  <Text style={styles.actionText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            <SectionTitle>Creator earnings</SectionTitle>
            <Card style={styles.metrics}>
              <Metric label="Pending" value={wallet?.pendingEarning ?? 0} tone="gold" />
              <Metric label="Available" value={wallet?.availableEarning ?? 0} tone="success" />
              <Metric label="On hold" value={wallet?.held ?? 0} />
            </Card>

            <SectionTitle>Activity</SectionTitle>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="◇"
              title="No activity yet"
              body="Deposits, calls and gifts will show up here."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const credit = item.direction === 'CREDIT';
          return (
            <View style={styles.tx}>
              <View style={[styles.txIcon, credit ? styles.credit : styles.debit]}>
                <Text
                  style={{
                    color: credit ? colors.success : colors.primary,
                    fontWeight: '800',
                  }}
                >
                  {icon[item.type] ?? '•'}
                </Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(item.createdAt).toLocaleDateString()} ·{' '}
                  {item.type.replaceAll('_', ' ').toLowerCase()}
                </Text>
              </View>
              <View style={styles.amountWrap}>
                <Text
                  style={[
                    styles.amount,
                    { color: credit ? colors.success : colors.text },
                  ]}
                >
                  {credit ? '+' : '−'}
                  {item.amount}
                </Text>
                <Pill
                  label={credit ? 'In' : 'Out'}
                  tone={credit ? 'success' : 'neutral'}
                />
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.xl,
    paddingBottom: 140,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.25)',
    ...shadow,
  },
  glow: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 77, 109, 0.2)',
  },
  balanceLabel: {
    color: colors.textSoft,
    fontWeight: '600',
    fontSize: 13,
  },
  balance: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -1.5,
  },
  balanceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: colors.muted,
  },
  addBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 22,
  },
  addText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    color: colors.primary,
    fontSize: 20,
  },
  actionText: {
    color: colors.textSoft,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 8,
  },
  metrics: {
    flexDirection: 'row',
  },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: {
    backgroundColor: colors.successSoft,
  },
  debit: {
    backgroundColor: colors.primaryMuted,
  },
  txInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  txTitle: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  txDate: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontWeight: '800',
    fontSize: 15,
  },
});
