import React, { useState } from "react";
import { Alert, Text } from "react-native";
import { api } from "../api/client";
import { Button, Field, Screen, Title } from "../components/UI";
import { colors } from "../theme";
export function ForgotPasswordScreen({ navigation }: { navigation: any }) {
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const request = async () => {
    try {
      setBusy(true);
      const { data } = await api.post("/auth/forgot-password", { phone });
      setSent(true);
      if (data.developmentCode)
        Alert.alert("Development OTP", data.developmentCode);
    } catch (e: any) {
      Alert.alert(
        "Could not send code",
        e.response?.data?.message ?? "Try again",
      );
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    try {
      setBusy(true);
      await api.post("/auth/reset-password", {
        phone,
        code,
        newPassword: password,
      });
      Alert.alert("Password reset", "Sign in with your new password.");
      navigation.navigate("Login");
    } catch (e: any) {
      Alert.alert("Reset failed", e.response?.data?.message ?? "Try again");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title>Reset password</Title>
      <Text style={{ color: colors.muted, marginBottom: 15 }}>
        We will verify your registered phone number.
      </Text>
      <Field
        placeholder="Phone (01XXXXXXXXX)"
        keyboardType="phone-pad"
        editable={!sent}
        value={phone}
        onChangeText={setPhone}
      />
      {sent && (
        <>
          <Field
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Field
            placeholder="New password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}
      <Button
        title={
          busy ? "Please wait…" : sent ? "Reset password" : "Send reset code"
        }
        disabled={
          busy ||
          (sent
            ? code.length !== 6 || password.length < 8
            : !/^01\d{9}$/.test(phone))
        }
        onPress={sent ? reset : request}
      />
    </Screen>
  );
}
