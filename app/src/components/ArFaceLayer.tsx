import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export type ArStickerId =
  | 'none'
  | 'cat_ears'
  | 'crown'
  | 'glasses'
  | 'hearts'
  | 'fire'
  | 'mask'
  | 'bunny'
  | 'neon';

const STICKERS: Record<
  ArStickerId,
  { top?: string; mid?: string; bottom?: string; float?: string }
> = {
  none: {},
  cat_ears: { top: '🐱🐱' },
  crown: { top: '👑' },
  glasses: { mid: '🕶' },
  hearts: { float: '💕', top: '💞' },
  fire: { float: '🔥', bottom: '✨' },
  mask: { mid: '🎭' },
  bunny: { top: '🐰' },
  neon: { top: '💜', mid: '◈', bottom: '💙' },
};

/** Face-anchored AR sticker layer (professional layout anchors). */
export function ArFaceLayer({
  sticker = 'none',
  tracking = true,
}: {
  sticker?: ArStickerId | string;
  tracking?: boolean;
}) {
  const sway = useRef(new Animated.Value(0)).current;
  const conf = STICKERS[(sticker as ArStickerId) in STICKERS ? (sticker as ArStickerId) : 'none'];

  useEffect(() => {
    if (!tracking || sticker === 'none') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sticker, tracking, sway]);

  if (sticker === 'none' || !conf) return null;

  const tx = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });
  const ty = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: [4, -4],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        { transform: [{ translateX: tx }, { translateY: ty }] },
      ]}
    >
      {/* face bounding box guides (invisible hit area anchors) */}
      <View style={styles.faceBox}>
        {conf.top ? <Text style={[styles.emoji, styles.top]}>{conf.top}</Text> : null}
        {conf.mid ? <Text style={[styles.emoji, styles.mid]}>{conf.mid}</Text> : null}
        {conf.bottom ? (
          <Text style={[styles.emoji, styles.bottom]}>{conf.bottom}</Text>
        ) : null}
        {conf.float ? (
          <Text style={[styles.emoji, styles.float]}>{conf.float}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export const AR_FACE_STICKERS: { id: ArStickerId; label: string; emoji: string }[] =
  [
    { id: 'none', label: 'None', emoji: '○' },
    { id: 'cat_ears', label: 'Cat', emoji: '🐱' },
    { id: 'crown', label: 'Crown', emoji: '👑' },
    { id: 'glasses', label: 'Glasses', emoji: '🕶' },
    { id: 'hearts', label: 'Hearts', emoji: '💕' },
    { id: 'fire', label: 'Fire', emoji: '🔥' },
    { id: 'mask', label: 'Mask', emoji: '🎭' },
    { id: 'bunny', label: 'Bunny', emoji: '🐰' },
    { id: 'neon', label: 'Neon', emoji: '◈' },
  ];

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceBox: {
    width: 220,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  top: { top: 8, fontSize: 54 },
  mid: { top: '42%', fontSize: 48 },
  bottom: { bottom: 28, fontSize: 36 },
  float: { top: 20, right: 10, fontSize: 32 },
});
