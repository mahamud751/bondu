import React, { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

export function GoLiveScreen({ navigation }: { navigation: any }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ id: string } | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [provider, setProvider] = useState('');
  const engine = useRef<IRtcEngine | undefined>(undefined);
  const liveIdRef = useRef<string | undefined>(undefined);

  const stop = async (navigateBack = true) => {
    const id = liveIdRef.current;
    liveIdRef.current = undefined;
    engine.current?.leaveChannel();
    engine.current?.release();
    engine.current = undefined;
    const socket = await realtime();
    if (id) { socket?.emit('live:unwatch', { liveId: id }); try { await api.post(`/live/${id}/end`); } catch {} }
    if (navigateBack) navigation.goBack();
  };

  useEffect(() => () => { if (liveIdRef.current) void stop(false); }, []);

  const start = async () => {
    try {
      setBusy(true);
      if (Platform.OS === 'android') {
        const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (camera !== PermissionsAndroid.RESULTS.GRANTED || mic !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Camera and microphone permissions are required to go live');
        }
      }
      const { data: access } = await api.post('/live/start', { title: title.trim() || undefined });
      liveIdRef.current = access.id;
      setProvider(access.provider);
      const socket = await realtime();
      socket?.emit('live:watch', { liveId: access.id });
      socket?.on('live:viewer-count', (payload: { liveId: string; viewerCount: number }) => {
        if (payload.liveId === access.id) setViewerCount(payload.viewerCount);
      });
      if (access.provider === 'AGORA') {
        const rtc = createAgoraRtcEngine();
        engine.current = rtc;
        rtc.initialize({ appId: access.appId, channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting });
        rtc.enableVideo();
        rtc.startPreview();
        rtc.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        const handler: IRtcEngineEventHandler = {};
        rtc.registerEventHandler(handler);
        const result = rtc.joinChannelWithUserAccount(access.token, access.channelName, access.userAccount, {
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
          publishMicrophoneTrack: true,
          publishCameraTrack: true,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        });
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
        <Text style={styles.body}>Broadcast video to everyone on SocialConnect. Viewers can watch and send gifts in real time.</Text>
        <Field placeholder="Give your stream a title (optional)" value={title} onChangeText={setTitle} maxLength={80} />
        <Button title="Go live" loading={busy} onPress={start} />
      </Screen>
    );
  }

  return (
    <View style={styles.stage}>
      {provider === 'AGORA' ? <RtcSurfaceView style={StyleSheet.absoluteFillObject} canvas={{ uid: 0 }} /> : (
        <View style={styles.simulated}><Text style={styles.simulatedText}>Development live simulation</Text></View>
      )}
      <View style={styles.overlayTop}>
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>● LIVE</Text></View>
        <View style={styles.viewerBadge}><Text style={styles.viewerBadgeText}>◉ {viewerCount}</Text></View>
      </View>
      <Pressable style={styles.endButton} onPress={() => void stop()}>
        <Text style={styles.endButtonText}>End stream</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 10 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: spacing.xl },
  stage: { flex: 1, backgroundColor: '#000' },
  simulated: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  simulatedText: { color: colors.textSoft, fontSize: 15 },
  overlayTop: { position: 'absolute', top: 56, left: 16, right: 16, flexDirection: 'row', gap: 10 },
  liveBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  liveBadgeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  viewerBadge: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  viewerBadgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  endButton: { position: 'absolute', bottom: 48, alignSelf: 'center', backgroundColor: colors.danger, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 999 },
  endButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
