import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type AvatarDef = {
  id: string;
  label: string;
  skin: string;
  accent: string;
  face: string;
  ears?: string;
};

const AVATARS: AvatarDef[] = [
  { id: 'fox', label: 'Fox 3D', skin: '#E07A3D', accent: '#8B3A1A', face: '🦊' },
  { id: 'cat', label: 'Cat 3D', skin: '#F0C36A', accent: '#C48A20', face: '🐱' },
  { id: 'robot', label: 'Robot 3D', skin: '#6EA8FF', accent: '#2B5CB8', face: '🤖' },
  { id: 'star', label: 'Star 3D', skin: '#F5C451', accent: '#B8860B', face: '⭐' },
  { id: 'panda', label: 'Panda 3D', skin: '#E8E8E8', accent: '#222', face: '🐼' },
  { id: 'dragon', label: 'Dragon 3D', skin: '#3DDC97', accent: '#0E7A4F', face: '🐲' },
  { id: 'anime', label: 'Anime 3D', skin: '#FFC6B3', accent: '#FF6B9D', face: '💫' },
  { id: 'wolf', label: 'Wolf 3D', skin: '#9AA4B2', accent: '#3D4654', face: '🐺' },
];

export const VTUBER_3D_IDS = AVATARS.map((a) => a.id);

/**
 * Pseudo-3D VTuber head: layered depth, idle sway, talk jaw, blink.
 * Works fully offline without native face-tracking SDKs.
 */
export function VirtualAvatar3D({
  avatarId = 'fox',
  speaking = false,
  size = 220,
}: {
  avatarId?: string;
  speaking?: boolean;
  size?: number;
}) {
  const def = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const rotY = useRef(new Animated.Value(0)).current;
  const rotX = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const jaw = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const depth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const idle = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotY, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatY, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(rotY, {
            toValue: -1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatY, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    idle.start();
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2800),
        Animated.timing(blink, {
          toValue: 0.08,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    );
    blinkLoop.start();
    return () => {
      idle.stop();
      blinkLoop.stop();
    };
  }, [blink, floatY, rotY]);

  useEffect(() => {
    if (!speaking) {
      jaw.setValue(0);
      return;
    }
    const talk = Animated.loop(
      Animated.sequence([
        Animated.timing(jaw, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(jaw, {
          toValue: 0.2,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    );
    talk.start();
    Animated.timing(depth, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    return () => {
      talk.stop();
      depth.setValue(0);
    };
  }, [speaking, jaw, depth]);

  const rotateY = rotY.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-14deg', '14deg'],
  });
  const rotateX = rotX.interpolate({
    inputRange: [-1, 1],
    outputRange: ['6deg', '-6deg'],
  });
  const translateY = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const mouthH = jaw.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 22],
  });
  const scale = depth.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const head = size * 0.72;
  const eye = size * 0.09;

  return (
    <View style={styles.wrap}>
      {/* shadow plate */}
      <View
        style={[
          styles.shadow,
          {
            width: size * 0.55,
            height: size * 0.12,
            borderRadius: size,
            marginBottom: -size * 0.06,
          },
        ]}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { perspective: 800 },
            { translateY },
            { rotateY },
            { rotateX },
            { scale },
          ],
        }}
      >
        {/* back plate (depth) */}
        <View
          style={[
            styles.plate,
            {
              width: head * 1.05,
              height: head * 1.05,
              borderRadius: head,
              backgroundColor: def.accent,
              position: 'absolute',
              transform: [{ translateY: 8 }, { scale: 0.96 }],
              opacity: 0.55,
            },
          ]}
        />
        {/* head */}
        <View
          style={[
            styles.plate,
            {
              width: head,
              height: head,
              borderRadius: head,
              backgroundColor: def.skin,
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 3,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ fontSize: size * 0.28, marginTop: -size * 0.04 }}>
            {def.face}
          </Text>
          {/* eyes */}
          <View style={styles.eyes}>
            <Animated.View
              style={[
                styles.eye,
                {
                  width: eye,
                  height: eye,
                  borderRadius: eye,
                  transform: [{ scaleY: blink }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.eye,
                {
                  width: eye,
                  height: eye,
                  borderRadius: eye,
                  transform: [{ scaleY: blink }],
                },
              ]}
            />
          </View>
          {/* jaw / mouth */}
          <Animated.View
            style={[
              styles.mouth,
              {
                height: mouthH,
                width: size * 0.16,
                borderRadius: 12,
                backgroundColor: def.accent,
              },
            ]}
          />
        </View>
        {/* rim light */}
        <View
          style={[
            styles.rim,
            {
              width: head * 0.9,
              height: head * 0.9,
              borderRadius: head,
            },
          ]}
        />
      </Animated.View>
      <Text style={styles.label}>3D Virtual Live · {def.label}</Text>
      <Text style={styles.hint}>Pseudo-3D VTuber · idle · blink · talk jaw</Text>
    </View>
  );
}

export function VirtualAvatar3DPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.picker}>
      {AVATARS.map((a) => {
        const active = value === a.id;
        return (
          <View
            key={a.id}
            style={[styles.pick, active && styles.pickActive]}
            onTouchEnd={() => onChange(a.id)}
          >
            <Text style={{ fontSize: 22 }}>{a.face}</Text>
            <Text style={styles.pickLabel}>{a.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  shadow: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignSelf: 'center',
  },
  plate: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  eyes: {
    position: 'absolute',
    top: '42%',
    flexDirection: 'row',
    gap: 28,
  },
  eye: {
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mouth: {
    position: 'absolute',
    bottom: '22%',
  },
  rim: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    marginTop: 14,
  },
  hint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pick: {
    width: 78,
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
  pickLabel: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
});
