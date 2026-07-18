import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_URL = 'http://192.168.0.102:3000/api/v1';
export const api = axios.create({ baseURL: API_URL, timeout: 15000 });
const refreshClient = axios.create({ baseURL: API_URL, timeout: 15000 });
let refreshRequest: Promise<string> | null = null;
let authFailureHandler: (() => void) | undefined;

type RetryableRequest = InternalAxiosRequestConfig & { _retried?: boolean };
export const onAuthFailure = (handler: () => void) => { authFailureHandler = handler; };

/** NestJS often returns `message` as a string[]; Alert.alert requires a string. */
export function apiErrorMessage(error: unknown, fallback = 'Try again'): string {
  const message = (error as AxiosError<{ message?: string | string[] }>)?.response?.data?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join('\n') || fallback;
  if (typeof message === 'string' && message.trim()) return message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => response, async (error: AxiosError) => {
  const request = error.config as RetryableRequest | undefined;
  if (error.response?.status !== 401 || !request || request._retried || request.url?.includes('/auth/')) {
    throw error;
  }
  request._retried = true;
  try {
    refreshRequest ??= (async () => {
      const [[, refreshToken], [, deviceId]] = await AsyncStorage.multiGet(['refreshToken', 'deviceId']);
      if (!refreshToken || !deviceId) throw new Error('Missing session');
      const { data } = await refreshClient.post('/auth/refresh', { refreshToken, deviceId });
      await AsyncStorage.multiSet([['accessToken', data.accessToken], ['refreshToken', data.refreshToken]]);
      return data.accessToken as string;
    })().finally(() => { refreshRequest = null; });
    request.headers.Authorization = `Bearer ${await refreshRequest}`;
    return api(request);
  } catch {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'deviceId']);
    authFailureHandler?.();
    throw error;
  }
});
