import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage } from '../api/client';
import { realtime } from '../api/realtime';
import { Avatar, Button, Screen } from '../components/UI';
import { colors, radius, spacing } from '../theme';

/**
 * Caller-side ringing UI (Messenger-style).
 * Stays open until the other party accepts, rejects, or the caller cancels.
 * On accept both sides navigate into ActiveCall and join the same RTC room.
 */
export function OutgoingCallScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const {
    callId,
    title = 'Calling…',
    callType = 'VOICE',
  } = route.params ?? {};
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ringing…');
  const left = useRef(false);

  useEffect(() => {
    let socket: any;
    let mounted = true;

    const goActive = (payload?: any) => {
      if (left.current || !mounted) return;
      left.current = true;
      const peer =
        payload?.peerNames?.vendor ??
        payload?.vendor?.user?.profile?.displayName ??
        title;
      navigation.replace('ActiveCall', {
        callId,
        title: peer,
        callType: payload?.callType ?? callType,
      });
    };

    const hangup = (reason: string) => {
      if (left.current || !mounted) return;
      left.current = true;
      Alert.alert(reason);
      navigation.goBack();
    };

    const onAccepted = (payload: any) => {
      if (payload?.id === callId || payload?.callId === callId) goActive(payload);
    };
    const onRejected = (payload: any) => {
      if (payload?.id === callId) hangup('Call declined');
    };
    const onCancelled = (payload: any) => {
      if (payload?.id === callId) hangup('Call cancelled');
    };
    const onEnded = (payload: any) => {
      if (payload?.id === callId) hangup('Call ended');
    };

    void realtime().then((value) => {
      socket = value;
      socket?.on('call:accepted', onAccepted);
      socket?.on('call:rejected', onRejected);
      socket?.on('call:cancelled', onCancelled);
      socket?.on('call:ended', onEnded);
    });

    // If auto-accept already flipped the call to ACCEPTED before this screen mounted,
    // poll once so the caller still joins.
    void api
      .get(`/calls/${callId}`)
      .then((response) => {
        if (!mounted || left.current) return;
        const st = response.data?.status;
        if (st === 'ACCEPTED' || st === 'CONNECTING' || st === 'ACTIVE') {
          goActive(response.data);
        } else if (
          ['REJECTED', 'CANCELLED', 'FAILED', 'COMPLETED', 'TERMINATED', 'MISSED'].includes(
            st,
          )
        ) {
          hangup('Call is no longer available');
        }
      })
      .catch(() => undefined);

    const pulse = setInterval(() => {
      if (!mounted) return;
      setStatus((s) => (s.endsWith('…') ? s : 'Ringing…'));
    }, 1200);

    return () => {
      mounted = false;
      clearInterval(pulse);
      socket?.off('call:accepted', onAccepted);
      socket?.off('call:rejected', onRejected);
      socket?.off('call:cancelled', onCancelled);
      socket?.off('call:ended', onEnded);
    };
  }, [callId, callType, navigation, title]);

  const cancel = async () => {
    if (busy || left.current) return;
    try {
      setBusy(true);
      await api.post(`/calls/${callId}/cancel`);
      left.current = true;
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not cancel', apiErrorMessage(error, 'Try again'));
      left.current = true;
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          OUTGOING {callType === 'VIDEO' ? 'VIDEO' : 'VOICE'} CALL
        </Text>
        <Avatar name={title} size={120} online />
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.meta}>{status}</Text>
        <Text style={styles.hint}>
          Waiting for them to answer. You will both join the same room when
          accepted.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Cancel"
          variant="danger"
          loading={busy}
          onPress={() => void cancel()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(160, 32, 240, 0.25)',
    paddingHorizontal: 20,
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
    fontSize: 28,
    fontWeight: '800',
    marginTop: 22,
  },
  meta: {
    color: colors.muted,
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: colors.textSoft,
    marginTop: 18,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actions: {
    marginTop: 28,
  },
});
