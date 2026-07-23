import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
  IRtcEngineEventHandler,
  RtcSurfaceView,
} from 'react-native-agora';
import { api, apiErrorMessage } from '../api/client';
import { realtime } from '../api/realtime';
import { Avatar } from '../components/UI';
import { colors } from '../theme';

type GiftItem = {
  id: string;
  name: string;
  iconUrl: string;
  pointPrice: number;
  enabledInLive?: boolean;
};

type GiftEvent = {
  gift?: string;
  giftIcon?: string;
  senderName?: string;
  pointPrice?: number;
};

export function LiveViewScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { liveId } = route.params;
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const left = useRef(false);
  const [status, setStatus] = useState('Connecting…');
  const [provider, setProvider] = useState('');
  const [host, setHost] = useState<any>();
  const [remoteUid, setRemoteUid] = useState<number>();
  const [viewerCount, setViewerCount] = useState(0);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [giftEvent, setGiftEvent] = useState<GiftEvent>();
  const [sendingGiftId, setSendingGiftId] = useState<string>();
  const [giftFeed, setGiftFeed] = useState<GiftEvent[]>([]);

  const leave = async (reason?: string) => {
    if (left.current) return;
    left.current = true;
    engine.current?.leaveChannel();
    engine.current?.release();
    engine.current = undefined;
    const socket = await realtime();
    socket?.emit('live:unwatch', { liveId });
    try {
      await api.post(`/live/${liveId}/leave`);
    } catch {
      /* leave best-effort */
    }
    if (reason) Alert.alert(reason);
    navigation.goBack();
  };

  useEffect(() => {
    let mounted = true;
    let socket: any;
    const pushGift = (event: GiftEvent) => {
      setGiftEvent(event);
      setGiftFeed((prev) => [event, ...prev].slice(0, 6));
      setTimeout(() => {
        if (mounted) setGiftEvent((current) => (current === event ? undefined : current));
      }, 2800);
    };
    const giftHandler = (event: GiftEvent) => pushGift(event);
    const viewerHandler = (payload: { liveId: string; viewerCount: number }) => {
      if (payload.liveId === liveId) setViewerCount(payload.viewerCount);
    };
    const endedHandler = (payload: { liveId: string }) => {
      if (payload.liveId === liveId) void leave('This stream has ended');
    };
    const connect = async () => {
      try {
        const { data: access } = await api.post(`/live/${liveId}/join`);
        if (!mounted) return;
        setHost(access.host);
        setProvider(access.provider);
        setViewerCount(access.viewerCount ?? 0);
        setStatus(access.provider === 'AGORA' ? 'Waiting for host…' : 'Development live simulation');
        void api.get('/gifts').then((response) =>
          setGifts(
            response.data.filter(
              (item: GiftItem) => item.enabledInLive !== false,
            ),
          ),
        );
        socket = await realtime();
        socket?.emit('live:watch', { liveId });
        socket?.on('live:viewer-count', viewerHandler);
        socket?.on('live:ended', endedHandler);
        socket?.on('gift:animation', giftHandler);
        if (access.provider === 'AGORA') {
          const rtc = createAgoraRtcEngine();
          engine.current = rtc;
          rtc.initialize({
            appId: access.appId,
            channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          });
          rtc.enableVideo();
          rtc.setClientRole(ClientRoleType.ClientRoleAudience);
          const handler: IRtcEngineEventHandler = {
            onUserJoined: (_connection, uid) => {
              if (mounted) {
                setRemoteUid(uid);
                setStatus('Live');
              }
            },
            onUserOffline: () => {
              if (mounted) setStatus('Host disconnected');
            },
          };
          rtc.registerEventHandler(handler);
          const result = rtc.joinChannelWithUserAccount(
            access.token,
            access.channelName,
            access.userAccount,
            {
              autoSubscribeAudio: true,
              autoSubscribeVideo: true,
              publishMicrophoneTrack: false,
              publishCameraTrack: false,
              clientRoleType: ClientRoleType.ClientRoleAudience,
            },
          );
          if (result < 0) throw new Error(`Agora join failed (${result})`);
        }
      } catch (error: any) {
        Alert.alert('Could not join stream', apiErrorMessage(error, 'Try again'));
        navigation.goBack();
      }
    };
    void connect();
    return () => {
      mounted = false;
      socket?.off('live:viewer-count', viewerHandler);
      socket?.off('live:ended', endedHandler);
      socket?.off('gift:animation', giftHandler);
      if (!left.current) void leave();
    };
  }, [liveId]);

  const sendGift = async (gift: GiftItem) => {
    const hostUserId = host?.userId;
    if (!hostUserId) {
      Alert.alert('Gift not sent', 'Host is still connecting. Try again in a moment.');
      return;
    }
    if (sendingGiftId) return;
    try {
      setSendingGiftId(gift.id);
      await api.post(`/gifts/${gift.id}/send`, {
        receiverId: hostUserId,
        liveId,
        idempotencyKey: `live-${liveId}-${Date.now()}-${Math.random()}`,
      });
    } catch (error: any) {
      Alert.alert('Gift not sent', apiErrorMessage(error, 'Try again'));
    } finally {
      setSendingGiftId(undefined);
    }
  };

  return (
    <View style={styles.stage}>
      {provider === 'AGORA' && remoteUid ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{ uid: remoteUid }}
        />
      ) : (
        <View style={styles.waiting}>
          <Avatar name={host?.displayName} size={96} />
          <Text style={styles.waitingText}>{status}</Text>
          {provider === 'DEVELOPMENT' ? (
            <Text style={styles.devHint}>Simulated live · gifts still charge points</Text>
          ) : null}
        </View>
      )}

      {giftEvent ? (
        <View style={styles.giftEvent}>
          <Text style={styles.giftEventIcon}>{giftEvent.giftIcon || '✦'}</Text>
          <Text style={styles.giftEventSender}>{giftEvent.senderName || 'Someone'}</Text>
          <Text style={styles.giftEventText}>sent {giftEvent.gift}</Text>
          {giftEvent.pointPrice ? (
            <Text style={styles.giftEventPts}>{giftEvent.pointPrice} pts</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.top}>
        <View style={styles.hostChip}>
          <Text style={styles.hostName} numberOfLines={1}>
            {host?.displayName ?? 'Streaming'}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerBadgeText}>◉ {viewerCount}</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={() => void leave()}>
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      {giftFeed.length > 0 ? (
        <View style={styles.feed}>
          {giftFeed.slice(0, 3).map((item, index) => (
            <View key={`${item.gift}-${index}`} style={styles.feedRow}>
              <Text style={styles.feedText} numberOfLines={1}>
                {item.giftIcon || '✦'} {item.senderName || 'Someone'} sent {item.gift}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.giftBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gifts}
        >
          {gifts.slice(0, 12).map((gift) => {
            const busy = sendingGiftId === gift.id;
            return (
              <Pressable
                key={gift.id}
                style={[styles.gift, busy && styles.giftBusy]}
                disabled={!!sendingGiftId}
                onPress={() => void sendGift(gift)}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.giftIcon}>{gift.iconUrl}</Text>
                    <Text style={styles.giftCost}>{gift.pointPrice}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000' },
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  waitingText: { color: colors.textSoft, fontSize: 14 },
  devHint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  giftEvent: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(22,17,31,.92)',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    minWidth: 180,
  },
  giftEventIcon: { color: colors.gold, fontSize: 40 },
  giftEventSender: {
    color: colors.white,
    fontWeight: '800',
    marginTop: 8,
    fontSize: 15,
  },
  giftEventText: { color: colors.textSoft, fontWeight: '700', marginTop: 2 },
  giftEventPts: {
    color: colors.gold,
    fontWeight: '900',
    marginTop: 6,
    fontSize: 12,
  },
  top: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostChip: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hostName: { color: colors.white, fontWeight: '700', fontSize: 13 },
  liveBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveBadgeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  viewerBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewerBadgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  feed: {
    position: 'absolute',
    left: 12,
    bottom: 120,
    right: 80,
    gap: 6,
  },
  feedRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  feedText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  giftBar: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
  },
  gifts: {
    gap: 8,
    paddingHorizontal: 16,
  },
  gift: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  giftBusy: { opacity: 0.7 },
  giftIcon: { fontSize: 20 },
  giftCost: { fontSize: 9, color: colors.primary, fontWeight: '900' },
});
