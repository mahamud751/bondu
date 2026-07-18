import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api, apiErrorMessage } from '../api/client';
import {
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Field,
  Pill,
  Screen,
  SectionTitle,
  Title,
} from "../components/UI";
import { colors, radius, spacing } from "../theme";
const types = ["ACCOUNT", "FEATURE_RESTRICTION", "REPORT", "REVIEW", "VENDOR"];
export function AppealsScreen() {
  const [appeals, setAppeals] = useState<any[]>([]),
    [targetType, setType] = useState("ACCOUNT"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api.get("/appeals").then((response) => setAppeals(response.data));
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    try {
      setBusy(true);
      await api.post("/appeals", { targetType, reason });
      setReason("");
      await load();
      Alert.alert(
        "Appeal submitted",
        "Trust & Safety will review your request and notify you of the decision.",
      );
    } catch (error: any) {
      Alert.alert(
        "Could not submit appeal",
        apiErrorMessage(error, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen scroll>
      <Eyebrow>Fair and transparent</Eyebrow>
      <Title subtitle="Ask Trust & Safety to independently review a restriction or decision">
        Moderation appeals
      </Title>
      <Card>
        <Text style={styles.notice}>
          Appeals do not automatically reverse an action. Explain what happened
          clearly and do not include passwords or payment credentials.
        </Text>
      </Card>
      <SectionTitle>What are you appealing?</SectionTitle>
      <View style={styles.types}>
        {types.map((item) => (
          <Pressable
            key={item}
            onPress={() => setType(item)}
            style={[styles.type, targetType === item && styles.typeActive]}
          >
            <Text
              style={[
                styles.typeText,
                targetType === item && styles.typeTextActive,
              ]}
            >
              {item.replaceAll("_", " ").toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        placeholder="Explain why the decision should be reviewed…"
        multiline
        maxLength={2000}
        value={reason}
        onChangeText={setReason}
        style={styles.reason}
      />
      <Button
        title="Submit appeal"
        loading={busy}
        disabled={reason.trim().length < 20}
        onPress={create}
      />
      <SectionTitle>Your appeals</SectionTitle>
      {appeals.length ? (
        appeals.map((item) => (
          <Card key={item.id}>
            <View style={styles.head}>
              <Text style={styles.title}>
                {item.targetType.replaceAll("_", " ").toLowerCase()}
              </Text>
              <Pill
                label={item.status}
                tone={item.status === "ACCEPTED" ? "success" : "neutral"}
              />
            </View>
            <Text style={styles.body}>{item.reason}</Text>
            {item.resolution ? (
              <View style={styles.resolution}>
                <Text style={styles.resolutionLabel}>
                  TRUST & SAFETY RESPONSE
                </Text>
                <Text style={styles.body}>{item.resolution}</Text>
              </View>
            ) : null}
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Card>
        ))
      ) : (
        <EmptyState
          icon="⚖"
          title="No appeals"
          body="Your moderation review requests will appear here."
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  notice: { color: colors.textSoft, lineHeight: 20 },
  types: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  type: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  typeTextActive: { color: "#FFF" },
  reason: { minHeight: 130, textAlignVertical: "top", paddingTop: 15 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: colors.text, fontWeight: "900", textTransform: "capitalize" },
  body: { color: colors.textSoft, lineHeight: 19, marginTop: 10 },
  resolution: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
  },
  resolutionLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  date: { color: colors.muted, fontSize: 10, marginTop: 12 },
});
