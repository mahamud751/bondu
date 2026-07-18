import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthFailure } from './api/client';
import { RootNavigator } from './navigation/RootNavigator';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { SocialAuthScreen } from './screens/SocialAuthScreen';
import { useAuth } from './store/auth';
import { colors } from './theme';
import { PushRegistration } from './components/PushRegistration';
import { IncomingCallListener } from './components/IncomingCallListener';
import { navigationRef } from './navigation/navigationRef';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};
const AuthStack = createNativeStackNavigator();
function Authentication() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset password' }} />
      <AuthStack.Screen name="SocialAuth" component={SocialAuthScreen} options={{ title: 'Secure sign-in' }} />
    </AuthStack.Navigator>
  );
}
export default function App() {
  const token = useAuth(state => state.token);
  const hydrate = useAuth(state => state.hydrate);
  const logout = useAuth(state => state.logout);
  const [ready, setReady] = React.useState(false);
  useEffect(() => { hydrate().finally(() => setReady(true)); }, [hydrate]);
  useEffect(() => { onAuthFailure(() => { void logout(); }); }, [logout]);
  if (!ready) return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.bg}}><StatusBar barStyle="light-content" backgroundColor={colors.bg}/><ActivityIndicator color={colors.primary}/></View>;
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        {token ? (
          <>
            <PushRegistration />
            <IncomingCallListener />
            <RootNavigator />
          </>
        ) : (
          <Authentication />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
