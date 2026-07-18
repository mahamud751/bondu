import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { colors, spacing } from '../theme';

export function LiveViewScreen({ route, navigation }: { route: any; navigation: any }) {
  const { liveId } = route.params;
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const left = useRef(false);
  const [status, setStatus] = useState('Connecting…');
  const [provider, setProvider] = useState('');
  const [host, setHost] = useState<any>();
  const [remoteUid, setRemoteUid] = useState<number>();
  const [viewerCount, setViewerCount] = useState(0);
  const [gifts, setGifts] = useState<any[]>([]);
  const [giftEvent, setGiftEvent] = useState<any>();

  const leave = async (reason?: string) => {
    if (left.current) return;
    left.current = true;
    engine.current?.leaveChannel();
    engine.current?.release();
    const socket = await realtime();
    socket?.emit('live:unwatch', { liveId });
    try { await api.post(`/live/${liveId}/leave`); } catch {}
    if (reason) Alert.alert(reason);
    navigation.goBack();
  };

  useEffect(() => {
    let mounted = true;
    let socket: any;
    const giftHandler = (event: any) => { setGiftEvent(event); setTimeout(() => setGiftEvent(undefined), 2500); };
    const viewerHandler = (payload: { liveId: string; viewerCount: number }) => { if (payload.liveId === liveId) setViewerCount(payload.viewerCount); };
    const endedHandler = (payload: { liveId: string }) => { if (payload.liveId === liveId) void leave('This stream has ended'); };
    const connect = async () => {
      try {
        const { data: access } = await api.post(`/live/${liveId}/join`);
        if (!mounted) return;
        setHost(access.host);
        setProvider(access.provider);
        setViewerCount(access.viewerCount ?? 0);
        void api.get('/gifts').then(response => setGifts(response.data.filter((item: any) => item.enabledInCalls !== false)));
        socket = await realtime();
        socket?.emit('live:watch', { liveId });
        socket?.on('live:viewer-count', viewerHandler);
        socket?.on('live:ended', endedHandler);
        socket?.on('gift:animation', giftHandler);
        if (access.provider === 'AGORA') {
          const rtc = createAgoraRtcEngine();
          engine.current = rtc;
          rtc.initialize({ appId: access.appId, channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting });
          rtc.enableVideo();
          rtc.setClientRole(ClientRoleType.ClientRoleAudience);
          const handler: IRtcEngineEventHandler = {
            onUserJoined: (_connection, uid) => { if (mounted) { setRemoteUid(uid); setStatus('Live'); } },
            onUserOffline: () => { if (mounted) setStatus('Host disconnected'); },
          };
          rtc.registerEventHandler(handler);
          const result = rtc.joinChannelWithUserAccount(access.token, access.channelName, access.userAccount, {
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
            publishMicrophoneTrack: false,
            publishCameraTrack: false,
            clientRoleType: ClientRoleType.ClientRoleAudience,
          });
          if (result < 0) throw new Error(`Agora join failed (${result})`);
        } else {
          setStatus('Development live simulation');
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

  const sendGift = async (gift: any) => {
    if (!host?.userId) return;
    try { await api.post(`/gifts/${gift.id}/send`, { receiverId: host.userId, idempotencyKey: `mobile-${Date.now()}-${Math.random()}` }); }
    catch (error: any) { Alert.alert('Gift not sent', apiErrorMessage(error, 'Try again')); }
  };

  return (
    <View style={styles.stage}>
      {provider === 'AGORA' && remoteUid ? (
        <RtcSurfaceView style={StyleSheet.absoluteFillObject} canvas={{ uid: remoteUid }} />
      ) : (
        <View style={styles.waiting}><Avatar name={host?.displayName} size={96} /><Text style={styles.waitingText}>{status}</Text></View>
      )}
      {giftEvent ? <View style={styles.giftEvent}><Text style={styles.giftEventIcon}>✦</Text><Text style={styles.giftEventText}>{giftEvent.gift} sent</Text></View> : null}
      <View style={styles.top}>
        <View style={styles.hostChip}>
          <Text style={styles.hostName} numberOfLines={1}>{host?.displayName ?? 'Streaming'}</Text>
        </View>
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>● LIVE</Text></View>
        <View style={styles.viewerBadge}><Text style={styles.viewerBadgeText}>◉ {viewerCount}</Text></View>
        <Pressable style={styles.closeButton} onPress={() => void leave()}><Text style={styles.closeButtonText}>×</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifts}>
        {gifts.slice(0, 8).map(gift => (
          <Pressable key={gift.id} style={styles.gift} onPress={() => void sendGift(gift)}>
            <Text style={styles.giftIcon}>{gift.iconUrl}</Text>
            <Text style={styles.giftCost}>{gift.pointPrice}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  waitingText: { color: colors.textSoft, fontSize: 14 },
  giftEvent: { position: 'absolute', top: '35%', alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(22,17,31,.9)', paddingHorizontal: 28, paddingVertical: 18, borderRadius: 24, alignItems: 'center' },
  giftEventIcon: { color: colors.gold, fontSize: 38 },
  giftEventText: { color: colors.white, fontWeight: '900', marginTop: 5 },
  top: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hostChip: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  hostName: { color: colors.white, fontWeight: '700', fontSize: 13 },
  liveBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  liveBadgeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  viewerBadge: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  viewerBadgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  gifts: { position: 'absolute', bottom: 40, left: 8, right: 8, gap: 8, paddingHorizontal: 8 },
  gift: { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.92)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  giftIcon: { fontSize: 20 },
  giftCost: { fontSize: 8, color: colors.primary, fontWeight: '900' },
});
