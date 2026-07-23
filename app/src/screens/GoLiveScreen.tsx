import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
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
import { Button, Field, Screen } from '../components/UI';
import { colors, spacing } from '../theme';

type GiftEvent = {
  gift?: string;
  giftIcon?: string;
  senderName?: string;
  pointPrice?: number;
};

export function GoLiveScreen({ navigation }: { navigation: any }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ id: string } | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [provider, setProvider] = useState('');
  const [giftEvent, setGiftEvent] = useState<GiftEvent>();
  const [giftFeed, setGiftFeed] = useState<GiftEvent[]>([]);
  const [giftTotal, setGiftTotal] = useState(0);
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const liveIdRef = useRef<string | undefined>(undefined);

  const stop = async (navigateBack = true) => {
    const id = liveIdRef.current;
    liveIdRef.current = undefined;
    engine.current?.leaveChannel();
    engine.current?.release();
    engine.current = undefined;
    const socket = await realtime();
    if (id) {
      socket?.emit('live:unwatch', { liveId: id });
      try {
        await api.post(`/live/${id}/end`);
      } catch {
        /* end best-effort */
      }
    }
    if (navigateBack) navigation.goBack();
  };

  useEffect(
    () => () => {
      if (liveIdRef.current) void stop(false);
    },
    [],
  );

  const start = async () => {
    try {
      setBusy(true);
      if (Platform.OS === 'android') {
        const camera = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        const mic = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (
          camera !== PermissionsAndroid.RESULTS.GRANTED ||
          mic !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          throw new Error(
            'Camera and microphone permissions are required to go live',
          );
        }
      }
      const { data: access } = await api.post('/live/start', {
        title: title.trim() || undefined,
      });
      liveIdRef.current = access.id;
      setProvider(access.provider);
      const socket = await realtime();
      socket?.emit('live:watch', { liveId: access.id });
      socket?.on(
        'live:viewer-count',
        (payload: { liveId: string; viewerCount: number }) => {
          if (payload.liveId === access.id) setViewerCount(payload.viewerCount);
        },
      );
      socket?.on('gift:animation', (event: GiftEvent) => {
        setGiftEvent(event);
        setGiftFeed((prev) => [event, ...prev].slice(0, 8));
        if (typeof event.pointPrice === 'number') {
          setGiftTotal((total) => total + event.pointPrice!);
        }
        setTimeout(() => setGiftEvent(undefined), 2800);
      });
      if (access.provider === 'AGORA') {
        const rtc = createAgoraRtcEngine();
        engine.current = rtc;
        rtc.initialize({
          appId: access.appId,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });
        rtc.enableVideo();
        rtc.startPreview();
        rtc.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        const handler: IRtcEngineEventHandler = {};
        rtc.registerEventHandler(handler);
        const result = rtc.joinChannelWithUserAccount(
          access.token,
          access.channelName,
          access.userAccount,
          {
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
            publishMicrophoneTrack: true,
            publishCameraTrack: true,
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          },
        );
        if (result < 0) throw new Error(`Agora join failed (${result})`);
      }
      setLive({ id: access.id });
    } catch (error: any) {
      Alert.alert('Could not go live', apiErrorMessage(error, 'Try again'));
    } finally {
      setBusy(false);
    }
  };

  if (!live) {
    return (
      <Screen>
        <Text style={styles.heading}>Go live</Text>
        <Text style={styles.body}>
          Broadcast video to everyone on SocialConnect. Viewers can watch and
          send gifts in real time — earnings land in your creator wallet.
        </Text>
        <Field
          placeholder="Give your stream a title (optional)"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Button title="Go live" loading={busy} onPress={start} />
      </Screen>
    );
  }

  return (
    <View style={styles.stage}>
      {provider === 'AGORA' ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{ uid: 0 }}
        />
      ) : (
        <View style={styles.simulated}>
          <Text style={styles.simulatedText}>Development live simulation</Text>
          <Text style={styles.simulatedHint}>
            Configure Agora credentials for real video. Gifts still work.
          </Text>
        </View>
      )}

      {giftEvent ? (
        <View style={styles.giftEvent}>
          <Text style={styles.giftEventIcon}>{giftEvent.giftIcon || '✦'}</Text>
          <Text style={styles.giftEventSender}>
            {giftEvent.senderName || 'Someone'}
          </Text>
          <Text style={styles.giftEventText}>sent {giftEvent.gift}</Text>
        </View>
      ) : null}

      <View style={styles.overlayTop}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerBadgeText}>◉ {viewerCount}</Text>
        </View>
        {giftTotal > 0 ? (
          <View style={styles.earnBadge}>
            <Text style={styles.earnBadgeText}>✦ {giftTotal} pts</Text>
          </View>
        ) : null}
      </View>

      {giftFeed.length > 0 ? (
        <View style={styles.feed}>
          {giftFeed.slice(0, 4).map((item, index) => (
            <View key={`${item.gift}-${index}`} style={styles.feedRow}>
              <Text style={styles.feedText} numberOfLines={1}>
                {item.giftIcon || '✦'} {item.senderName || 'Someone'} ·{' '}
                {item.gift}
                {item.pointPrice ? ` · ${item.pointPrice}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.endButton} onPress={() => void stop()}>
        <Text style={styles.endButtonText}>End stream</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  stage: { flex: 1, backgroundColor: '#000' },
  simulated: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  simulatedText: { color: colors.textSoft, fontSize: 15, fontWeight: '700' },
  simulatedHint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  overlayTop: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  liveBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveBadgeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  viewerBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewerBadgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  earnBadge: {
    backgroundColor: 'rgba(212,175,55,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  earnBadgeText: { color: '#1A1200', fontWeight: '900', fontSize: 12 },
  giftEvent: {
    position: 'absolute',
    top: '34%',
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(22,17,31,.92)',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
  },
  giftEventIcon: { color: colors.gold, fontSize: 40 },
  giftEventSender: {
    color: colors.white,
    fontWeight: '800',
    marginTop: 8,
    fontSize: 15,
  },
  giftEventText: { color: colors.textSoft, fontWeight: '700', marginTop: 2 },
  feed: {
    position: 'absolute',
    left: 12,
    bottom: 110,
    right: 12,
    gap: 6,
  },
  feedRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  feedText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  endButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
  },
  endButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
