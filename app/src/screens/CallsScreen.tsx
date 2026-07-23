// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api, apiErrorMessage } from '../api/client';
import { realtime } from '../api/realtime';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Pill,
  Screen,
  Title,
} from '../components/UI';
import { colors, spacing } from '../theme';

export function CallsScreen() {
  const [calls, setCalls] = useState<any[]>([]);
  const [me, setMe] = useState<any>();
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([api.get('/calls/history'), api.get('/users/me')])
      .then(([history, user]) => {
        setCalls(history.data);
        setMe(user.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let client: any;
    const refresh = () => void load();
    void realtime().then((value) => {
      client = value;
      for (const event of [
        'call:accepted',
        'call:rejected',
        'call:cancelled',
        'call:connected',
        'call:ended',
      ])
        client?.on(event, refresh);
    });
    return () => {
      for (const event of [
        'call:accepted',
        'call:rejected',
        'call:cancelled',
        'call:connected',
        'call:ended',
      ])
        client?.off(event, refresh);
    };
  }, [load]);

  const callTitle = (item: any) => {
    const peer =
      item.vendor?.user?.profile?.displayName ??
      item.caller?.profile?.displayName ??
      (item.callType === 'VIDEO' ? 'Video call' : 'Voice call');
    return peer;
  };

  const act = async (item: any, action: 'accept' | 'reject' | 'cancel') => {
    try {
      await api.post(`/calls/${item.id}/${action}`);
      if (action === 'accept')
        navigation.navigate('ActiveCall', {
          callId: item.id,
          title: callTitle(item),
          callType: item.callType,
        });
      else void load();
    } catch (error: any) {
      Alert.alert(
        'Could not update call',
        apiErrorMessage(error, 'Try again'),
      );
    }
  };

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Eyebrow>Voice & video</Eyebrow>
            <Title subtitle="Private calls, billed securely by the second">
              Calls
            </Title>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="◉"
              title="No calls yet"
              body="Open a profile and request your first voice conversation."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isVendor = item.vendor?.userId === me?.id;
          const active = ['ACCEPTED', 'CONNECTING', 'ACTIVE'].includes(
            item.status,
          );
          const name = callTitle(item);
          const completed = item.status === 'COMPLETED';
          const kind = item.callType === 'VIDEO' ? 'Video' : 'Voice';
          return (
            <Card>
              <View style={styles.row}>
                <Avatar name={name} size={54} online={active} />
                <View style={styles.info}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>
                    {kind} · {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Pill
                  label={item.status.replaceAll('_', ' ')}
                  tone={
                    completed ? 'success' : active ? 'primary' : 'neutral'
                  }
                />
              </View>
              {completed ? (
                <View style={styles.summary}>
                  <View>
                    <Text style={styles.value}>
                      {Math.ceil((item.billedSeconds ?? 0) / 60)} min
                    </Text>
                    <Text style={styles.label}>Billed</Text>
                  </View>
                  <View>
                    <Text style={styles.value}>{item.grossAmount ?? 0} pts</Text>
                    <Text style={styles.label}>Charge</Text>
                  </View>
                </View>
              ) : null}
              {item.status === 'REQUESTED' ? (
                isVendor ? (
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button
                        title="Decline"
                        variant="ghost"
                        onPress={() => act(item, 'reject')}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title="Accept"
                        onPress={() => act(item, 'accept')}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    title="Cancel request"
                    variant="ghost"
                    onPress={() => act(item, 'cancel')}
                  />
                )
              ) : null}
              {active ? (
                <Button
                  title={
                    item.status === 'ACTIVE'
                      ? 'Return to call'
                      : `Join ${item.callType === 'VIDEO' ? 'video' : 'voice'} call`
                  }
                  icon="◉"
                  onPress={() =>
                    navigation.navigate('ActiveCall', {
                      callId: item.id,
                      title: name,
                      callType: item.callType,
                    })
                  }
                />
              ) : null}
            </Card>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 16,
    paddingTop: 14,
  },
  value: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flex: {
    flex: 1,
  },
});
