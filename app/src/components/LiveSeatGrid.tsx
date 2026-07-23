import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type SeatInfo = {
  seatIndex: number;
  role: string;
  muted: boolean;
  cameraOff?: boolean;
  userId: string;
  displayName: string;
};

type Props = {
  seats: SeatInfo[];
  maxGuests?: number;
  mode?: 'VIDEO' | 'AUDIO';
  onSeatPress?: (seat: SeatInfo) => void;
  highlightUserId?: string;
};

/** BIGO-style multi-guest seat strip / grid */
export function LiveSeatGrid({
  seats,
  maxGuests = 8,
  mode = 'VIDEO',
  onSeatPress,
  highlightUserId,
}: Props) {
  const host = seats.find((s) => s.role === 'HOST' || s.seatIndex === 0);
  const guests = seats
    .filter((s) => s.role === 'GUEST' || s.seatIndex > 0)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const emptySlots = Math.max(0, maxGuests - guests.length);

  return (
    <View style={styles.wrap}>
      {host ? (
        <View style={[styles.seat, styles.hostSeat]}>
          <Text style={styles.badge}>HOST</Text>
          <Text style={styles.name} numberOfLines={1}>
            {host.displayName}
          </Text>
          <Text style={styles.meta}>
            {mode === 'AUDIO' ? '🎙' : '📹'}
            {host.muted ? ' 🔇' : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.guestGrid}>
        {guests.map((seat) => {
          const active = seat.userId === highlightUserId;
          return (
            <Pressable
              key={`${seat.userId}-${seat.seatIndex}`}
              style={[styles.seat, styles.guestSeat, active && styles.active]}
              onPress={() => onSeatPress?.(seat)}
            >
              <Text style={styles.badge}>#{seat.seatIndex}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {seat.displayName}
              </Text>
              <Text style={styles.meta}>
                {seat.cameraOff || mode === 'AUDIO' ? '🎙' : '📹'}
                {seat.muted ? ' 🔇' : ''}
              </Text>
            </Pressable>
          );
        })}
        {Array.from({ length: Math.min(emptySlots, 4) }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.seat, styles.emptySeat]}>
            <Text style={styles.emptyText}>Empty</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  guestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  seat: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 88,
  },
  hostSeat: {
    alignSelf: 'flex-start',
    borderColor: 'rgba(255,77,109,0.7)',
    backgroundColor: 'rgba(80,20,40,0.75)',
  },
  guestSeat: { maxWidth: '31%' as any, flexGrow: 1 },
  emptySeat: {
    opacity: 0.45,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  active: { borderColor: colors.gold },
  badge: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  name: { color: '#fff', fontWeight: '800', fontSize: 11, marginTop: 2 },
  meta: { color: colors.textSoft, fontSize: 10, marginTop: 2 },
  emptyText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
});
