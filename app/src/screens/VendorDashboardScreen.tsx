import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Asset,
  launchCamera,
  launchImageLibrary,
} from "react-native-image-picker";
import { api } from "../api/client";
import { uploadAsset } from "../api/uploads";
import {
  Button,
  Card,
  Eyebrow,
  Field,
  Pill,
  Screen,
  SectionTitle,
  Title,
} from "../components/UI";
import { colors, radius, spacing } from "../theme";
import { useNavigation } from '@react-navigation/native';

export function VendorDashboardScreen() {
  const navigation=useNavigation<any>();
  const [user, setUser] = useState<any>(),
    [legalName, setLegal] = useState(""),
    [nidNumber, setNid] = useState("");
  const[address,setAddress]=useState(''),[contactEmail,setContactEmail]=useState(''),[description,setDescription]=useState(''),[languages,setLanguages]=useState('Bangla, English'),[preferredHours,setPreferredHours]=useState('09:00–21:00 Asia/Dhaka'),[payoutMethod,setPayoutMethod]=useState<'BKASH'|'NAGAD'|'BANK'>('BKASH'),[payoutAccount,setPayoutAccount]=useState(''),[voiceEnabled,setVoiceEnabled]=useState(true),[videoEnabled,setVideoEnabled]=useState(false);
  const [breakActive,setBreakActive]=useState(false),[autoAccept,setAutoAccept]=useState(false),[maximumDailyCalls,setMaximumDailyCalls]=useState(''),[minimumCallerBalance,setMinimumCallerBalance]=useState('0');
  const [front, setFront] = useState<Asset>(),
    [back, setBack] = useState<Asset>(),
    [selfie, setSelfie] = useState<Asset>(),
    [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<any[]>([]),
    [startTime, setStartTime] = useState("09:00"),
    [endTime, setEndTime] = useState("21:00");
  const load = async () => {
    const response = await api.get("/users/me");
    setUser(response.data);
    if(!response.data.vendor){setContactEmail(response.data.email??'');setDescription(response.data.profile?.bio??'');setLanguages((response.data.profile?.languages??['Bangla','English']).join(', '))}
    if (response.data.vendor) {
      setBreakActive(response.data.vendor.breakActive??false);
      setAutoAccept(response.data.vendor.autoAcceptCalls??false);
      setMaximumDailyCalls(response.data.vendor.maximumDailyCalls?String(response.data.vendor.maximumDailyCalls):'');
      setMinimumCallerBalance(String(response.data.vendor.minimumCallerBalance??0));
      const result = await api.get("/vendors/schedule");
      setSchedule(result.data);
      if (result.data[0]) {
        const format = (minute: number) =>
          `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        setStartTime(format(result.data[0].startMinute));
        setEndTime(format(result.data[0].endMinute));
      }
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const choose = async (setter: (asset: Asset) => void) => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });
    if (result.assets?.[0]) setter(result.assets[0]);
  };
  const capture = async () => {
    const result = await launchCamera({
      mediaType: "photo",
      cameraType: "front",
      saveToPhotos: false,
    });
    if (result.assets?.[0]) setSelfie(result.assets[0]);
  };
  const apply = async () => {
    if (!front || !back || !selfie) return;
    try {
      setBusy(true);
      const [nidFrontAssetId, nidBackAssetId, selfieAssetId] =
        await Promise.all([
          uploadAsset(front, "KYC"),
          uploadAsset(back, "KYC"),
          uploadAsset(selfie, "KYC"),
        ]);
      await api.post("/vendors/apply", {
        legalName,
        nidNumber,
        nidFrontAssetId,
        nidBackAssetId,
        selfieAssetId,
        address,
        contactEmail,
        profileDescription:description,
        supportedLanguages:languages.split(',').map(value=>value.trim()).filter(Boolean),
        preferredWorkingHours:preferredHours,
        payoutMethod,
        payoutAccount,
        voiceCallEnabled:voiceEnabled,
        videoCallEnabled:videoEnabled,
      });
      Alert.alert(
        "Application submitted",
        "Your encrypted identity details are ready for private review.",
      );
      void load();
    } catch (error: any) {
      Alert.alert(
        "Could not submit",
        error.response?.data?.message ?? error.message ?? "Try again",
      );
    } finally {
      setBusy(false);
    }
  };
  const available = user?.vendor?.availableForCall;
  const enabledDays = new Set(
    schedule.filter((item) => item.enabled).map((item) => item.dayOfWeek),
  );
  const toggleDay = (dayOfWeek: number) =>
    setSchedule((current) =>
      enabledDays.has(dayOfWeek)
        ? current.filter((item) => item.dayOfWeek !== dayOfWeek)
        : [...current, { dayOfWeek, enabled: true }],
    );
  const saveSchedule = async () => {
    const parse = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    )
      return Alert.alert(
        "Use 24-hour time",
        "Enter hours like 09:00 and 21:00.",
      );
    try {
      setBusy(true);
      await api.patch("/vendors/schedule", {
        entries: [...enabledDays].map((dayOfWeek) => ({
          dayOfWeek,
          startMinute: parse(startTime),
          endMinute: parse(endTime),
          timezone: "Asia/Dhaka",
          enabled: true,
        })),
      });
      await load();
      Alert.alert(
        "Schedule saved",
        "Call requests will be accepted only inside these working hours while you are online.",
      );
    } catch (error: any) {
      Alert.alert(
        "Could not save schedule",
        error.response?.data?.message ?? "Try again",
      );
    } finally {
      setBusy(false);
    }
  };
  const verifyIdentity = async () => {
    try {
      setBusy(true);
      const { data } = await api.post("/vendors/identity/inquiry");
      await Linking.openURL(data.url);
    } catch (error: any) {
      Alert.alert(
        "Automated verification unavailable",
        error.response?.data?.message ??
          error.message ??
          "Your manual review remains active.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveOperationalSettings=async()=>{try{setBusy(true);await api.patch('/vendors/operational-settings',{breakActive,autoAcceptCalls:autoAccept,maximumDailyCalls:Number(maximumDailyCalls)||0,minimumCallerBalance:Number(minimumCallerBalance)||0});await load();Alert.alert('Call preferences saved','Break status, automation and caller safeguards are now enforced by the server.')}catch(error:any){Alert.alert('Could not save preferences',error.response?.data?.message??'Try again')}finally{setBusy(false)}};
  return (
    <Screen scroll>
      <Eyebrow>CREATOR STUDIO</Eyebrow>
      <Title subtitle="Earn safely through calls, chat and gifts">
        Vendor centre
      </Title>
      {user?.vendor ? (
        <>
          <Card style={styles.statusCard}>
            <View style={styles.row}>
              <View>
                <Text style={styles.statusTitle}>Application status</Text>
                <Text style={styles.status}>
                  {String(user.vendor.status).replaceAll("_", " ")}
                </Text>
              </View>
              <Pill
                label={user.vendor.status}
                tone={user.vendor.status === "APPROVED" ? "success" : "default"}
              />
            </View>
            <View style={styles.divider} />
            <Text style={styles.detail}>
              Voice rate · {user.vendor.voiceRatePerMinute} points/min
            </Text>
            <Text style={styles.detail}>
              Commission · {user.vendor.commissionPercent}%
            </Text>
            <Text style={styles.detail}>
              Identity check ·{" "}
              {(user.vendor.identityStatus ?? "MANUAL REVIEW")
                .replaceAll("_", " ")
                .toLowerCase()}
            </Text>
            {user.vendor.identityStatus !== "VERIFIED" ? (
              <Button
                title="Continue automated identity check"
                variant="ghost"
                loading={busy}
                onPress={verifyIdentity}
              />
            ) : (
              <Pill label="IDENTITY VERIFIED" tone="success" />
            )}
          </Card>
          {user.vendor.status === "APPROVED" && (
            <>
              <Button title="View earnings and withdrawals" icon="◆" variant="secondary" onPress={()=>navigation.navigate('Earnings')}/>
              <Button
                title={available ? "Go offline" : "Go online for calls"}
                icon={available ? "○" : "●"}
                onPress={() =>
                  api
                    .patch("/vendors/availability", { available: !available })
                    .then(load)
                }
              />
              <SectionTitle>Call operations</SectionTitle>
              <Card>
                <Text style={styles.scheduleHint}>Control workload and protect your time. Server checks apply to every request.</Text>
                <View style={styles.timeRow}>
                  <Button title={breakActive?'On break':'Take a break'} variant={breakActive?'primary':'secondary'} onPress={()=>setBreakActive(value=>!value)}/>
                  <Button title={autoAccept?'Auto-accept on':'Auto-accept off'} variant={autoAccept?'primary':'secondary'} onPress={()=>setAutoAccept(value=>!value)}/>
                </View>
                <Field placeholder="Maximum calls per day (optional)" keyboardType="number-pad" value={maximumDailyCalls} onChangeText={setMaximumDailyCalls}/>
                <Field placeholder="Minimum caller balance" keyboardType="number-pad" value={minimumCallerBalance} onChangeText={setMinimumCallerBalance}/>
                <Button title="Save call preferences" loading={busy} variant="secondary" disabled={Number(maximumDailyCalls)<0||Number(maximumDailyCalls)>1000||Number(minimumCallerBalance)<0} onPress={saveOperationalSettings}/>
              </Card>
              <SectionTitle>Weekly working hours</SectionTitle>
              <Card>
                <Text style={styles.scheduleHint}>
                  Asia/Dhaka timezone · overnight shifts supported
                </Text>
                <View style={styles.days}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                    <Pressable
                      key={index}
                      onPress={() => toggleDay(index)}
                      style={[
                        styles.day,
                        enabledDays.has(index) && styles.dayActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          enabledDays.has(index) && styles.dayTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.timeRow}>
                  <Field
                    style={styles.time}
                    placeholder="09:00"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                  <Text style={styles.to}>to</Text>
                  <Field
                    style={styles.time}
                    placeholder="21:00"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
                <Button
                  title="Save working hours"
                  loading={busy}
                  variant="secondary"
                  onPress={saveSchedule}
                />
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.secure}>◆ Private identity review</Text>
            <Text style={styles.help}>
              Your government ID and selfie are stored privately. Identity
              numbers are encrypted and every staff reveal is audited.
            </Text>
          </Card>
          <Field
            placeholder="Legal name"
            value={legalName}
            onChangeText={setLegal}
          />
          <Field
            placeholder="Government ID / NID number"
            value={nidNumber}
            onChangeText={setNid}
          />
          <Field placeholder="Full address" multiline value={address} onChangeText={setAddress}/>
          <Field placeholder="Contact email" keyboardType="email-address" autoCapitalize="none" value={contactEmail} onChangeText={setContactEmail}/>
          <Field placeholder="Creator profile description" multiline value={description} onChangeText={setDescription}/>
          <Field placeholder="Languages, comma separated" value={languages} onChangeText={setLanguages}/>
          <Field placeholder="Preferred working hours" value={preferredHours} onChangeText={setPreferredHours}/>
          <View style={styles.timeRow}><Button title="Voice calls" variant={voiceEnabled?'primary':'secondary'} onPress={()=>setVoiceEnabled(value=>!value)}/><Button title="Video calls" variant={videoEnabled?'primary':'secondary'} onPress={()=>setVideoEnabled(value=>!value)}/></View>
          <View style={styles.timeRow}>{(['BKASH','NAGAD','BANK'] as const).map(item=><Button key={item} title={item} variant={payoutMethod===item?'primary':'secondary'} onPress={()=>setPayoutMethod(item)}/>)}</View>
          <Field placeholder="Payout account number" value={payoutAccount} onChangeText={setPayoutAccount}/>
          <View style={styles.uploads}>
            <Upload
              title="NID front"
              selected={front}
              onPress={() => void choose(setFront)}
            />
            <Upload
              title="NID back"
              selected={back}
              onPress={() => void choose(setBack)}
            />
            <Upload
              title="Live selfie"
              selected={selfie}
              onPress={() => void capture()}
            />
          </View>
          <Button
            title="Submit secure application"
            loading={busy}
            disabled={
              !legalName.trim() ||
              nidNumber.trim().length < 6 ||
              address.trim().length<10||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)||description.trim().length<20||!languages.trim()||payoutAccount.trim().length<6||(!voiceEnabled&&!videoEnabled)||
              !front ||
              !back ||
              !selfie
            }
            onPress={apply}
          />
        </>
      )}
    </Screen>
  );
}
function Upload({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: Asset;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.upload, selected && styles.uploadSelected]}
    >
      <Text style={styles.uploadIcon}>{selected ? "✓" : "＋"}</Text>
      <Text style={styles.uploadTitle}>{title}</Text>
      <Text numberOfLines={1} style={styles.uploadHint}>
        {selected ? selected.fileName : "Choose securely"}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  statusCard: { marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: { color: colors.muted, fontSize: 12 },
  status: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  detail: { color: colors.muted, marginTop: 5 },
  secure: { color: colors.primary, fontWeight: "900", fontSize: 15 },
  help: { color: colors.muted, lineHeight: 20, marginTop: 8 },
  scheduleHint: { color: colors.muted, fontSize: 11 },
  days: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: spacing.md,
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dayActive: { backgroundColor: colors.primary },
  dayText: { color: colors.primary, fontWeight: "900" },
  dayTextActive: { color: "#FFF" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  time: { flex: 1, marginBottom: 0 },
  to: { color: colors.muted, fontWeight: "700" },
  uploads: { flexDirection: "row", gap: 8, marginVertical: spacing.sm },
  upload: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: colors.surface,
  },
  uploadSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  uploadIcon: { color: colors.primary, fontSize: 23, fontWeight: "900" },
  uploadTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 5,
  },
  uploadHint: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
    maxWidth: "100%",
  },
});
