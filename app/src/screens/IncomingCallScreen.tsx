import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage } from '../api/client';
import { realtime } from '../api/realtime';
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
  const left = useRef(false);

  useEffect(() => {
    let socket: any;
    let mounted = true;

    api
      .get(`/calls/${callId}`)
      .then((response) => {
        if (!mounted) return;
        setCall(response.data);
        const st = response.data?.status;
        if (st === 'ACCEPTED' || st === 'CONNECTING' || st === 'ACTIVE') {
          left.current = true;
          navigation.replace('ActiveCall', {
            callId,
            title:
              response.data?.caller?.profile?.displayName ??
              response.data?.peerNames?.caller ??
              'Voice call',
            callType: response.data?.callType,
          });
        }
      })
      .catch(() => navigation.goBack());

    const onCancelled = (payload: any) => {
      if (payload?.id === callId && !left.current) {
        left.current = true;
        Alert.alert('Call cancelled');
        navigation.goBack();
      }
    };
    const onEnded = (payload: any) => {
      if (payload?.id === callId && !left.current) {
        left.current = true;
        navigation.goBack();
      }
    };

    void realtime().then((value) => {
      socket = value;
      socket?.on('call:cancelled', onCancelled);
      socket?.on('call:ended', onEnded);
      socket?.on('call:rejected', onEnded);
    });

    return () => {
      mounted = false;
      socket?.off('call:cancelled', onCancelled);
      socket?.off('call:ended', onEnded);
      socket?.off('call:rejected', onEnded);
    };
  }, [callId, navigation]);

  const respond = async (action: 'accept' | 'reject') => {
    if (busy || left.current) return;
    try {
      setBusy(true);
      const { data } = await api.post(`/calls/${callId}/${action}`);
      if (action === 'accept') {
        left.current = true;
        // Server also emits call:accepted to the caller so both join together.
        navigation.replace('ActiveCall', {
          callId,
          title:
            data?.caller?.profile?.displayName ??
            call?.caller?.profile?.displayName ??
            'Voice call',
          callType: data?.callType ?? call?.callType,
        });
      } else {
        left.current = true;
        navigation.goBack();
      }
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

  const caller =
    call?.caller?.profile?.displayName ??
    call?.peerNames?.caller ??
    'A member';
  const kind = call?.callType === 'VIDEO' ? 'VIDEO' : 'VOICE';

  return (
    <Screen>
      <View style={styles.pulseRing}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>INCOMING {kind} CALL</Text>
          <Avatar name={caller} size={120} online />
          <Text style={styles.name}>{caller}</Text>
          <Text style={styles.meta}>
            {call?.ratePerMinute ?? 0} pts/min · answer to talk live
          </Text>
        </View>
      </View>
      <Card>
        <Text style={styles.notice}>
          Accept to join the same voice/video room together. Billing starts only
          after both of you connect.
        </Text>
      </Card>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Decline"
            variant="danger"
            disabled={busy}
            onPress={() => void respond('reject')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Accept"
            loading={busy}
            onPress={() => void respond('accept')}
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
