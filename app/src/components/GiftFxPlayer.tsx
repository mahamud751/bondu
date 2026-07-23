import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

export type GiftFxEvent = {
  gift?: string;
  giftIcon?: string;
  senderName?: string;
  pointPrice?: number;
  fxTier?: 'BASIC' | 'PREMIUM' | 'LEGENDARY' | 'SVGA';
  /** Remote SVGA/Lottie/GIF/WebP pack or image URL */
  animationUrl?: string | null;
  /** Ordered emoji/frame pack for multi-frame burst */
  fxPack?: string[] | null;
};

function tierFromPrice(price?: number): NonNullable<GiftFxEvent['fxTier']> {
  if (!price) return 'BASIC';
  if (price >= 500) return 'LEGENDARY';
  if (price >= 100) return 'PREMIUM';
  return 'BASIC';
}

const PACKS: Record<string, string[]> = {
  BASIC: ['✦', '✧', '★'],
  PREMIUM: ['💎', '✨', '💫', '🌟', '💎'],
  LEGENDARY: ['🚀', '💥', '🔥', '👑', '💎', '⚡', '🌈', '🎆'],
  SVGA: ['🎬', '✨', '💎', '🌟', '💥'],
};

/**
 * Full-screen gift FX:
 * - tiered particle rain
 * - multi-frame pack cycling
 * - optional animationUrl image/GIF overlay (SVGA pack URL compatible slot)
 */
export function GiftFxPlayer({ event }: { event?: GiftFxEvent | null }) {
  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const scale = useMemo(() => new Animated.Value(0.15), []);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const rain = useMemo(() => new Animated.Value(0), []);
  const spin = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!event) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setFrame(0);
    scale.setValue(0.15);
    opacity.setValue(0);
    rain.setValue(0);
    spin.setValue(0);

    const tier = event.fxTier ?? tierFromPrice(event.pointPrice);
    const pack =
      event.fxPack && event.fxPack.length
        ? event.fxPack
        : PACKS[tier] ?? PACKS.BASIC;

    const frameTimer = setInterval(() => {
      setFrame((f) => (f + 1) % pack.length);
    }, tier === 'LEGENDARY' || tier === 'SVGA' ? 120 : 180);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(rain, {
        toValue: 1,
        duration: tier === 'LEGENDARY' ? 2800 : 2200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spin, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();

    const hideMs = event.animationUrl ? 3200 : 2700;
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, hideMs);

    return () => {
      clearTimeout(t);
      clearInterval(frameTimer);
    };
  }, [event, opacity, rain, scale, spin]);

  if (!visible || !event) return null;

  const tier = event.fxTier ?? tierFromPrice(event.pointPrice);
  const pack =
    event.fxPack && event.fxPack.length
      ? event.fxPack
      : PACKS[tier] ?? PACKS.BASIC;
  const icon = pack[frame] || event.giftIcon || '✦';
  const drops = tier === 'LEGENDARY' || tier === 'SVGA' ? 24 : tier === 'PREMIUM' ? 12 : 5;
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View pointerEvents="none" style={styles.root}>
      {Array.from({ length: drops }).map((_, i) => {
        const left = `${4 + ((i * 13) % 90)}%`;
        const translateY = rain.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, 560 + (i % 7) * 40],
        });
        const drift = rain.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 8)],
        });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.rain,
              {
                left: left as any,
                opacity: opacity.interpolate({
                  inputRange: [0, 0.15, 1],
                  outputRange: [0, 1, 0.12],
                }),
                transform: [
                  { translateY },
                  { translateX: drift },
                  { scale: 0.65 + (i % 4) * 0.18 },
                ],
              },
            ]}
          >
            {pack[i % pack.length]}
          </Animated.Text>
        );
      })}

      {event.animationUrl ? (
        <Animated.View style={[styles.mediaWrap, { opacity, transform: [{ scale }] }]}>
          <Image
            source={{ uri: event.animationUrl }}
            style={styles.media}
            resizeMode="contain"
          />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.card,
          tier === 'LEGENDARY' && styles.cardLegend,
          tier === 'PREMIUM' && styles.cardPremium,
          tier === 'SVGA' && styles.cardSvga,
          { opacity, transform: [{ scale }, { rotate }] },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.sender}>{event.senderName || 'Someone'}</Text>
        <Text style={styles.gift}>sent {event.gift || 'a gift'}</Text>
        {event.pointPrice ? (
          <Text style={styles.pts}>
            {event.pointPrice} pts · {tier}
            {event.animationUrl ? ' · PACK' : ''}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rain: { position: 'absolute', top: 0, fontSize: 26 },
  mediaWrap: {
    position: 'absolute',
    width: '86%',
    height: '48%',
    zIndex: 41,
  },
  media: { width: '100%', height: '100%' },
  card: {
    minWidth: 210,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(22,17,31,0.94)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 42,
  },
  cardPremium: {
    borderColor: 'rgba(245,196,81,0.75)',
    backgroundColor: 'rgba(40,28,10,0.95)',
  },
  cardLegend: {
    borderColor: 'rgba(255,77,109,0.95)',
    backgroundColor: 'rgba(50,10,28,0.96)',
  },
  cardSvga: {
    borderColor: 'rgba(120,200,255,0.9)',
    backgroundColor: 'rgba(10,20,40,0.96)',
  },
  icon: { fontSize: 58, color: colors.gold },
  sender: { color: '#fff', fontWeight: '900', fontSize: 17, marginTop: 10 },
  gift: { color: colors.textSoft, fontWeight: '700', marginTop: 4 },
  pts: {
    color: colors.gold,
    fontWeight: '900',
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
