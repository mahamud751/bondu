import React, { useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import { Button, Field, Screen, Title } from "../components/UI";
import { useAuth } from "../store/auth";
import { colors } from "../theme";

export function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<'phone'|'email'>('phone');
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const setTokens = useAuth((state) => state.setTokens);
  const navigation = useNavigation<any>();
  const login = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(method==='email'?"/auth/email/login":"/auth/login", {
        ...(method==='email'?{email:email.trim().toLowerCase()}:{phone:phone.trim()}),
        password,
      });
      await setTokens(data.accessToken, data.refreshToken, data.deviceId);
    } catch (error: any) {
      Alert.alert(
        "Login failed",
        error.response?.data?.message ?? "Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen scroll>
      <Text
        style={{
          color: colors.primary,
          fontWeight: "800",
          marginTop: 60,
          marginBottom: 12,
        }}
      >
        SOCIALCONNECT
      </Text>
      <Title>Welcome back</Title>
      <View style={{flexDirection:'row',gap:10,marginBottom:8}}><Button title="Phone" variant={method==='phone'?'primary':'secondary'} onPress={()=>setMethod('phone')}/><Button title="Email" variant={method==='email'?'primary':'secondary'} onPress={()=>setMethod('email')}/></View>
      {method==='phone'?<Field
        placeholder="Phone number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />:<Field placeholder="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}/>}
      <Field
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={busy ? "Signing in…" : "Sign in"}
        disabled={busy || !(method==='email'?email:phone) || !password}
        onPress={login}
      />
      <Button
        title="Forgot password"
        onPress={() => navigation.navigate("ForgotPassword")}
      />
      <Text style={{ color: colors.muted, marginTop: 18, textAlign: "center" }}>
        New here?
      </Text>
      <Button
        title="Create an account"
        onPress={() => navigation.navigate("Register")}
      />
      <Text style={{ color: colors.muted, marginVertical: 14, textAlign: "center" }}>or continue securely</Text>
      <Button title="Continue with Google" variant="secondary" onPress={() => navigation.navigate("SocialAuth", { provider: "GOOGLE" })} />
      {Platform.OS === "ios" ? <Button title="Continue with Apple" variant="secondary" onPress={() => navigation.navigate("SocialAuth", { provider: "APPLE" })} /> : null}
      <Button title="Terms and community rules" variant="ghost" onPress={()=>navigation.navigate('Legal',{type:'terms'})}/>
      <Button title="Privacy policy" variant="ghost" onPress={()=>navigation.navigate('Legal',{type:'privacy'})}/>
    </Screen>
  );
}
