import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api/client";
import { Button, Field, Screen, Segmented, Title } from "../components/UI";
import { useAuth } from "../store/auth";
import { colors, spacing } from "../theme";

export function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const setTokens = useAuth((state) => state.setTokens);
  const navigation = useNavigation<any>();

  const login = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(
        method === "email" ? "/auth/email/login" : "/auth/login",
        {
          ...(method === "email"
            ? { email: email.trim().toLowerCase() }
            : { phone: phone.trim() }),
          password,
        },
      );
      await setTokens(data.accessToken, data.refreshToken, data.deviceId);
    } catch (error: unknown) {
      Alert.alert(
        "Login failed",
        apiErrorMessage(error, "Check your connection and try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <View style={styles.orb} />
        <View style={styles.orb2} />
        <View style={styles.logoMark}>
          <Text style={styles.logoHeart}>♡</Text>
        </View>
        <Text style={styles.brand}>SOCIALCONNECT</Text>
        <Text style={styles.tagline}>Private connections that feel real</Text>
      </View>

      <Title subtitle="Sign in to meet verified people and start private conversations">
        Welcome back
      </Title>

      <Segmented
        options={[
          { label: "Phone", value: "phone" },
          { label: "Email", value: "email" },
        ]}
        value={method}
        onChange={(v) => setMethod(v as "phone" | "email")}
      />

      {method === "phone" ? (
        <Field
          placeholder="Phone number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      ) : (
        <Field
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      )}
      <Field
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button
        title={busy ? "Signing in…" : "Continue"}
        disabled={busy || !(method === "email" ? email : phone) || !password}
        onPress={login}
      />
      <Button
        title="Forgot password?"
        variant="ghost"
        onPress={() => navigation.navigate("ForgotPassword")}
      />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <Button
        title="Create an account"
        variant="secondary"
        onPress={() => navigation.navigate("Register")}
      />
      <Button
        title="Continue with Google"
        variant="ghost"
        onPress={() =>
          navigation.navigate("SocialAuth", { provider: "GOOGLE" })
        }
      />
      {Platform.OS === "ios" ? (
        <Button
          title="Continue with Apple"
          variant="ghost"
          onPress={() =>
            navigation.navigate("SocialAuth", { provider: "APPLE" })
          }
        />
      ) : null}

      <View style={styles.legal}>
        <Text style={styles.legalText}>
          By continuing you agree to our{" "}
          <Text
            style={styles.legalLink}
            onPress={() => navigation.navigate("Legal", { type: "terms" })}
          >
            Terms
          </Text>{" "}
          and{" "}
          <Text
            style={styles.legalLink}
            onPress={() => navigation.navigate("Legal", { type: "privacy" })}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginTop: 36,
    marginBottom: spacing.xxl,
    position: "relative",
    paddingVertical: 20,
  },
  orb: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 77, 109, 0.18)",
    top: -20,
  },
  orb2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(245, 196, 81, 0.1)",
    right: 40,
    top: 40,
  },
  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  logoHeart: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "800",
  },
  brand: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 3.2,
  },
  tagline: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: spacing.lg,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  or: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  legal: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.md,
  },
  legalText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  legalLink: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
});
