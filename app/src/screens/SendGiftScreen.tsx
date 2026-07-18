import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, apiErrorMessage } from '../api/client';
import { Avatar, Button, Card, EmptyState, Field, Screen, Title } from '../components/UI';
import { colors, radius, spacing } from '../theme';

export function SendGiftScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { gift, recipientId: initialId, recipientName: initialName } = route.params ?? {};
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<{ id: string; name: string } | undefined>(
    initialId ? { id: initialId, name: initialName ?? 'Creator' } : undefined,
  );
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);

  const search = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }
    try {
      setSearching(true);
      const { data } = await api.get('/social/discover', { params: { query: text, vendor: 'true', limit: 15 } });
      setResults(data);
    } catch { /* ignore transient search errors */ }
    finally { setSearching(false); }
  };

  const send = async () => {
    if (!recipient) return;
    try {
      setSending(true);
      for (let i = 0; i < quantity; i += 1) {
        await api.post(`/gifts/${gift.id}/send`, {
          receiverId: recipient.id,
          idempotencyKey: `mobile-${Date.now()}-${i}-${Math.random()}`,
        });
      }
      Alert.alert('Gift sent', `${gift.name} × ${quantity} delivered to ${recipient.name}.`);
      navigation.goBack();
    } catch (error: unknown) {
      Alert.alert('Could not send gift', apiErrorMessage(error, 'Try again'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll>
      <Title subtitle={`Send a gift to ${recipient?.name ?? 'a creator'}`}>Send {gift?.name}</Title>

      <Card style={styles.giftCard}>
        <Text style={styles.giftIcon}>{gift?.iconUrl}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.giftName}>{gift?.name}</Text>
          <Text style={styles.giftPrice}>{gift?.pointPrice} pts each</Text>
        </View>
      </Card>

      {recipient ? (
        <Card style={styles.recipientCard}>
          <Avatar name={recipient.name} size={44} />
          <Text style={styles.recipientName}>{recipient.name}</Text>
          <Pressable onPress={() => setRecipient(undefined)}>
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <Field placeholder="Search a creator by name or @username" value={query} onChangeText={search} />
          {results.length ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setRecipient({ id: item.id, name: item.profile?.displayName ?? 'Creator' }); setResults([]); setQuery(''); }}
                >
                  <Card style={styles.resultRow}>
                    <Avatar name={item.profile?.displayName} size={40} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.resultName}>{item.profile?.displayName}</Text>
                      <Text style={styles.resultHandle}>@{item.profile?.username}</Text>
                    </View>
                  </Card>
                </Pressable>
              )}
              ListEmptyComponent={
                searching ? null : (
                  <EmptyState icon="⌕" title="No creators found" body="Try a different name or username." />
                )
              }
            />
          ) : null}
        </>
      )}

      {recipient ? (
        <>
          <Text style={styles.sectionLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => Math.min(99, q + 1))}>
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>

          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{(gift?.pointPrice ?? 0) * quantity} pts</Text>
          </Card>

          <Button title="Send" loading={sending} onPress={send} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  giftCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  giftIcon: { fontSize: 34 },
  giftName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  giftPrice: { color: colors.muted, fontSize: 12, marginTop: 2 },
  recipientCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipientName: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 },
  changeLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  resultName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  resultHandle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionLabel: { color: colors.text, fontWeight: '800', fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20, alignSelf: 'flex-start' },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepperValue: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  totalLabel: { color: colors.muted, fontWeight: '700' },
  totalValue: { color: colors.primaryDark, fontWeight: '900', fontSize: 18 },
});
