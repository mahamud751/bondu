import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { api } from '../api/client';
import { Button, Field, Screen, Title } from '../components/UI';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

export function RegisterScreen() {
  const [step, setStep] = useState<'details'|'otp'>('details');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'phone'|'email'>('phone');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const setTokens = useAuth(state => state.setTokens);

  const sendCode = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(method==='email'?'/auth/email/send-code':'/auth/send-otp', method==='email'?{email:email.trim().toLowerCase(),purpose:'REGISTER'}:{ phone: phone.trim(), purpose: 'REGISTER' });
      setStep('otp');
      if (data.developmentCode) Alert.alert('Development OTP', data.developmentCode);
    } catch (error: any) { Alert.alert('Could not send code', error.response?.data?.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };
  const register = async () => {
    try {
      setBusy(true);
      let data;
      if(method==='email')({data}=await api.post('/auth/email/register',{email:email.trim().toLowerCase(),code,password,username:username.trim(),displayName:displayName.trim(),dateOfBirth,termsAccepted}));
      else {await api.post('/auth/verify-otp', { phone: phone.trim(), purpose: 'REGISTER', code });({data}=await api.post('/auth/register', { phone: phone.trim(), password, username: username.trim(), displayName: displayName.trim(), dateOfBirth, termsAccepted }));}
      await setTokens(data.accessToken, data.refreshToken, data.deviceId);
    } catch (error: any) { Alert.alert('Registration failed', error.response?.data?.message ?? 'Check the details and try again.'); }
    finally { setBusy(false); }
  };
  return <Screen><ScrollView keyboardShouldPersistTaps="handled">
    <Title>Create account</Title>
    <Text style={{color:colors.muted,marginBottom:16}}>You must be 18 or older. Verify a phone number or email address.</Text>
    {step==='details'?<ScrollView horizontal contentContainerStyle={{gap:10,marginBottom:8}}><Button title="Use phone" variant={method==='phone'?'primary':'secondary'} onPress={()=>setMethod('phone')}/><Button title="Use email" variant={method==='email'?'primary':'secondary'} onPress={()=>setMethod('email')}/></ScrollView>:null}
    {method==='phone'?<Field placeholder="Phone (01XXXXXXXXX)" keyboardType="phone-pad" editable={step==='details'} value={phone} onChangeText={setPhone}/>:<Field placeholder="Email address" keyboardType="email-address" autoCapitalize="none" editable={step==='details'} value={email} onChangeText={setEmail}/>}
    {step === 'details' ? <>
      <Field placeholder="Username" autoCapitalize="none" value={username} onChangeText={setUsername}/>
      <Field placeholder="Display name" value={displayName} onChangeText={setDisplayName}/>
      <Field placeholder="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth}/>
      <Field placeholder="Password (at least 8 characters)" secureTextEntry value={password} onChangeText={setPassword}/>
      <Pressable onPress={()=>setTermsAccepted(value=>!value)}><Text style={{color:termsAccepted?colors.primary:colors.muted,marginVertical:12}}>{termsAccepted?'☑':'☐'} I confirm I am 18+ and accept the Terms and Privacy Policy.</Text></Pressable>
      <Button title={busy?'Sending…':'Send verification code'} disabled={busy || (method==='phone'?!/^01\d{9}$/.test(phone):!/^\S+@\S+\.\S+$/.test(email)) || username.length<3 || !displayName || password.length<8 || !dateOfBirth || !termsAccepted} onPress={sendCode}/>
    </> : <>
      <Field placeholder="6-digit verification code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode}/>
      <Button title={busy?'Creating account…':'Verify and create account'} disabled={busy || code.length!==6} onPress={register}/>
      <Button title="Change details" disabled={busy} onPress={() => { setCode(''); setStep('details'); }}/>
    </>}
  </ScrollView></Screen>;
}
