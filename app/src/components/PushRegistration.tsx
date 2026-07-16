import React, { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { api } from '../api/client';
import { navigate } from '../navigation/navigationRef';

export function PushRegistration() {
  useEffect(() => {
    let unsubscribe: undefined | (() => void),unsubscribeOpen:undefined|(()=>void); let active = true;
    const open=(message:any)=>{const callId=message?.data?.callId;if(callId)navigate('IncomingCall',{callId})};
    const register = async () => {
      try {
        if (Platform.OS === 'android' && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (Platform.OS === 'ios') { const status = await messaging().requestPermission(); if (status !== messaging.AuthorizationStatus.AUTHORIZED && status !== messaging.AuthorizationStatus.PROVISIONAL) return; }
        const deviceId = await AsyncStorage.getItem('deviceId'); if (!deviceId || !active) return;
        const sync = (token: string) => api.post('/notifications/push-tokens', { token, deviceId, platform: Platform.OS });
        await sync(await messaging().getToken());
        unsubscribe = messaging().onTokenRefresh(token => { void sync(token); });
        unsubscribeOpen=messaging().onNotificationOpenedApp(open);
        const initial=await messaging().getInitialNotification();if(initial)setTimeout(()=>open(initial),250);
      } catch { /* Firebase is optional in local development without native credentials. */ }
    };
    void register(); return () => { active = false; unsubscribe?.();unsubscribeOpen?.(); };
  }, []);
  return null;
}
