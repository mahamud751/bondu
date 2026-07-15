import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthFailure } from './api/client';
import { RootNavigator } from './navigation/RootNavigator';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { useAuth } from './store/auth';
import { colors } from './theme';

const AuthStack = createNativeStackNavigator();
function Authentication() {
  return <AuthStack.Navigator>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{headerShown:false}}/>
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{title:'Create account'}}/>
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{title:'Reset password'}}/>
  </AuthStack.Navigator>;
}
export default function App() {
  const token = useAuth(state => state.token);
  const hydrate = useAuth(state => state.hydrate);
  const logout = useAuth(state => state.logout);
  const [ready, setReady] = React.useState(false);
  useEffect(() => { hydrate().finally(() => setReady(true)); }, [hydrate]);
  useEffect(() => { onAuthFailure(() => { void logout(); }); }, [logout]);
  if (!ready) return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.primary}/></View>;
  return <NavigationContainer>{token ? <RootNavigator/> : <Authentication/>}</NavigationContainer>;
}
