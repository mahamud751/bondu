import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { GiftFxPlayer } from '../components/GiftFxPlayer';
import { LiveSeatGrid } from '../components/LiveSeatGrid';
import { VirtualAvatar3D, VirtualAvatar3DPicker } from '../components/VirtualAvatar3D';
import { DrawGuessGame } from '../components/DrawGuessGame';
import { ArFaceLayer, AR_FACE_STICKERS } from '../components/ArFaceLayer';
import { applyBeautyToEngine } from '../live/applyBeauty';
import { colors, spacing } from '../theme';

type GiftEvent = {
  gift?: string;
  giftIcon?: string;
  senderName?: string;
  pointPrice?: number;
};

type ChatMessage = {
  id: string;
  body: string;
  kind: string;
  displayName: string;
  isVerified?: boolean;
  userId: string;
};

type RankEntry = {
  rank: number;
  userId: string;
  points: number;
  displayName: string;
};

type MicRequest = {
  id: string;
  userId: string;
  displayName: string;
  note?: string | null;
};

type Seat = {
  seatIndex: number;
  role: string;
  muted: boolean;
  userId: string;
  displayName: string;
};

type PkState = {
  id: string;
  status: string;
  challengerScore: number;
  opponentScore: number;
  challenger: { liveId: string; host?: { displayName?: string } };
  opponent: { liveId: string; host?: { displayName?: string } };
  winnerLiveId?: string | null;
};

const CATEGORIES = [
  { key: 'CHAT', label: 'Chat' },
  { key: 'MUSIC', label: 'Music' },
  { key: 'DANCE', label: 'Dance' },
  { key: 'GAMING', label: 'Gaming' },
  { key: 'TALENT', label: 'Talent' },
  { key: 'EDU', label: 'Edu' },
  { key: 'LIFESTYLE', label: 'Life' },
  { key: 'OTHER', label: 'Other' },
];

export function GoLiveScreen({ navigation }: { navigation: any }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CHAT');
  const [mode, setMode] = useState<'VIDEO' | 'AUDIO'>('VIDEO');
  const [virtualMode, setVirtualMode] = useState(false);
  const [virtualAvatar, setVirtualAvatar] = useState('fox');
  const [sticker, setSticker] = useState('none');
  const [pkMode, setPkMode] = useState<'SOLO' | 'BEST_OF_3' | 'BEST_OF_5'>('SOLO');
  const [game, setGame] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ id: string } | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [provider, setProvider] = useState('');
  const [giftEvent, setGiftEvent] = useState<GiftEvent>();
  const [giftTotal, setGiftTotal] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [micQueue, setMicQueue] = useState<MicRequest[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsOpen, setSeatsOpen] = useState(true);
  const [chatMuted, setChatMuted] = useState(false);
  const [pk, setPk] = useState<PkState | null>(null);
  const [opponents, setOpponents] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [endStats, setEndStats] = useState<any>();
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const liveIdRef = useRef<string | undefined>(undefined);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const socketRef = useRef<any>(null);

  const cleanupSocket = () => {
    const socket = socketRef.current;
    if (!socket) return;
    if ((socket as any).__coachTimer) {
      clearInterval((socket as any).__coachTimer);
    }
    socket.removeAllListeners?.('live:viewer-count');
    socket.removeAllListeners?.('gift:animation');
    socket.removeAllListeners?.('live:chat');
    socket.removeAllListeners?.('live:like');
    socket.removeAllListeners?.('live:ranking');
    socket.removeAllListeners?.('live:chat-muted');
    socket.removeAllListeners?.('live:mic-request');
    socket.removeAllListeners?.('live:mic-cancelled');
    socket.removeAllListeners?.('live:seats');
    socket.removeAllListeners?.('live:pk-challenge');
    socket.removeAllListeners?.('live:pk-started');
    socket.removeAllListeners?.('live:pk-score');
    socket.removeAllListeners?.('live:pk-ended');
    socketRef.current = null;
  };

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
        const { data } = await api.post(`/live/${id}/end`);
        cleanupSocket();
        if (data?.ended) {
          setEndStats(data);
          setLive(null);
          return;
        }
      } catch {
        /* best-effort */
      }
    }
    cleanupSocket();
    if (navigateBack) navigation.goBack();
  };

  useEffect(
    () => () => {
      if (liveIdRef.current) void stop(false);
    },
    [],
  );

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }, [messages.length]);

  const start = async () => {
    try {
      setBusy(true);
      setEndStats(undefined);
      if (Platform.OS === 'android') {
        const mic = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (mic !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Microphone permission is required');
        }
        if (mode === 'VIDEO') {
          const camera = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
          );
          if (camera !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('Camera permission is required for video live');
          }
        }
      }
      const { data: access } = await api.post('/live/start', {
        title: title.trim() || undefined,
        category,
        mode,
        maxGuests: mode === 'AUDIO' ? 11 : 8,
        seatsOpen: true,
        queueEnabled: true,
        virtualMode,
        virtualAvatar,
      });
      liveIdRef.current = access.id;
      setProvider(access.provider);
      try {
        const beauty = await api.get('/beauty/me');
        // apply after engine join
        (access as any).__beauty = beauty.data;
      } catch {
        /* optional */
      }
      setChatMuted(false);
      setMessages([]);
      setRanking([]);
      setMicQueue([]);
      setSeats(access.seats ?? []);
      setGiftTotal(0);
      setLikeCount(0);
      setViewerCount(0);
      setPk(null);
      setSeatsOpen(true);

      const socket = await realtime();
      socketRef.current = socket;
      socket?.emit('live:watch', { liveId: access.id });
      socket?.on(
        'live:viewer-count',
        (payload: { liveId: string; viewerCount: number }) => {
          if (payload.liveId === access.id) setViewerCount(payload.viewerCount);
        },
      );
      socket?.on('gift:animation', (event: GiftEvent) => {
        setGiftEvent(event);
        if (typeof event.pointPrice === 'number') {
          setGiftTotal((total) => total + event.pointPrice!);
        }
        setTimeout(() => setGiftEvent(undefined), 2800);
      });
      socket?.on('live:chat', (payload: ChatMessage & { liveId?: string }) => {
        if (payload.liveId && payload.liveId !== access.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload].slice(-80);
        });
      });
      socket?.on(
        'live:like',
        (payload: { liveId: string; likeCount: number }) => {
          if (payload.liveId === access.id) setLikeCount(payload.likeCount);
        },
      );
      socket?.on(
        'live:ranking',
        (payload: {
          liveId: string;
          ranking: RankEntry[];
          totalGiftPoints?: number;
        }) => {
          if (payload.liveId === access.id) {
            setRanking(payload.ranking ?? []);
            if (typeof payload.totalGiftPoints === 'number') {
              setGiftTotal(payload.totalGiftPoints);
            }
          }
        },
      );
      socket?.on(
        'live:chat-muted',
        (payload: { liveId: string; muted: boolean }) => {
          if (payload.liveId === access.id) setChatMuted(payload.muted);
        },
      );
      socket?.on('live:mic-request', (payload: MicRequest & { liveId?: string }) => {
        if (payload.liveId && payload.liveId !== access.id) return;
        setMicQueue((prev) => {
          if (prev.some((r) => r.id === payload.id)) return prev;
          return [...prev, payload];
        });
      });
      socket?.on(
        'live:mic-cancelled',
        (payload: { liveId: string; requestId: string }) => {
          if (payload.liveId === access.id) {
            setMicQueue((prev) =>
              prev.filter((r) => r.id !== payload.requestId),
            );
          }
        },
      );
      socket?.on('live:seats', (payload: { liveId: string; seats: Seat[] }) => {
        if (payload.liveId === access.id) setSeats(payload.seats ?? []);
      });
      socket?.on('live:pk-challenge', (payload: PkState) => {
        setPk(payload);
        if (payload.status === 'PENDING') {
          Alert.alert(
            'PK challenge',
            `${payload.challenger?.host?.displayName ?? 'A host'} challenged you`,
            [
              {
                text: 'Decline',
                style: 'cancel',
                onPress: () =>
                  void api.post(`/live/pk/${payload.id}/respond`, {
                    decision: 'DECLINE',
                  }),
              },
              {
                text: 'Accept',
                onPress: () =>
                  void api.post(`/live/pk/${payload.id}/respond`, {
                    decision: 'ACCEPT',
                  }),
              },
            ],
          );
        }
      });
      socket?.on('live:pk-started', (payload: PkState) => setPk(payload));
      socket?.on('live:pk-score', (payload: PkState) => setPk(payload));
      socket?.on('live:pk-ended', (payload: PkState) => {
        setPk(payload);
        Alert.alert(
          'PK ended',
          payload.winnerLiveId === access.id
            ? 'You won!'
            : payload.winnerLiveId
              ? 'You lost this PK'
              : 'Draw',
        );
      });
      socket?.on('live:pk-round', (payload: PkState) => {
        setPk(payload);
        Alert.alert('Next PK round', `Round ${(payload as any).currentRound}`);
      });
      socket?.on('live:game', (payload: any) => setGame(payload));
      socket?.on('live:game-stroke', (payload: any) => {
        setGame((g: any) =>
          g ? { ...g, strokes: payload.strokes ?? g.strokes } : g,
        );
      });

      void api.get('/live').then((r) => {
        setOpponents(
          (r.data as any[]).filter((item) => item.id !== access.id).slice(0, 8),
        );
      });
      void api
        .get(`/live/${access.id}/coach-tip`)
        .then((r) => setCoachTip(r.data?.message ?? null))
        .catch(() => undefined);
      const coachTimer = setInterval(() => {
        void api
          .get(`/live/${access.id}/coach-tip`)
          .then((r) => setCoachTip(r.data?.message ?? null))
          .catch(() => undefined);
      }, 45000);
      (socket as any).__coachTimer = coachTimer;

      if (access.provider === 'AGORA') {
        const rtc = createAgoraRtcEngine();
        engine.current = rtc;
        rtc.initialize({
          appId: access.appId,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });
        if (mode === 'VIDEO') {
          rtc.enableVideo();
          rtc.startPreview();
        }
        rtc.enableAudio();
        rtc.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        const handler: IRtcEngineEventHandler = {};
        rtc.registerEventHandler(handler);
        const result = rtc.joinChannelWithUserAccount(
          access.token,
          access.channelName,
          access.userAccount,
          {
            autoSubscribeAudio: true,
            autoSubscribeVideo: mode === 'VIDEO',
            publishMicrophoneTrack: true,
            publishCameraTrack: mode === 'VIDEO',
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          },
        );
        if (result < 0) throw new Error(`Agora join failed (${result})`);
        if ((access as any).__beauty) {
          applyBeautyToEngine(rtc, (access as any).__beauty, true);
        }
      }
      setLive({ id: access.id });
    } catch (error: any) {
      Alert.alert('Could not go live', apiErrorMessage(error, 'Try again'));
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = async () => {
    if (!live) return;
    try {
      const { data } = await api.post(`/live/${live.id}/chat-mute`, {
        muted: !chatMuted,
      });
      setChatMuted(!!data.chatMuted);
    } catch (error: any) {
      Alert.alert('Could not update chat', apiErrorMessage(error, 'Try again'));
    }
  };

  const toggleSeats = async () => {
    if (!live) return;
    try {
      const { data } = await api.post(`/live/${live.id}/seats-open`, {
        open: !seatsOpen,
      });
      setSeatsOpen(!!data.seatsOpen);
    } catch (error: any) {
      Alert.alert('Could not update seats', apiErrorMessage(error, 'Try again'));
    }
  };

  const decideMic = async (
    requestId: string,
    decision: 'ACCEPTED' | 'REJECTED',
  ) => {
    if (!live) return;
    try {
      await api.post(`/live/${live.id}/mic/decide`, { requestId, decision });
      setMicQueue((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error: any) {
      Alert.alert('Could not decide', apiErrorMessage(error, 'Try again'));
    }
  };

  const kickGuest = async (userId: string) => {
    if (!live) return;
    try {
      await api.post(`/live/${live.id}/seat/kick`, { userId });
    } catch (error: any) {
      Alert.alert('Could not kick', apiErrorMessage(error, 'Try again'));
    }
  };

  const challengePk = async (opponentLiveId: string) => {
    if (!live) return;
    try {
      const { data } = await api.post(`/live/${live.id}/pk/challenge`, {
        opponentLiveId,
        durationSeconds: pkMode === 'SOLO' ? 180 : 120,
        mode: pkMode,
      });
      setPk(data);
      Alert.alert('PK sent', `${pkMode} challenge waiting…`);
    } catch (error: any) {
      Alert.alert('PK failed', apiErrorMessage(error, 'Try again'));
    }
  };

  const sendHostChat = async () => {
    if (!live) return;
    const body = draft.trim();
    if (!body) return;
    try {
      setDraft('');
      await api.post(`/live/${live.id}/chat`, { body });
    } catch (error: any) {
      setDraft(body);
      Alert.alert('Message not sent', apiErrorMessage(error, 'Try again'));
    }
  };

  if (endStats) {
    const mins = Math.floor((endStats.durationSeconds ?? 0) / 60);
    const secs = (endStats.durationSeconds ?? 0) % 60;
    return (
      <Screen scroll>
        <Text style={styles.heading}>Stream ended</Text>
        <Text style={styles.body}>Great session — here is your recap.</Text>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>
            {mins}m {secs}s
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Peak viewers</Text>
          <Text style={styles.statValue}>{endStats.peakViewers ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Likes</Text>
          <Text style={styles.statValue}>{endStats.likeCount ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Gift points received</Text>
          <Text style={styles.statValue}>{endStats.totalGiftPoints ?? 0}</Text>
        </View>
        <Button title="Done" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (!live) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>Go live</Text>
        <Text style={styles.body}>
          Multi-guest rooms, PK battles, fan clubs and private calls — built to
          beat typical live apps on fairness and creator tools.
        </Text>
        <Field
          placeholder="Stream title"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Text style={styles.categoryLabel}>Mode</Text>
        <View style={styles.categoryRow}>
          {(['VIDEO', 'AUDIO'] as const).map((item) => {
            const active = mode === item;
            return (
              <Pressable
                key={item}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setMode(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {item === 'VIDEO' ? 'Video live' : 'Audio room'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={[styles.categoryChip, virtualMode && styles.categoryChipActive]}
          onPress={() => setVirtualMode((v) => !v)}
        >
          <Text
            style={[styles.categoryText, virtualMode && styles.categoryTextActive]}
          >
            Virtual Live / VTuber
          </Text>
        </Pressable>
        {virtualMode ? (
          <VirtualAvatar3DPicker value={virtualAvatar} onChange={setVirtualAvatar} />
        ) : null}
        <Text style={styles.categoryLabel}>PK style</Text>
        <View style={styles.categoryRow}>
          {(['SOLO', 'BEST_OF_3', 'BEST_OF_5'] as const).map((item) => (
            <Pressable
              key={item}
              style={[styles.categoryChip, pkMode === item && styles.categoryChipActive]}
              onPress={() => setPkMode(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  pkMode === item && styles.categoryTextActive,
                ]}
              >
                {item.replaceAll('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.categoryLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((item) => {
            const active = category === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory(item.key)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button title="Go live" loading={busy} onPress={start} />
      </Screen>
    );
  }

  return (
    <View style={styles.stage}>
      {virtualMode ? (
        <View style={styles.simulated}>
          <VirtualAvatar3D avatarId={virtualAvatar} speaking size={240} />
        </View>
      ) : provider === 'AGORA' && mode === 'VIDEO' ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{ uid: 0 }}
        />
      ) : (
        <View style={styles.simulated}>
          <Text style={styles.simulatedText}>
            {mode === 'AUDIO' ? 'Audio room live' : 'Development live simulation'}
          </Text>
          <Text style={styles.simulatedHint}>
            Guests, PK, chat and gifts work even without Agora video.
          </Text>
        </View>
      )}

      {!virtualMode ? <ArFaceLayer sticker={sticker} /> : null}

      <GiftFxPlayer event={giftEvent} />

      <View style={styles.overlayTop}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>
            ● {mode === 'AUDIO' ? 'AUDIO' : 'LIVE'}
          </Text>
        </View>
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerBadgeText}>◉ {viewerCount}</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerBadgeText}>♡ {likeCount}</Text>
        </View>
        {giftTotal > 0 ? (
          <View style={styles.earnBadge}>
            <Text style={styles.earnBadgeText}>✦ {giftTotal} pts</Text>
          </View>
        ) : null}
      </View>

      {pk && pk.status === 'ACTIVE' ? (
        <View style={styles.pkBar}>
          <Text style={styles.pkTitle}>PK BATTLE</Text>
          <Text style={styles.pkScoreLine}>
            {pk.challengerScore} — {pk.opponentScore}
          </Text>
        </View>
      ) : null}

      {coachTip ? (
        <View style={styles.coach}>
          <Text style={styles.coachLabel}>AI COACH</Text>
          <Text style={styles.coachText}>{coachTip}</Text>
        </View>
      ) : null}

      {micQueue.length > 0 ? (
        <View style={styles.queuePanel}>
          <Text style={styles.queueTitle}>Mic queue ({micQueue.length})</Text>
          {micQueue.slice(0, 4).map((req) => (
            <View key={req.id} style={styles.queueRow}>
              <Text style={styles.queueName} numberOfLines={1}>
                {req.displayName}
              </Text>
              <Pressable
                style={styles.acceptBtn}
                onPress={() => void decideMic(req.id, 'ACCEPTED')}
              >
                <Text style={styles.queueBtnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={styles.rejectBtn}
                onPress={() => void decideMic(req.id, 'REJECTED')}
              >
                <Text style={styles.queueBtnText}>No</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.seatGridWrap}>
        <LiveSeatGrid
          seats={seats}
          maxGuests={mode === 'AUDIO' ? 11 : 8}
          mode={mode}
          onSeatPress={(seat) => {
            if (seat.role === 'HOST') return;
            Alert.alert(seat.displayName, 'Guest controls', [
              {
                text: 'Kick',
                style: 'destructive',
                onPress: () => void kickGuest(seat.userId),
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        />
      </View>

      <View style={styles.gameWrap}>
        <DrawGuessGame
          game={game}
          isHost
          onStart={() =>
            void api
              .post(`/live/${live.id}/game/start`, { maxRounds: 3 })
              .then((r) => setGame(r.data))
              .catch((e) =>
                Alert.alert('Game', apiErrorMessage(e, 'Could not start')),
              )
          }
          onEnd={() =>
            void api.post(`/live/${live.id}/game/end`).then(() => setGame(null))
          }
          onStroke={(strokes) =>
            void api.post(`/live/${live.id}/game/stroke`, { strokes })
          }
          onGuess={() => undefined}
        />
      </View>

      <ScrollView
        horizontal
        style={styles.stickerRow}
        contentContainerStyle={{ paddingHorizontal: 10 }}
      >
        {AR_FACE_STICKERS.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.stickerChip, sticker === s.id && styles.stickerOn]}
            onPress={() => setSticker(s.id)}
          >
            <Text style={styles.stickerText}>
              {s.emoji} {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {ranking.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rankStrip}
          contentContainerStyle={styles.rankContent}
        >
          {ranking.map((entry) => (
            <View key={entry.userId} style={styles.rankChip}>
              <Text style={styles.rankText} numberOfLines={1}>
                #{entry.rank} {entry.displayName} · {entry.points}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.chatPanel}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={[
                styles.chatRow,
                item.kind === 'SYSTEM' && styles.chatSystem,
                item.kind === 'GIFT' && styles.chatGift,
              ]}
            >
              <Text style={styles.chatText} numberOfLines={3}>
                {item.kind === 'USER' ? (
                  <Text style={styles.chatName}>
                    {item.displayName}
                    {item.isVerified ? ' ✓' : ''}:{' '}
                  </Text>
                ) : null}
                {item.body}
              </Text>
            </View>
          )}
        />
      </View>

      {opponents.length > 0 && !pk ? (
        <ScrollView
          horizontal
          style={styles.pkOpponents}
          contentContainerStyle={{ paddingHorizontal: 10 }}
        >
          {opponents.map((item) => (
            <Pressable
              key={item.id}
              style={styles.pkChip}
              onPress={() => void challengePk(item.id)}
            >
              <Text style={styles.pkChipText} numberOfLines={1}>
                PK {item.host?.displayName ?? 'host'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.hostBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Host message…"
          placeholderTextColor="rgba(255,255,255,0.45)"
          maxLength={200}
          onSubmitEditing={() => void sendHostChat()}
          returnKeyType="send"
        />
        <Pressable style={styles.toolBtn} onPress={() => void sendHostChat()}>
          <Text style={styles.toolText}>Send</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={() => void toggleMute()}>
          <Text style={styles.toolText}>{chatMuted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={() => void toggleSeats()}>
          <Text style={styles.toolText}>{seatsOpen ? 'Lock' : 'Open'}</Text>
        </Pressable>
        <Pressable
          style={[styles.toolBtn, styles.endBtn]}
          onPress={() => void stop()}
        >
          <Text style={styles.toolText}>End</Text>
        </Pressable>
      </View>
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
  categoryLabel: {
    color: colors.textSoft,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  categoryTextActive: { color: colors.white },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  statLabel: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  statValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 22,
    marginTop: 4,
  },
  stage: { flex: 1, backgroundColor: '#000' },
  simulated: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
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
    gap: 8,
    flexWrap: 'wrap',
    zIndex: 5,
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
  stickerOverlay: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    fontSize: 64,
    zIndex: 9,
  },
  seatGridWrap: {
    position: 'absolute',
    top: 200,
    left: 10,
    right: 10,
    zIndex: 5,
  },
  gameWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 170,
    zIndex: 6,
  },
  stickerRow: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    maxHeight: 36,
    zIndex: 6,
  },
  stickerChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  stickerOn: { backgroundColor: colors.primary },
  stickerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pkBar: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(90,20,60,0.92)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 7,
  },
  pkTitle: {
    color: colors.gold,
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  pkScoreLine: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 2,
  },
  coach: {
    position: 'absolute',
    top: 150,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(30,20,50,0.88)',
    borderRadius: 14,
    padding: 10,
    zIndex: 7,
    borderWidth: 1,
    borderColor: 'rgba(160,32,240,0.4)',
  },
  coachLabel: {
    color: colors.gold,
    fontWeight: '900',
    fontSize: 10,
    marginBottom: 4,
  },
  coachText: { color: '#fff', fontWeight: '600', fontSize: 12, lineHeight: 16 },
  queuePanel: {
    position: 'absolute',
    top: 100,
    right: 10,
    width: 180,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 14,
    padding: 10,
    zIndex: 8,
  },
  queueTitle: { color: colors.gold, fontWeight: '800', fontSize: 11, marginBottom: 6 },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  queueName: { color: '#fff', fontSize: 11, fontWeight: '700', flex: 1 },
  acceptBtn: {
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rejectBtn: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  queueBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  seatStrip: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    maxHeight: 36,
    zIndex: 5,
  },
  seatChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  seatText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rankStrip: {
    position: 'absolute',
    top: 180,
    left: 0,
    right: 0,
    maxHeight: 36,
    zIndex: 5,
  },
  rankContent: { paddingHorizontal: 16 },
  rankChip: {
    backgroundColor: 'rgba(212,175,55,0.88)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  rankText: { color: '#1A1200', fontWeight: '800', fontSize: 11, maxWidth: 160 },
  chatPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 130,
    height: 160,
    zIndex: 4,
  },
  chatRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: '92%',
  },
  chatSystem: { backgroundColor: 'rgba(80,60,120,0.45)' },
  chatGift: { backgroundColor: 'rgba(180,120,20,0.45)' },
  chatText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  chatName: { color: '#C9B6FF', fontWeight: '800' },
  pkOpponents: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    maxHeight: 36,
    zIndex: 5,
  },
  pkChip: {
    backgroundColor: 'rgba(255,77,109,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  pkChipText: { color: '#fff', fontWeight: '800', fontSize: 11, maxWidth: 120 },
  hostBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 6,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 12,
  },
  toolBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  endBtn: { backgroundColor: colors.danger },
  toolText: { color: colors.white, fontWeight: '800', fontSize: 11 },
});
