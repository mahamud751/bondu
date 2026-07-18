// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage } from '../api/client';
import { Avatar, Button, Card, Screen } from '../components/UI';
import { colors, radius, spacing } from '../theme';

export function IncomingCallScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { callId } = route.params;
  const [call, setCall] = useState<any>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/calls/${callId}`)
      .then((response) => setCall(response.data))
      .catch(() => navigation.goBack());
  }, [callId, navigation]);

  const respond = async (action: 'accept' | 'reject') => {
    try {
      setBusy(true);
      await api.post(`/calls/${callId}/${action}`);
      if (action === 'accept')
        navigation.replace('ActiveCall', {
          callId,
          title: call?.callType === 'VIDEO' ? 'Video call' : 'Voice call',
        });
      else navigation.goBack();
    } catch (error: any) {
      Alert.alert(
        'Call unavailable',
        apiErrorMessage(error, 'This request may have ended.'),
      );
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const caller = call?.caller?.profile?.displayName ?? 'A member';

  return (
    <Screen>
      <View style={styles.pulseRing}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            INCOMING {call?.callType ?? 'CALL'}
          </Text>
          <Avatar name={caller} size={120} online />
          <Text style={styles.name}>{caller}</Text>
          <Text style={styles.meta}>
            {call?.ratePerMinute ?? 0} pts/min · secured by server
          </Text>
        </View>
      </View>
      <Card>
        <Text style={styles.notice}>
          Billing starts only after both of you connect. Earnings and commission
          are calculated securely on the server.
        </Text>
      </Card>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Decline"
            variant="danger"
            disabled={busy}
            onPress={() => respond('reject')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Accept"
            loading={busy}
            onPress={() => respond('accept')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.2)',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 28,
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 22,
    letterSpacing: -0.5,
  },
  meta: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 14,
  },
  notice: {
    color: colors.textSoft,
    lineHeight: 21,
    textAlign: 'center',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  flex: {
    flex: 1,
  },
});
