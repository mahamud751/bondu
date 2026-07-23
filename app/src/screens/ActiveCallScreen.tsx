import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
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
  ConnectionStateType,
  createAgoraRtcEngine,
  IRtcEngine,
  IRtcEngineEventHandler,
  RtcSurfaceView,
} from 'react-native-agora';
import { api, apiErrorMessage } from '../api/client';
import { Avatar, Pill, Screen } from '../components/UI';
import { colors } from '../theme';
import { realtime } from '../api/realtime';

type GiftItem = {
  id: string;
  name: string;
  iconUrl: string;
  pointPrice: number;
  enabledInCalls?: boolean;
};

type GiftEvent = {
  gift?: string;
  giftIcon?: string;
  senderName?: string;
  pointPrice?: number;
};

export function ActiveCallScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { callId, title = 'Voice call' } = route.params;
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const startedAt = useRef<number | undefined>(undefined);
  const ending = useRef(false);
  const [status, setStatus] = useState('Connecting securely…');
  const [remaining, setRemaining] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [provider, setProvider] = useState('');
  const [video, setVideo] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number>();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [giftReceiverId, setGiftReceiverId] = useState('');
  const [canSendGifts, setCanSendGifts] = useState(false);
  const [giftEvent, setGiftEvent] = useState<GiftEvent>();
  const [sendingGiftId, setSendingGiftId] = useState<string>();
  const [displayName, setDisplayName] = useState(title);

  const end = async (reason = 'Call ended') => {
    if (ending.current) return;
    ending.current = true;
    try {
      engine.current?.leaveChannel();
      engine.current?.release();
      engine.current = undefined;
      await api.post(`/calls/${callId}/end`, {});
    } catch {
      /* end best-effort */
    } finally {
      Alert.alert(reason, 'Your final charge is available in Call history.');
      navigation.goBack();
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let mounted = true;
    let socket: any;

    const giftHandler = (event: GiftEvent) => {
      setGiftEvent(event);
      setTimeout(() => {
        if (mounted) setGiftEvent((current) => (current === event ? undefined : current));
      }, 2500);
    };

    const connect = async () => {
      try {
        if (Platform.OS === 'android') {
          const permission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('Microphone permission is required');
          }
        }
        const { data: access } = await api.post(`/calls/${callId}/join-token`);
        if (!mounted) return;
        const receiverId =
          access.giftReceiverId ??
          (access.canSendGifts === false ? '' : access.otherUserId);
        setGiftReceiverId(receiverId);
        setCanSendGifts(access.canSendGifts !== false && !!receiverId);
        if (access.otherDisplayName) setDisplayName(access.otherDisplayName);
        if (access.canSendGifts !== false) {
          void api.get('/gifts').then((response) =>
            setGifts(
              response.data.filter(
                (item: GiftItem) => item.enabledInCalls !== false,
              ),
            ),
          );
        }
        const isVideo = access.callType === 'VIDEO';
        setVideo(isVideo);
        if (isVideo && Platform.OS === 'android') {
          const camera = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
          );
          if (camera !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('Camera permission is required');
          }
        }
        setProvider(access.provider);
        if (access.provider === 'DEVELOPMENT') {
          await api.post(`/calls/${callId}/connected`);
          startedAt.current = Date.now();
          setStatus(`Development ${isVideo ? 'video' : 'voice'} simulation`);
        } else {
          const rtc = createAgoraRtcEngine();
          engine.current = rtc;
          rtc.initialize({
            appId: access.appId,
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
          });
          rtc.enableAudio();
          if (isVideo) {
            rtc.enableVideo();
            rtc.startPreview();
          }
          rtc.setClientRole(ClientRoleType.ClientRoleBroadcaster);
          rtc.setEnableSpeakerphone(true);
          const handler: IRtcEngineEventHandler = {
            onJoinChannelSuccess: () => {
              if (mounted) setStatus('Waiting for the other person…');
            },
            onUserJoined: async (_connection, uid) => {
              setRemoteUid(uid);
              if (!startedAt.current) {
                startedAt.current = Date.now();
                await api.post(`/calls/${callId}/connected`);
              }
              if (mounted) setStatus('Connected');
            },
            onUserOffline: () => {
              if (mounted) setStatus('The other person left');
              void end('Call completed');
            },
            onConnectionStateChanged: (_connection, state) => {
              if (!mounted) return;
              if (state === ConnectionStateType.ConnectionStateReconnecting) {
                setStatus('Reconnecting…');
              }
              if (state === ConnectionStateType.ConnectionStateFailed) {
                void end('Connection failed');
              }
            },
          };
          rtc.registerEventHandler(handler);
          const result = rtc.joinChannelWithUserAccount(
            access.token,
            access.channelName,
            access.userAccount,
            {
              autoSubscribeAudio: true,
              autoSubscribeVideo: isVideo,
              publishMicrophoneTrack: true,
              publishCameraTrack: isVideo,
              clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            },
          );
          if (result < 0) throw new Error(`Agora join failed (${result})`);
        }
        timer = setInterval(async () => {
          if (!startedAt.current || ending.current) return;
          const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
          try {
            const { data } = await api.post(`/calls/${callId}/heartbeat`, {
              connectedSeconds: elapsed,
            });
            if (!mounted) return;
            setRemaining(data.remainingSeconds);
            if (data.mustEnd) void end('Time allowance finished');
          } catch (error: any) {
            if (error.response?.status === 409) void end('Call completed');
          }
        }, 1000);
      } catch (error: any) {
        Alert.alert('Could not join call', apiErrorMessage(error, 'Try again'));
        navigation.goBack();
      }
    };

    void connect();
    void realtime().then((value) => {
      socket = value;
      socket?.on('gift:animation', giftHandler);
    });

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      socket?.off('gift:animation', giftHandler);
      engine.current?.leaveChannel();
      engine.current?.release();
      engine.current = undefined;
    };
  }, [callId, navigation]);

  const event = (eventType: string) =>
    api.post(`/calls/${callId}/events`, { eventType }).catch(() => undefined);

  const toggleMute = () => {
    const next = !muted;
    engine.current?.muteLocalAudioStream(next);
    setMuted(next);
    void event(next ? 'MUTED' : 'UNMUTED');
  };

  const toggleSpeaker = () => {
    const next = !speaker;
    engine.current?.setEnableSpeakerphone(next);
    setSpeaker(next);
    void event(next ? 'SPEAKER_ENABLED' : 'SPEAKER_DISABLED');
  };

  const sendGift = async (gift: GiftItem) => {
    if (!giftReceiverId || !canSendGifts || sendingGiftId) return;
    try {
      setSendingGiftId(gift.id);
      await api.post(`/gifts/${gift.id}/send`, {
        receiverId: giftReceiverId,
        callId,
        idempotencyKey: `call-${callId}-${Date.now()}-${Math.random()}`,
      });
    } catch (error: any) {
      Alert.alert('Gift not sent', apiErrorMessage(error, 'Try again'));
    } finally {
      setSendingGiftId(undefined);
    }
  };

  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <Screen>
      <View style={styles.container}>
        {video && provider === 'AGORA' ? (
          <View style={styles.videoStage}>
            {remoteUid ? (
              <RtcSurfaceView
                style={styles.remoteVideo}
                canvas={{ uid: remoteUid }}
              />
            ) : (
              <View style={styles.videoWaiting}>
                <Avatar name={displayName} size={90} />
              </View>
            )}
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{ uid: 0 }}
              zOrderMediaOverlay
            />
          </View>
        ) : null}

        {giftEvent ? (
          <View style={styles.giftEvent}>
            <Text style={styles.giftEventIcon}>
              {giftEvent.giftIcon || '✦'}
            </Text>
            <Text style={styles.giftEventSender}>
              {giftEvent.senderName || 'Someone'}
            </Text>
            <Text style={styles.giftEventText}>
              sent {giftEvent.gift}
            </Text>
          </View>
        ) : null}

        <View style={styles.top}>
          <Pill
            label={
              provider === 'AGORA'
                ? `Encrypted Agora ${video ? 'video' : 'audio'}`
                : 'Development simulation'
            }
            tone={provider === 'AGORA' ? 'success' : 'gold'}
          />
          <Text style={styles.status}>{status}</Text>
        </View>

        {!video || provider !== 'AGORA' ? (
          <View style={styles.person}>
            <Avatar name={displayName} size={112} online />
            <Text style={styles.name}>{displayName}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <Text
          style={[
            styles.timer,
            remaining <= 30 && remaining > 0 && { color: colors.danger },
          ]}
        >
          {minutes}:{seconds}
        </Text>
        <Text style={styles.remaining}>remaining allowance</Text>

        {canSendGifts && gifts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gifts}
          >
            {gifts.slice(0, 10).map((gift) => {
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
        ) : (
          <View style={styles.giftsPlaceholder} />
        )}

        <View style={styles.controls}>
          <Pressable
            style={[styles.control, muted && styles.activeControl]}
            onPress={toggleMute}
          >
            <Text style={styles.controlIcon}>{muted ? '×' : '◉'}</Text>
            <Text style={styles.controlLabel}>
              {muted ? 'Unmute' : 'Mute'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.control, speaker && styles.activeControl]}
            onPress={toggleSpeaker}
          >
            <Text style={styles.controlIcon}>◖</Text>
            <Text style={styles.controlLabel}>Speaker</Text>
          </Pressable>
          <Pressable
            style={[styles.control, styles.end]}
            onPress={() => void end()}
          >
            <Text style={[styles.controlIcon, { color: '#FFF' }]}>⌁</Text>
            <Text style={[styles.controlLabel, { color: '#FFF' }]}>End</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  videoStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#17131F',
  },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localVideo: {
    position: 'absolute',
    right: 10,
    top: 60,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoWaiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftEvent: {
    position: 'absolute',
    top: '35%',
    zIndex: 10,
    backgroundColor: 'rgba(22,17,31,.9)',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
  },
  giftEventIcon: { color: colors.gold, fontSize: 38 },
  giftEventSender: {
    color: '#FFF',
    fontWeight: '800',
    marginTop: 6,
    fontSize: 14,
  },
  giftEventText: { color: '#FFF', fontWeight: '900', marginTop: 2 },
  top: { alignItems: 'center', zIndex: 3 },
  status: { color: colors.muted, marginTop: 10 },
  person: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 20,
  },
  timer: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '300',
    marginTop: 14,
    letterSpacing: 2,
    zIndex: 3,
  },
  remaining: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
    zIndex: 3,
  },
  gifts: { gap: 8, paddingVertical: 12, paddingHorizontal: 8 },
  giftsPlaceholder: { height: 76 },
  gift: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBusy: { opacity: 0.7 },
  giftIcon: { fontSize: 20 },
  giftCost: { fontSize: 8, color: colors.primary, fontWeight: '900' },
  controls: {
    flexDirection: 'row',
    gap: 18,
    paddingBottom: 24,
    zIndex: 3,
  },
  control: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeControl: {
    backgroundColor: colors.primaryLight,
    borderColor: '#D7CDFF',
  },
  end: { backgroundColor: colors.danger, borderColor: colors.danger },
  controlIcon: { color: colors.text, fontSize: 20, fontWeight: '900' },
  controlLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
});
