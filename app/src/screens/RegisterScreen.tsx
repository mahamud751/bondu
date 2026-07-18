import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage } from '../api/client';
import { Button, Field, Screen, Segmented, Title } from '../components/UI';
import { useAuth } from '../store/auth';
import { colors, radius, spacing } from '../theme';

export function RegisterScreen() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const setTokens = useAuth((state) => state.setTokens);

  const sendCode = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(
        method === 'email' ? '/auth/email/send-code' : '/auth/send-otp',
        method === 'email'
          ? { email: email.trim().toLowerCase(), purpose: 'REGISTER' }
          : { phone: phone.trim(), purpose: 'REGISTER' },
      );
      setStep('otp');
      if (data.developmentCode) Alert.alert('Development OTP', data.developmentCode);
    } catch (error: unknown) {
      Alert.alert('Could not send code', apiErrorMessage(error, 'Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    try {
      setBusy(true);
      let data;
      if (method === 'email') {
        ({ data } = await api.post('/auth/email/register', {
          email: email.trim().toLowerCase(),
          code,
          password,
          username: username.trim(),
          displayName: displayName.trim(),
          dateOfBirth,
          termsAccepted,
        }));
      } else {
        await api.post('/auth/verify-otp', {
          phone: phone.trim(),
          purpose: 'REGISTER',
          code,
        });
        ({ data } = await api.post('/auth/register', {
          phone: phone.trim(),
          password,
          username: username.trim(),
          displayName: displayName.trim(),
          dateOfBirth,
          termsAccepted,
        }));
      }
      await setTokens(data.accessToken, data.refreshToken, data.deviceId);
    } catch (error: unknown) {
      Alert.alert(
        'Registration failed',
        apiErrorMessage(error, 'Check the details and try again.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Title subtitle="18+ only. Verify a phone or email to join.">
        Join SocialConnect
      </Title>

      {step === 'details' ? (
        <Segmented
          options={[
            { label: 'Phone', value: 'phone' },
            { label: 'Email', value: 'email' },
          ]}
          value={method}
          onChange={(v) => setMethod(v as 'phone' | 'email')}
        />
      ) : null}

      {method === 'phone' ? (
        <Field
          placeholder="Phone (01XXXXXXXXX)"
          keyboardType="phone-pad"
          editable={step === 'details'}
          value={phone}
          onChangeText={setPhone}
        />
      ) : (
        <Field
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={step === 'details'}
          value={email}
          onChangeText={setEmail}
        />
      )}

      {step === 'details' ? (
        <>
          <Field
            placeholder="Username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <Field
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Field
            placeholder="Date of birth (YYYY-MM-DD)"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />
          <Field
            placeholder="Password (at least 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            style={styles.terms}
            onPress={() => setTermsAccepted((value) => !value)}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxOn]}>
              {termsAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>
              I confirm I am 18+ and accept the Terms and Privacy Policy.
            </Text>
          </Pressable>
          <Button
            title={busy ? 'Sending…' : 'Send verification code'}
            disabled={
              busy ||
              (method === 'phone'
                ? !/^01\d{9}$/.test(phone)
                : !/^\S+@\S+\.\S+$/.test(email)) ||
              username.length < 3 ||
              !displayName ||
              password.length < 8 ||
              !dateOfBirth ||
              !termsAccepted
            }
            onPress={sendCode}
          />
        </>
      ) : (
        <>
          <Field
            placeholder="6-digit verification code"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Button
            title={busy ? 'Creating account…' : 'Verify & create account'}
            disabled={busy || code.length !== 6}
            onPress={register}
          />
          <Button
            title="Change details"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setCode('');
              setStep('details');
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginVertical: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  termsText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
});
