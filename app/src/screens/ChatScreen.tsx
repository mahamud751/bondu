import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Sound, {
  AudioEncoderAndroidType,
  OutputFormatAndroidType,
} from "react-native-nitro-sound";
import { API_URL, api , apiErrorMessage} from "../api/client";
import { realtime } from "../api/realtime";
import { Avatar, Field, Screen } from "../components/UI";
import { colors, radius, spacing } from "../theme";
import { launchImageLibrary } from "react-native-image-picker";
import { uploadAsset, uploadChatAsset } from "../api/uploads";

export function ChatScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const id = route.params?.conversationId ?? "";
  const title = route.params?.title ?? "Conversation";
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<any>();
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [playingId, setPlayingId] = useState<string>();
  const[gifts,setGifts]=useState<any[]>([]),[conversation,setConversation]=useState<any>(),[showGifts,setShowGifts]=useState(false);
  const load = useCallback(
    () =>
      Promise.all([api.get(`/chat/conversations/${id}/messages`),api.get(`/chat/conversations/${id}`),api.get('/gifts')]).then(([response,detail,catalog]) => {
        setMessages(response.data);setConversation(detail.data);setGifts(catalog.data.filter((item:any)=>item.enabledInChats!==false));
        void api.patch(`/chat/conversations/${id}/read`);
      }),
    [id],
  );
  useEffect(() => {
    navigation.setOptions({ title });
    void api.get("/users/me").then((r) => setMe(r.data.id));
    void load();
    let active = true;
    let client: any;
    const onMessage = (message: any) => {
      if (active && message.conversationId === id) {
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message],
        );
        void api.patch(`/chat/conversations/${id}/read`);
      }
    };
    const onReaction = (event: any) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === event.messageId
            ? { ...message, reactions: event.reactions }
            : message,
        ),
      );
    const onDelete = (event: any) =>
      setMessages((current) =>
        current.filter((message) => message.id !== event.messageId),
      );
    const typingStart = (event: any) =>
      event.conversationId === id && setOtherTyping(true);
    const typingStop = (event: any) =>
      event.conversationId === id && setOtherTyping(false);
    void realtime().then((value) => {
      client = value;
      client?.on("message:new", onMessage);
      client?.on("message:reaction", onReaction);
      client?.on("message:deleted", onDelete);
      client?.on("typing:start", typingStart);
      client?.on("typing:stop", typingStop);
    });
    return () => {
      active = false;
      client?.emit("typing:set", { conversationId: id, typing: false });
      client?.off("message:new", onMessage);
      client?.off("message:reaction", onReaction);
      client?.off("message:deleted", onDelete);
      client?.off("typing:start", typingStart);
      client?.off("typing:stop", typingStop);
      Sound.removeRecordBackListener();
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
      void Sound.stopPlayer().catch(() => undefined);
      void Sound.stopRecorder().catch(() => undefined);
    };
  }, [id, load, navigation, title]);
  const changeContent = (value: string) => {
    setContent(value);
    void realtime().then((client) =>
      client?.emit("typing:set", {
        conversationId: id,
        typing: Boolean(value.trim()),
      }),
    );
  };
  const send = async () => {
    const text = content.trim();
    if (!text) return;
    setContent("");
    void realtime().then((client) =>
      client?.emit("typing:set", { conversationId: id, typing: false }),
    );
    try {
      setBusy(true);
      const { data } = await api.post(`/chat/conversations/${id}/messages`, {
        content: text,
        type: "TEXT",
        replyToId: replyTo?.id,
        idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
      });
      setMessages((current) =>
        current.some((item) => item.id === data.id)
          ? current
          : [...current, data],
      );
      setReplyTo(undefined);
    } catch (error: any) {
      setContent(text);
      Alert.alert(
        "Message not sent",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const sendGift=async(gift:any)=>{const receiverId=conversation?.userOneId===me?conversation?.userTwoId:conversation?.userOneId;if(!receiverId)return;try{setBusy(true);await api.post(`/gifts/${gift.id}/send`,{receiverId,conversationId:id,idempotencyKey:`mobile-${Date.now()}-${Math.random()}`});setShowGifts(false);Alert.alert('Gift sent',`${gift.name} is now part of this conversation.`)}catch(error:any){Alert.alert('Gift not sent',apiErrorMessage(error, 'Try again'))}finally{setBusy(false)}};
  const attach = async () => {
    const selection = await launchImageLibrary({
      mediaType: "mixed",
      selectionLimit: 1,
      videoQuality: "medium",
    });
    const asset = selection.assets?.[0];
    if (!asset) return;
    try {
      setBusy(true);
      const attachmentId = await uploadChatAsset(asset),
        type = asset.type?.startsWith("video/") ? "VIDEO" : "IMAGE";
      const { data } = await api.post(`/chat/conversations/${id}/messages`, {
        attachmentId,
        type,
        replyToId: replyTo?.id,
        idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
      });
      setMessages((current) =>
        current.some((item) => item.id === data.id)
          ? current
          : [...current, data],
      );
      setReplyTo(undefined);
    } catch (error: any) {
      Alert.alert(
        "Attachment not sent",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const toggleRecording = async () => {
    if (recording) {
      try {
        setBusy(true);
        const uri = await Sound.stopRecorder();
        Sound.removeRecordBackListener();
        setRecording(false);
        if (recordingMs < 700) {
          setRecordingMs(0);
          return Alert.alert(
            "Voice note too short",
            "Hold a little longer and try again.",
          );
        }
        const blob = await fetch(uri).then((response) => response.blob()),
          mimeType = "audio/mp4";
        const attachmentId = await uploadAsset(
          {
            uri,
            type: mimeType,
            fileName: `voice-${Date.now()}.m4a`,
            fileSize: blob.size,
          },
          "CHAT",
        );
        const { data } = await api.post(`/chat/conversations/${id}/messages`, {
          attachmentId,
          type: "VOICE",
          replyToId: replyTo?.id,
          idempotencyKey: `mobile-${Date.now()}-${Math.random()}`,
        });
        setMessages((current) =>
          current.some((item) => item.id === data.id)
            ? current
            : [...current, data],
        );
        setReplyTo(undefined);
        setRecordingMs(0);
      } catch (error: any) {
        setRecording(false);
        Sound.removeRecordBackListener();
        Alert.alert(
          "Voice note not sent",
          apiErrorMessage(error, "Try again"),
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      if (Platform.OS === "android") {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED)
          throw new Error("Microphone permission is required");
      }
      await Sound.stopPlayer().catch(() => undefined);
      setPlayingId(undefined);
      setRecordingMs(0);
      setRecording(true);
      await Sound.startRecorder(
        undefined,
        {
          AudioQuality: "medium",
          AudioChannels: 1,
          AudioSamplingRate: 44_100,
          AudioEncodingBitRate: 96_000,
          OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
          AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
          AVEncodingOptionIOS: "aac",
        },
        true,
      );
      Sound.addRecordBackListener((event) =>
        setRecordingMs(event.currentPosition),
      );
    } catch (error: any) {
      setRecording(false);
      Sound.removeRecordBackListener();
      Alert.alert(
        "Could not record",
        error.message ?? "Check microphone access and try again",
      );
    }
  };
  const playVoice = async (item: any) => {
    try {
      if (playingId === item.id) {
        await Sound.stopPlayer();
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        return setPlayingId(undefined);
      }
      await Sound.stopPlayer().catch(() => undefined);
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) throw new Error("Please sign in again");
      setPlayingId(item.id);
      Sound.addPlaybackEndListener(() => {
        setPlayingId(undefined);
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
      });
      await Sound.startPlayer(
        `${API_URL}/files/${item.attachmentUrl}/content`,
        { Authorization: `Bearer ${token}` },
      );
    } catch (error: any) {
      setPlayingId(undefined);
      Alert.alert("Could not play voice note", error.message ?? "Try again");
    }
  };
  const interact = (item: any) => {
    const mine = item.senderId === me;
    const react = (emoji: string) =>
      api
        .post(`/chat/messages/${item.id}/reaction`, { emoji })
        .catch(() => Alert.alert("Could not react"));
    const remove = (mode: "SELF" | "EVERYONE") =>
      api
        .post(`/chat/messages/${item.id}/delete`, { mode })
        .catch((error: any) =>
          Alert.alert(
            "Could not delete",
            apiErrorMessage(error, "Try again"),
          ),
        );
    Alert.alert("Message actions", "React or remove this message", [
      { text: "Reply", onPress: () => setReplyTo(item) },
      ...["❤️", "👍", "😂", "🔥"].map((emoji) => ({
        text: emoji,
        onPress: () => void react(emoji),
      })),
      {
        text: "Delete for me",
        onPress: () => void remove("SELF"),
        style: "destructive",
      },
      ...(mine
        ? [
            {
              text: "Delete for everyone",
              onPress: () => void remove("EVERYONE"),
              style: "destructive" as const,
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.senderId === me;
            return (
              <Pressable
                onLongPress={() => interact(item)}
                style={[styles.bubbleRow, mine && styles.mineRow]}
              >
                {!mine ? <Avatar name={title} size={30} /> : null}
                <View>
                  <View
                    style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                  >
                    {item.replyTo ? (
                      <View style={[styles.quoted, mine && styles.quotedMine]}>
                        <Text
                          style={[styles.quotedLabel, mine && styles.mineText]}
                        >
                          {item.replyTo.senderId === me ? "You" : title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.quotedText, mine && styles.mineText]}
                        >
                          {item.replyTo.deletedAt
                            ? "Message unavailable"
                            : (item.replyTo.content ??
                              `${String(item.replyTo.type).toLowerCase()} attachment`)}
                        </Text>
                      </View>
                    ) : null}
                    {item.type === "VOICE" && item.attachmentUrl ? (
                      <Pressable
                        onPress={() => void playVoice(item)}
                        style={styles.voiceNote}
                      >
                        <Text
                          style={[styles.voiceIcon, mine && styles.mineText]}
                        >
                          {playingId === item.id ? "■" : "▶"}
                        </Text>
                        <View style={styles.wave}>
                          {[8, 14, 19, 11, 17, 8, 20, 13, 9].map(
                            (height, index) => (
                              <View
                                key={index}
                                style={[
                                  styles.waveBar,
                                  { height },
                                  mine && styles.waveBarMine,
                                ]}
                              />
                            ),
                          )}
                        </View>
                        <Text
                          style={[styles.voiceLabel, mine && styles.mineText]}
                        >
                          {playingId === item.id ? "Playing" : "Voice note"}
                        </Text>
                      </Pressable>
                    ) : item.attachmentUrl ? (
                      <Text
                        style={[styles.attachment, mine && styles.mineText]}
                      >
                        {item.type === "VIDEO" ? "▶ Video" : "▧ Image"}{" "}
                        attachment
                      </Text>
                    ) : null}
                    {item.content ? (
                      <Text style={[styles.message, mine && styles.mineText]}>
                        {item.content}
                      </Text>
                    ) : null}
                    {item.pointCost > 0 ? (
                      <Text style={[styles.cost, mine && styles.mineCost]}>
                        ✦ {item.pointCost} points
                      </Text>
                    ) : null}
                  </View>
                  {item.reactions?.length ? (
                    <View style={styles.reactions}>
                      {item.reactions.map((reaction: any) => (
                        <Text key={reaction.id}>{reaction.emoji}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Avatar name={title} size={70} />
              <Text style={styles.emptyTitle}>Start something meaningful</Text>
              <Text style={styles.emptyBody}>
                Say hello to {title}. Paid message pricing is shown before
                sending.
              </Text>
            </View>
          }
        />
        {otherTyping ? (
          <Text style={styles.typing}>{title} is typing…</Text>
        ) : null}
        {showGifts?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftTray}>{gifts.map(gift=><Pressable key={gift.id} style={styles.gift} disabled={busy} onPress={()=>void sendGift(gift)}><Text style={styles.giftIcon}>{gift.iconUrl}</Text><Text style={styles.giftName}>{gift.name}</Text><Text style={styles.giftCost}>{gift.pointPrice} pts</Text></Pressable>)}</ScrollView>:null}
        {replyTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyAccent} />
            <View style={styles.replyCopy}>
              <Text style={styles.replyTitle}>
                Replying to {replyTo.senderId === me ? "yourself" : title}
              </Text>
              <Text numberOfLines={1} style={styles.replyBody}>
                {replyTo.content ??
                  `${String(replyTo.type).toLowerCase()} attachment`}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyTo(undefined)}
              style={styles.replyClose}
            >
              <Text style={styles.replyCloseText}>×</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable disabled={busy} onPress={()=>setShowGifts(value=>!value)} style={styles.attach}><Text style={styles.giftButton}>✦</Text></Pressable>
          <Pressable disabled={busy} onPress={attach} style={styles.attach}>
            <Text style={styles.attachText}>＋</Text>
          </Pressable>
          {recording ? (
            <View style={styles.recording}>
              <View style={styles.recordDot} />
              <Text style={styles.recordingText}>
                Recording {Sound.mmssss(recordingMs)}
              </Text>
            </View>
          ) : (
            <Field
              style={styles.input}
              placeholder="Write a message…"
              value={content}
              onChangeText={changeContent}
              multiline
              maxLength={2000}
            />
          )}
          <Pressable
            disabled={busy}
            onPress={() => void toggleRecording()}
            style={[styles.mic, recording && styles.micActive]}
          >
            <Text style={styles.micText}>{recording ? "■" : "●"}</Text>
          </Pressable>
          <Pressable
            disabled={busy || !content.trim()}
            onPress={send}
            style={[styles.send, (busy || !content.trim()) && { opacity: 0.4 }]}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, flexGrow: 1 },
  giftTray:{gap:8,paddingHorizontal:spacing.md,paddingVertical:10},gift:{width:76,padding:8,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center'},giftIcon:{fontSize:24},giftName:{color:colors.text,fontSize:9,fontWeight:'800',marginTop:3},giftCost:{color:colors.primary,fontSize:9},giftButton:{color:colors.primary,fontSize:18,fontWeight:'900'},
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
    maxWidth: "84%",
  },
  mineRow: { alignSelf: "flex-end" },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  theirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: { color: colors.text, lineHeight: 20 },
  quoted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 7,
    minWidth: 150,
  },
  quotedMine: { borderLeftColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.12)" },
  quotedLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 2,
  },
  quotedText: { color: colors.muted, fontSize: 11 },
  attachment: { color: colors.primary, fontWeight: "800", marginBottom: 4 },
  voiceNote: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 210,
    gap: 9,
  },
  voiceIcon: { color: colors.primary, fontWeight: "900" },
  wave: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
  waveBarMine: { backgroundColor: "rgba(255,255,255,0.75)" },
  voiceLabel: { color: colors.muted, fontSize: 10 },
  mineText: { color: "#FFF" },
  cost: { color: colors.gold, fontSize: 10, fontWeight: "700", marginTop: 5 },
  mineCost: { color: "rgba(255,255,255,0.75)" },
  reactions: {
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 2,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: -5,
  },
  typing: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  replyCopy: { flex: 1 },
  replyTitle: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  replyBody: { color: colors.muted, fontSize: 11, marginTop: 2 },
  replyClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  replyCloseText: { color: colors.muted, fontSize: 24 },
  composer: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 8,
  },
  attach: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  attachText: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  input: { flex: 1, marginBottom: 0, maxHeight: 110, paddingTop: 15, borderRadius: 22 },
  recording: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  recordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  recordingText: { color: colors.danger, fontWeight: "800" },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  micActive: { backgroundColor: colors.danger },
  micText: { color: "#FFF", fontSize: 14 },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#FFF", fontSize: 25, fontWeight: "900" },
  empty: {
    flex: 1,
    minHeight: 380,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 18,
    marginTop: 16,
  },
  emptyBody: {
    color: colors.muted,
    textAlign: "center",
    maxWidth: 270,
    lineHeight: 20,
    marginTop: 7,
  },
});
