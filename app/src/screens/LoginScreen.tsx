import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { Button, Field, Screen, Title } from '../components/UI';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

export function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const setTokens = useAuth(state => state.setTokens);
  const navigation = useNavigation<any>();
  const login = async () => {
    try {
      setBusy(true);
      const { data } = await api.post('/auth/login', { phone: phone.trim(), password });
      await setTokens(data.accessToken, data.refreshToken, data.deviceId);
    } catch (error: any) {
      Alert.alert('Login failed', error.response?.data?.message ?? 'Check your connection and try again.');
    } finally { setBusy(false); }
  };
  return <Screen>
    <Text style={{color:colors.primary,fontWeight:'800',marginTop:60,marginBottom:12}}>SOCIALCONNECT</Text>
    <Title>Welcome back</Title>
    <Field placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone}/>
    <Field placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}/>
    <Button title={busy?'Signing in…':'Sign in'} disabled={busy || !phone || !password} onPress={login}/>
    <Button title="Forgot password" onPress={() => navigation.navigate('ForgotPassword')}/>
    <Text style={{color:colors.muted,marginTop:18,textAlign:'center'}}>New here?</Text>
    <Button title="Create an account" onPress={() => navigation.navigate('Register')}/>
  </Screen>;
}
