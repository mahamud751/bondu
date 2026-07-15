import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type State = {
  token: string | null;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, deviceId: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<State>(set => ({
  token: null,
  hydrate: async () => set({ token: await AsyncStorage.getItem('accessToken') }),
  setTokens: async (accessToken, refreshToken, deviceId) => {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['deviceId', deviceId],
    ]);
    set({ token: accessToken });
  },
  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'deviceId']);
    set({ token: null });
  },
}));
