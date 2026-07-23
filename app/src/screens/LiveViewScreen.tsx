import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { Avatar } from '../components/UI';
import { GiftFxPlayer, type GiftFxEvent } from '../components/GiftFxPlayer';
import { LiveSeatGrid } from '../components/LiveSeatGrid';
import { VirtualAvatar3D } from '../components/VirtualAvatar3D';
import { DrawGuessGame } from '../components/DrawGuessGame';
import { colors } from '../theme';

type GiftItem = {
  id: string;
  name: string;
  iconUrl: string;
  pointPrice: number;
  enabledInLive?: boolean;
};

type GiftEvent = GiftFxEvent;

type ChatMessage = {
  id: string;
  body: string;
  kind: string;
  displayName: string;
  isVerified?: boolean;
  userId: string;
  translated?: string;
  translateTo?: string;
};

type RankEntry = {
  rank: number;
  userId: string;
  points: number;
  displayName: string;
};

type Seat = {
  seatIndex: number;
  role: string;
  muted: boolean;
  cameraOff: boolean;
  userId: string;
  displayName: string;
};

type PkState = {
  id: string;
  status: string;
  challengerScore: number;
  opponentScore: number;
  endsAt?: string | null;
  challenger: { liveId: string; host?: { displayName?: string } };
  opponent: { liveId: string; host?: { displayName?: string } };
  winnerLiveId?: string | null;
};

const HEARTS = ['♡', '♥', '✦', '★'];

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
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [status, setStatus] = useState('Connecting…');
  const [provider, setProvider] = useState('');
  const [host, setHost] = useState<any>();
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [chatMuted, setChatMuted] = useState(false);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [giftEvent, setGiftEvent] = useState<GiftEvent>();
  const [sendingGiftId, setSendingGiftId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [pk, setPk] = useState<PkState | null>(null);
  const [mode, setMode] = useState<'VIDEO' | 'AUDIO'>('VIDEO');
  const [seatsOpen, setSeatsOpen] = useState(true);
  const [mySeat, setMySeat] = useState<any>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [rtcRole, setRtcRole] = useState<'VIEWER' | 'GUEST' | 'HOST'>('VIEWER');
  const [draft, setDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [showGifts, setShowGifts] = useState(false);
  const [fanClub, setFanClub] = useState<any>(null);
  const [joiningClub, setJoiningClub] = useState(false);
  const [superFan, setSuperFan] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [entryFx, setEntryFx] = useState<string | null>(null);
  const [showPackages, setShowPackages] = useState(false);
  const [virtualMode, setVirtualMode] = useState(false);
  const [virtualAvatar, setVirtualAvatar] = useState('fox');
  const [game, setGame] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(true);

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
      /* best-effort */
    }
    if (reason) Alert.alert(reason);
    navigation.goBack();
  };

  const applyPublisherRole = (engineRef: IRtcEngine, asGuest: boolean) => {
    engineRef.setClientRole(
      asGuest
        ? ClientRoleType.ClientRoleBroadcaster
        : ClientRoleType.ClientRoleAudience,
    );
    if (asGuest) {
      engineRef.enableAudio();
      engineRef.muteLocalAudioStream(false);
      engineRef.muteLocalVideoStream(false);
    } else {
      engineRef.muteLocalAudioStream(true);
      engineRef.muteLocalVideoStream(true);
    }
  };

  useEffect(() => {
    let mounted = true;
    let socket: any;
    const pushGift = (event: GiftEvent) => {
      setGiftEvent(event);
      setTimeout(() => {
        if (mounted)
          setGiftEvent((current) => (current === event ? undefined : current));
      }, 2800);
    };

    const connect = async () => {
      try {
        const { data: access } = await api.post(`/live/${liveId}/join`);
        if (!mounted) return;
        setHost(access.host);
        setProvider(access.provider);
        setViewerCount(access.viewerCount ?? 0);
        setLikeCount(access.likeCount ?? 0);
        setChatMuted(!!access.chatMuted);
        setMessages(access.messages ?? []);
        setRanking(access.ranking ?? []);
        setSeats(access.seats ?? []);
        setPk(access.pk ?? null);
        setMode(access.mode === 'AUDIO' ? 'AUDIO' : 'VIDEO');
        setSeatsOpen(access.seatsOpen !== false);
        setMySeat(access.mySeat ?? null);
        setPendingRequestId(access.pendingRequestId ?? null);
        setRtcRole(access.rtcRole ?? 'VIEWER');
        setPackages(access.packages ?? []);
        setSuperFan(access.superFan ?? null);
        setVirtualMode(!!access.virtualMode);
        setVirtualAvatar(access.virtualAvatar ?? 'fox');
        setSeats(access.seats ?? []);
        void api
          .get(`/live/${liveId}/game`)
          .then((r) => setGame(r.data))
          .catch(() => undefined);
        setStatus(
          access.provider === 'AGORA'
            ? 'Waiting for host…'
            : 'Development live simulation',
        );
        void api.get('/gifts').then((response) =>
          setGifts(
            response.data.filter(
              (item: GiftItem) => item.enabledInLive !== false,
            ),
          ),
        );
        if (access.host?.userId) {
          void api
            .get(`/fan-clubs/${access.host.userId}`)
            .then((r) => setFanClub(r.data))
            .catch(() => undefined);
        }

        socket = await realtime();
        socket?.emit('live:watch', { liveId });
        socket?.on(
          'live:viewer-count',
          (p: { liveId: string; viewerCount: number }) => {
            if (p.liveId === liveId) setViewerCount(p.viewerCount);
          },
        );
        socket?.on('live:ended', (p: { liveId: string }) => {
          if (p.liveId === liveId) void leave('This stream has ended');
        });
        socket?.on('gift:animation', pushGift);
        socket?.on('live:chat', (payload: ChatMessage & { liveId?: string }) => {
          if (payload.liveId && payload.liveId !== liveId) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev;
            return [...prev, payload].slice(-80);
          });
        });
        socket?.on(
          'live:like',
          (p: { liveId: string; likeCount: number }) => {
            if (p.liveId === liveId) {
              setLikeCount(p.likeCount);
              setHeartBurst((n) => n + 1);
            }
          },
        );
        socket?.on(
          'live:chat-muted',
          (p: { liveId: string; muted: boolean }) => {
            if (p.liveId === liveId) setChatMuted(p.muted);
          },
        );
        socket?.on(
          'live:ranking',
          (p: { liveId: string; ranking: RankEntry[] }) => {
            if (p.liveId === liveId) setRanking(p.ranking ?? []);
          },
        );
        socket?.on('live:banned', (p: { liveId: string }) => {
          if (p.liveId === liveId)
            void leave('You were removed from this stream');
        });
        socket?.on('live:seats', (p: { liveId: string; seats: Seat[] }) => {
          if (p.liveId === liveId) setSeats(p.seats ?? []);
        });
        socket?.on('live:seats-open', (p: { liveId: string; open: boolean }) => {
          if (p.liveId === liveId) setSeatsOpen(p.open);
        });
        socket?.on('live:pk-started', (p: PkState) => setPk(p));
        socket?.on('live:pk-score', (p: PkState) => setPk(p));
        socket?.on('live:pk-ended', (p: PkState) => {
          setPk(p);
          const won =
            p.winnerLiveId === liveId
              ? 'Your host won PK!'
              : p.winnerLiveId
                ? 'PK finished'
                : 'PK ended in a draw';
          Alert.alert('PK result', won);
        });
        socket?.on('live:pk-challenge', (p: PkState) => {
          if (p.status === 'PENDING') setPk(p);
        });
        socket?.on('live:mic-accepted', async (p: any) => {
          if (p.liveId !== liveId) return;
          setMySeat(p.seat);
          setPendingRequestId(null);
          setRtcRole('GUEST');
          if (engine.current && p.token) {
            applyPublisherRole(engine.current, true);
            engine.current.renewToken(p.token);
          } else if (p.token && access.provider === 'AGORA') {
            // rejoin as publisher if needed
          }
          Alert.alert('You are on stage', 'You can speak with the host now.');
        });
        socket?.on('live:mic-rejected', (p: { liveId: string }) => {
          if (p.liveId === liveId) {
            setPendingRequestId(null);
            Alert.alert('Request declined', 'The host declined your mic request.');
          }
        });
        socket?.on('live:seat-kicked', (p: { liveId: string }) => {
          if (p.liveId === liveId) {
            setMySeat(null);
            setRtcRole('VIEWER');
            if (engine.current) applyPublisherRole(engine.current, false);
            Alert.alert('Removed from stage', 'The host removed your seat.');
          }
        });
        socket?.on('live:role-changed', (p: any) => {
          if (p.liveId !== liveId) return;
          setRtcRole(p.rtcRole);
          if (engine.current) {
            applyPublisherRole(engine.current, p.rtcRole === 'GUEST');
            if (p.token) engine.current.renewToken(p.token);
          }
          if (p.rtcRole === 'VIEWER') setMySeat(null);
        });
        socket?.on(
          'live:entry-fx',
          (p: { liveId: string; displayName?: string; entryFx?: string }) => {
            if (p.liveId !== liveId) return;
            setEntryFx(`${p.displayName ?? 'Super fan'} · ${p.entryFx ?? 'ENTER'}`);
            setTimeout(() => setEntryFx(null), 3200);
          },
        );
        socket?.on('live:virtual-mode', (p: any) => {
          if (p.liveId === liveId) {
            setVirtualMode(!!p.virtualMode);
            setVirtualAvatar(p.virtualAvatar ?? 'fox');
          }
        });
        socket?.on('live:game', (p: any) => setGame(p));
        socket?.on('live:game-stroke', (p: any) => {
          setGame((g: any) =>
            g ? { ...g, strokes: p.strokes ?? g.strokes } : g,
          );
        });

        if (access.provider === 'AGORA') {
          const rtc = createAgoraRtcEngine();
          engine.current = rtc;
          rtc.initialize({
            appId: access.appId,
            channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          });
          if (access.mode !== 'AUDIO') rtc.enableVideo();
          rtc.enableAudio();
          const asGuest = access.rtcRole === 'GUEST';
          rtc.setClientRole(
            asGuest
              ? ClientRoleType.ClientRoleBroadcaster
              : ClientRoleType.ClientRoleAudience,
          );
          const handler: IRtcEngineEventHandler = {
            onUserJoined: (_connection, uid) => {
              if (!mounted) return;
              setRemoteUids((prev) =>
                prev.includes(uid) ? prev : [...prev, uid],
              );
              setStatus('Live');
            },
            onUserOffline: (_connection, uid) => {
              if (!mounted) return;
              setRemoteUids((prev) => prev.filter((id) => id !== uid));
            },
          };
          rtc.registerEventHandler(handler);
          const result = rtc.joinChannelWithUserAccount(
            access.token,
            access.channelName,
            access.userAccount,
            {
              autoSubscribeAudio: true,
              autoSubscribeVideo: access.mode !== 'AUDIO',
              publishMicrophoneTrack: asGuest,
              publishCameraTrack: asGuest && access.mode !== 'AUDIO',
              clientRoleType: asGuest
                ? ClientRoleType.ClientRoleBroadcaster
                : ClientRoleType.ClientRoleAudience,
            },
          );
          if (result < 0) throw new Error(`Agora join failed (${result})`);
        }
      } catch (error: any) {
        Alert.alert(
          'Could not join stream',
          apiErrorMessage(error, 'Try again'),
        );
        navigation.goBack();
      }
    };
    void connect();
    return () => {
      mounted = false;
      if (!left.current) void leave();
    };
  }, [liveId]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }, [messages.length]);

  const sendGift = async (gift: GiftItem) => {
    const hostUserId = host?.userId;
    if (!hostUserId) {
      Alert.alert('Gift not sent', 'Host is still connecting.');
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
      setShowGifts(false);
    } catch (error: any) {
      Alert.alert('Gift not sent', apiErrorMessage(error, 'Try again'));
    } finally {
      setSendingGiftId(undefined);
    }
  };

  const sendChat = async () => {
    const body = draft.trim();
    if (!body || sendingChat) return;
    if (chatMuted) {
      Alert.alert('Chat muted', 'The host muted chat for this stream.');
      return;
    }
    try {
      setSendingChat(true);
      setDraft('');
      await api.post(`/live/${liveId}/chat`, { body });
    } catch (error: any) {
      setDraft(body);
      Alert.alert('Message not sent', apiErrorMessage(error, 'Try again'));
    } finally {
      setSendingChat(false);
    }
  };

  const sendLike = async () => {
    setHeartBurst((n) => n + 1);
    try {
      await api.post(`/live/${liveId}/like`);
    } catch {
      /* free like */
    }
  };

  const requestMic = async () => {
    try {
      if (pendingRequestId) {
        await api.post(`/live/${liveId}/mic/cancel`);
        setPendingRequestId(null);
        return;
      }
      if (mySeat) {
        await api.post(`/live/${liveId}/seat/leave`);
        setMySeat(null);
        setRtcRole('VIEWER');
        if (engine.current) applyPublisherRole(engine.current, false);
        return;
      }
      const { data } = await api.post(`/live/${liveId}/mic/request`, {});
      setPendingRequestId(data.id);
      Alert.alert('Hand raised', 'Waiting for the host to accept…');
    } catch (error: any) {
      Alert.alert('Could not request mic', apiErrorMessage(error, 'Try again'));
    }
  };

  const joinFanClub = async () => {
    if (!host?.userId || joiningClub) return;
    try {
      setJoiningClub(true);
      const { data } = await api.post(`/fan-clubs/${host.userId}/join`);
      setFanClub(data.club ?? data);
      Alert.alert('Welcome', 'You joined the fan club!');
    } catch (error: any) {
      Alert.alert('Could not join', apiErrorMessage(error, 'Try again'));
    } finally {
      setJoiningClub(false);
    }
  };

  const joinSuperFan = async () => {
    if (!host?.userId) return;
    try {
      const { data } = await api.post(`/super-fans/${host.userId}/join`);
      setSuperFan({ active: true, entryFx: data.superFan?.entryFx, cost: 200 });
      Alert.alert('Super fan', 'You unlocked VIP entry effects for 30 days.');
    } catch (error: any) {
      Alert.alert('Could not join Super fan', apiErrorMessage(error, 'Try again'));
    }
  };

  const openDm = async () => {
    try {
      const { data } = await api.post(`/live/${liveId}/dm`);
      navigation.navigate('Chat', {
        conversationId: data.conversationId,
        title: host?.displayName ?? 'Host',
      });
    } catch (error: any) {
      Alert.alert('Could not open chat', apiErrorMessage(error, 'Try again'));
    }
  };

  const buyPackage = async (pkg: any) => {
    try {
      await api.post(`/packages/${pkg.id}/purchase`, {
        idempotencyKey: `live-pkg-${liveId}-${pkg.id}-${Date.now()}`,
      });
      Alert.alert('Package purchased', `${pkg.name} is in your wallet.`);
      setShowPackages(false);
    } catch (error: any) {
      Alert.alert('Purchase failed', apiErrorMessage(error, 'Try again'));
    }
  };

  const bookPrivate = async () => {
    if (!host?.userId || !host?.vendorId) {
      Alert.alert('Private call', 'This host is not available for private calls yet.');
      return;
    }
    try {
      const { data } = await api.post('/calls/request', {
        vendorId: host.vendorId,
        callType: 'VOICE',
        maximumSeconds: 300,
        idempotencyKey: `live-private-${liveId}-${Date.now()}`,
      });
      if (data?.status === 'ACCEPTED') {
        navigation.navigate('ActiveCall', {
          callId: data.id,
          title: host.displayName ?? 'Creator',
          callType: 'VOICE',
        });
      } else {
        navigation.navigate('OutgoingCall', {
          callId: data.id,
          title: host.displayName ?? 'Creator',
          callType: 'VOICE',
        });
      }
    } catch (error: any) {
      Alert.alert('Could not start private call', apiErrorMessage(error, 'Try again'));
    }
  };

  const primaryUid = remoteUids[0];
  const guestUids = remoteUids.slice(1, 5);

  return (
    <View style={styles.stage}>
      {virtualMode ? (
        <View style={styles.waiting}>
          <VirtualAvatar3D avatarId={virtualAvatar} speaking size={220} />
        </View>
      ) : provider === 'AGORA' && primaryUid != null && mode === 'VIDEO' ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{ uid: primaryUid }}
        />
      ) : (
        <View style={styles.waiting}>
          <Avatar name={host?.displayName} size={96} />
          <Text style={styles.waitingText}>
            {mode === 'AUDIO' ? 'Audio room' : status}
          </Text>
          {provider === 'DEVELOPMENT' ? (
            <Text style={styles.devHint}>
              Simulated live · multi-guest, chat & gifts work
            </Text>
          ) : null}
        </View>
      )}

      <GiftFxPlayer event={giftEvent} />

      {guestUids.length > 0 && mode === 'VIDEO' ? (
        <View style={styles.guestStrip}>
          {guestUids.map((uid) => (
            <RtcSurfaceView
              key={uid}
              style={styles.guestTile}
              canvas={{ uid }}
            />
          ))}
        </View>
      ) : null}

      {seats.length > 0 ? (
        <View style={styles.seatGridWrap}>
          <LiveSeatGrid seats={seats} maxGuests={8} mode={mode} />
        </View>
      ) : null}

      <View style={styles.gameWrap}>
        <DrawGuessGame
          game={game}
          isHost={false}
          onStart={() => undefined}
          onEnd={() => undefined}
          onStroke={() => undefined}
          onGuess={(g) =>
            void api
              .post(`/live/${liveId}/game/guess`, { guess: g })
              .then((r) => {
                if (r.data?.correct) Alert.alert('Correct!', 'You got it');
              })
              .catch((e) =>
                Alert.alert('Guess', apiErrorMessage(e, 'Try again')),
              )
          }
        />
      </View>

      {pk && (pk.status === 'ACTIVE' || pk.status === 'PENDING') ? (
        <View style={styles.pkBar}>
          <Text style={styles.pkTitle}>
            {pk.status === 'PENDING' ? 'PK challenge…' : 'PK BATTLE'}
          </Text>
          <View style={styles.pkScores}>
            <Text style={styles.pkScore}>
              {pk.challenger?.host?.displayName ?? 'A'} {pk.challengerScore}
            </Text>
            <Text style={styles.pkVs}>VS</Text>
            <Text style={styles.pkScore}>
              {pk.opponentScore} {pk.opponent?.host?.displayName ?? 'B'}
            </Text>
          </View>
        </View>
      ) : null}

      {entryFx ? (
        <View style={styles.entryFx}>
          <Text style={styles.entryFxText}>{entryFx}</Text>
        </View>
      ) : null}

      {heartBurst > 0
        ? Array.from({ length: Math.min(6, heartBurst) }).map((_, i) => (
            <Text
              key={`${heartBurst}-${i}`}
              style={[
                styles.heart,
                { right: 18 + (i % 3) * 14, bottom: 180 + (i % 4) * 18 },
              ]}
            >
              {HEARTS[i % HEARTS.length]}
            </Text>
          ))
        : null}

      <View style={styles.top}>
        <View style={styles.hostChip}>
          <Text style={styles.hostName} numberOfLines={1}>
            {host?.displayName ?? 'Streaming'}
          </Text>
        </View>
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
        <Pressable style={styles.closeButton} onPress={() => void leave()}>
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        {host?.canBookCall ? (
          <Pressable style={styles.actionChip} onPress={() => void bookPrivate()}>
            <Text style={styles.actionText}>Private call</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionChip} onPress={() => void openDm()}>
          <Text style={styles.actionText}>Message</Text>
        </Pressable>
        {packages.length ? (
          <Pressable
            style={styles.actionChip}
            onPress={() => setShowPackages((v) => !v)}
          >
            <Text style={styles.actionText}>Packages</Text>
          </Pressable>
        ) : null}
        {fanClub && !fanClub.membership ? (
          <Pressable
            style={styles.actionChip}
            onPress={() => void joinFanClub()}
            disabled={joiningClub}
          >
            <Text style={styles.actionText}>
              {joiningClub
                ? '…'
                : `Fan club · ${fanClub.joinCost ?? 10} pts`}
            </Text>
          </Pressable>
        ) : fanClub?.membership ? (
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>
              Fan Lv{fanClub.membership.level}
            </Text>
          </View>
        ) : null}
        {superFan && !superFan.active ? (
          <Pressable style={styles.actionChip} onPress={() => void joinSuperFan()}>
            <Text style={styles.actionText}>
              Super fan · {superFan.cost ?? 200}
            </Text>
          </Pressable>
        ) : superFan?.active ? (
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>VIP entry</Text>
          </View>
        ) : null}
        {seatsOpen ? (
          <Pressable style={styles.actionChip} onPress={() => void requestMic()}>
            <Text style={styles.actionText}>
              {mySeat
                ? 'Leave seat'
                : pendingRequestId
                  ? 'Cancel hand'
                  : 'Raise hand'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showPackages && packages.length ? (
        <ScrollView
          horizontal
          style={styles.pkgStrip}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {packages.map((pkg) => (
            <Pressable
              key={pkg.id}
              style={styles.pkgChip}
              onPress={() => void buyPackage(pkg)}
            >
              <Text style={styles.pkgText} numberOfLines={1}>
                {pkg.name} · {pkg.price}pts
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

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
              <Text style={styles.chatText} numberOfLines={4}>
                {item.kind === 'USER' ? (
                  <Text style={styles.chatName}>
                    {item.displayName}
                    {item.isVerified ? ' ✓' : ''}:{' '}
                  </Text>
                ) : null}
                {item.body}
                {showTranslation && item.translated ? (
                  <Text style={styles.chatTr}>
                    {'\n'}↪ {item.translated}
                  </Text>
                ) : null}
              </Text>
            </View>
          )}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
        style={styles.bottom}
      >
        {showGifts ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gifts}
          >
            {gifts.slice(0, 16).map((gift) => {
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
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={chatMuted ? 'Chat is muted' : 'Say something…'}
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={200}
            editable={!chatMuted}
            onSubmitEditing={() => void sendChat()}
            returnKeyType="send"
          />
          <Pressable style={styles.iconBtn} onPress={() => void sendChat()}>
            <Text style={styles.iconBtnText}>➤</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => void sendLike()}>
            <Text style={styles.iconBtnText}>♡</Text>
          </Pressable>
          <Pressable
            style={[styles.iconBtn, styles.giftToggle]}
            onPress={() => setShowGifts((v) => !v)}
          >
            <Text style={styles.iconBtnText}>✦</Text>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowTranslation((v) => !v)}
          >
            <Text style={styles.iconBtnText}>{showTranslation ? '文' : 'A'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  guestStrip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 10,
    gap: 6,
    zIndex: 4,
  },
  guestTile: {
    width: 88,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  seatGridWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 10,
    right: 100,
    zIndex: 5,
    maxHeight: 120,
  },
  gameWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 200,
    zIndex: 6,
  },
  pkBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(90,20,60,0.9)',
    borderRadius: 16,
    padding: 10,
    zIndex: 6,
  },
  pkTitle: {
    color: colors.gold,
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  pkScores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  pkScore: { color: '#fff', fontWeight: '800', fontSize: 13, flex: 1 },
  pkVs: { color: colors.gold, fontWeight: '900', marginHorizontal: 8 },
  entryFx: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    zIndex: 12,
    backgroundColor: 'rgba(212,175,55,0.92)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  entryFxText: { color: '#1A1200', fontWeight: '900', fontSize: 13 },
  pkgStrip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 250 : 230,
    left: 0,
    right: 0,
    maxHeight: 40,
    zIndex: 6,
  },
  pkgChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  pkgText: { color: '#111', fontWeight: '800', fontSize: 11, maxWidth: 140 },
  giftEvent: {
    position: 'absolute',
    top: '30%',
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
  heart: {
    position: 'absolute',
    zIndex: 8,
    color: '#FF5C8A',
    fontSize: 22,
    fontWeight: '900',
  },
  top: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveBadgeText: { color: colors.white, fontWeight: '800', fontSize: 11 },
  viewerBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewerBadgeText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  actionRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 170 : 150,
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 5,
  },
  actionChip: {
    backgroundColor: 'rgba(160,32,240,0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  rankStrip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 210 : 190,
    left: 0,
    right: 0,
    maxHeight: 36,
    zIndex: 5,
  },
  rankContent: { paddingHorizontal: 16, gap: 8 },
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
    right: 90,
    bottom: 100,
    height: 180,
    zIndex: 4,
  },
  chatRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: '100%',
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
  chatTr: { color: colors.gold, fontWeight: '600', fontSize: 11 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    zIndex: 6,
  },
  gifts: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    color: colors.white,
    fontSize: 14,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftToggle: { backgroundColor: colors.primary },
  iconBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
