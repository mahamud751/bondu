import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './client';

let socket: Socket | undefined;
export async function realtime() {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return undefined;
  if (!socket) socket = io(API_URL.replace('/api/v1', '/realtime'), { auth: { token }, transports: ['websocket'], autoConnect: true, reconnection: true, reconnectionDelayMax: 5000 });
  else if (!socket.connected) { socket.auth = { token }; socket.connect(); }
  return socket;
}
export function disconnectRealtime() { socket?.disconnect(); socket = undefined; }
