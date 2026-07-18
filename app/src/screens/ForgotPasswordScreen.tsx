import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { api, apiErrorMessage } from '../api/client';
import { Button, Field, Screen, Title } from "../components/UI";
import { colors } from "../theme";
export function ForgotPasswordScreen({ navigation }: { navigation: any }) {
  const [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [method, setMethod] = useState<'phone'|'email'>('phone'),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const request = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(method==='email'?"/auth/email/send-code":"/auth/forgot-password", method==='email'?{email:email.trim().toLowerCase(),purpose:'RESET_PASSWORD'}:{ phone });
      setSent(true);
      if (data.developmentCode)
        Alert.alert("Development OTP", data.developmentCode);
    } catch (e: any) {
      Alert.alert(
        "Could not send code",
        apiErrorMessage(e, "Try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    try {
      setBusy(true);
      await api.post(method==='email'?"/auth/email/reset-password":"/auth/reset-password", {
        ...(method==='email'?{email:email.trim().toLowerCase()}:{phone}),
        code,
        newPassword: password,
      });
      Alert.alert("Password reset", "Sign in with your new password.");
      navigation.navigate("Login");
    } catch (e: any) {
      Alert.alert("Reset failed", apiErrorMessage(e, "Try again"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title>Reset password</Title>
      <Text style={{ color: colors.muted, marginBottom: 15 }}>
        We will verify your registered phone number or email address.
      </Text>
      {!sent?<View style={{flexDirection:'row',gap:10,marginBottom:8}}><Button title="Phone" variant={method==='phone'?'primary':'secondary'} onPress={()=>setMethod('phone')}/><Button title="Email" variant={method==='email'?'primary':'secondary'} onPress={()=>setMethod('email')}/></View>:null}
      {method==='phone'?<Field
        placeholder="Phone (01XXXXXXXXX)"
        keyboardType="phone-pad"
        editable={!sent}
        value={phone}
        onChangeText={setPhone}
      />:<Field placeholder="Email address" keyboardType="email-address" autoCapitalize="none" editable={!sent} value={email} onChangeText={setEmail}/>}
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
            : method==='phone'?!/^01\d{9}$/.test(phone):!/^\S+@\S+\.\S+$/.test(email))
        }
        onPress={sent ? reset : request}
      />
    </Screen>
  );
}
