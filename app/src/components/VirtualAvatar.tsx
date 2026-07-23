import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const AVATARS: Record<string, { emoji: string; label: string; color: string }> = {
  fox: { emoji: '🦊', label: 'Fox', color: '#C45C26' },
  cat: { emoji: '🐱', label: 'Cat', color: '#E8A838' },
  robot: { emoji: '🤖', label: 'Robot', color: '#5B8DEF' },
  star: { emoji: '🌟', label: 'Star', color: '#F5C451' },
  panda: { emoji: '🐼', label: 'Panda', color: '#888' },
  dragon: { emoji: '🐲', label: 'Dragon', color: '#3DDC97' },
};

export const VIRTUAL_AVATAR_IDS = Object.keys(AVATARS);

/** 2D Virtual Live / VTuber-style avatar (phone-camera alternative). */
export function VirtualAvatar({
  avatarId = 'fox',
  speaking = false,
  size = 180,
}: {
  avatarId?: string;
  speaking?: boolean;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const meta = AVATARS[avatarId] ?? AVATARS.fox;

  useEffect(() => {
    if (!speaking) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: meta.color,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.45 }}>{meta.emoji}</Text>
      </Animated.View>
      <Text style={styles.label}>Virtual Live · {meta.label}</Text>
      <Text style={styles.hint}>Avatar mode — camera face hidden</Text>
    </View>
  );
}

export function VirtualAvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.picker}>
      {VIRTUAL_AVATAR_IDS.map((id) => {
        const meta = AVATARS[id];
        const active = value === id;
        return (
          <View
            key={id}
            style={[styles.pick, active && styles.pickActive]}
            onTouchEnd={() => onChange(id)}
          >
            <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
            <Text style={styles.pickLabel}>{meta.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  label: { color: '#fff', fontWeight: '900', fontSize: 15 },
  hint: { color: colors.muted, fontSize: 12 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: {
    width: 72,
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  pickLabel: { color: colors.textSoft, fontSize: 10, fontWeight: '700', marginTop: 4 },
});
