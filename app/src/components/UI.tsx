import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { API_URL } from '../api/client';
import { useAuth } from '../store/auth';
import {
  avatarColor,
  colors,
  radius,
  shadow,
  shadowPrimary,
  shadowSm,
  spacing,
} from '../theme';

export function usePhotoSource(avatarUrl?: string) {
  const token = useAuth((state) => state.token);
  if (!avatarUrl) return undefined;
  if (/^https?:\/\//i.test(avatarUrl)) return { uri: avatarUrl };
  if (!token) return undefined;
  return { uri: `${API_URL}/files/${avatarUrl}/content`, headers: { Authorization: `Bearer ${token}` } };
}

const { width: SCREEN_W } = Dimensions.get('window');

export const Screen = ({
  children,
  scroll = false,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) => {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, !padded && styles.noPadding]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, !padded && styles.noPadding]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
};

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.eyebrow}>{children}</Text>
);

export const Title = ({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) => (
  <View style={styles.titleWrap}>
    <Text style={styles.title}>{children}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

export const SectionTitle = ({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {action ? (
      <Pressable onPress={onAction} hitSlop={10}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    ) : null}
  </View>
);

export const Field = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={colors.muted}
    {...props}
    style={[styles.field, props.style]}
  />
);

export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  icon,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  loading?: boolean;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${variant}Button`],
        isPrimary && styles.primaryGlow,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <>
          {icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
          <Text style={[styles.buttonText, styles[`${variant}Text`]]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) => <View style={[styles.card, style]}>{children}</View>;

export const Pill = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'default' | 'primary' | 'success' | 'gold';
}) => {
  const resolved = tone === 'default' ? 'neutral' : tone;
  return (
    <View style={[styles.pill, styles[`${resolved}Pill`]]}>
      <Text style={[styles.pillText, styles[`${resolved}PillText`]]}>{label}</Text>
    </View>
  );
};

export const Avatar = ({
  name,
  avatarUrl,
  size = 52,
  online = false,
}: {
  name?: string;
  avatarUrl?: string;
  size?: number;
  online?: boolean;
}) => {
  const bg = avatarColor(name);
  const photo = usePhotoSource(avatarUrl);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: photo ? colors.surface : bg,
            overflow: 'hidden',
          },
        ]}
      >
        {photo ? (
          <Image source={photo} style={{ width: size, height: size }} resizeMode="cover" />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
            {(name || '?').slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: Math.max(12, size * 0.22),
              height: Math.max(12, size * 0.22),
              borderRadius: Math.max(6, size * 0.11),
              right: 0,
              bottom: 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

/**
 * Full-bleed dating-style profile card (Hinge / Raya inspired).
 * Large portrait, gradient footer, name + meta + CTA.
 */
export function ProfileCard({
  name,
  avatarUrl,
  handle,
  subtitle,
  online,
  verified,
  rating,
  priceLabel,
  badges,
  onPress,
}: {
  name: string;
  avatarUrl?: string;
  handle?: string;
  subtitle?: string;
  online?: boolean;
  verified?: boolean;
  rating?: string;
  priceLabel?: string;
  badges?: string[];
  onPress?: () => void;
}) {
  const bg = avatarColor(name);
  const photo = usePhotoSource(avatarUrl);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.profileHero, { backgroundColor: bg }]}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
        <View style={styles.profileHeroDecor} />
        {!photo ? <Text style={styles.profileHeroLetter}>{(name || '?').slice(0, 1).toUpperCase()}</Text> : null}
        {online ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Online</Text>
          </View>
        ) : null}
        <View style={styles.profileGradient}>
          <View style={styles.profileFooter}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {name}
              </Text>
              {verified ? (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedMark}>✓</Text>
                </View>
              ) : null}
            </View>
            {handle || subtitle ? (
              <Text style={styles.profileHandle} numberOfLines={1}>
                {handle}
                {handle && subtitle ? '  ·  ' : ''}
                {subtitle}
              </Text>
            ) : null}
            <View style={styles.profileMetaRow}>
              {rating ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>★ {rating}</Text>
                </View>
              ) : null}
              {priceLabel ? (
                <View style={[styles.metaChip, styles.metaChipAccent]}>
                  <Text style={[styles.metaChipText, styles.metaChipAccentText]}>{priceLabel}</Text>
                </View>
              ) : null}
              {(badges || []).map((b) => (
                <View key={b} style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Compact horizontal creator tile: photo, online/featured badges, name, rating/price, call button.
 */
export function CreatorCard({
  name,
  avatarUrl,
  handle,
  online,
  verified,
  featured,
  rating,
  priceLabel,
  onPress,
}: {
  name: string;
  avatarUrl?: string;
  handle?: string;
  online?: boolean;
  verified?: boolean;
  featured?: boolean;
  rating?: string;
  priceLabel?: string;
  onPress?: () => void;
}) {
  const bg = avatarColor(name);
  const photo = usePhotoSource(avatarUrl);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.creatorCard, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.creatorPhoto, { backgroundColor: photo ? colors.surface : bg }]}>
        {photo ? (
          <Image source={photo} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Text style={styles.creatorPhotoLetter}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
        )}
        {online ? (
          <View style={styles.creatorOnlineBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.creatorOnlineText}>Online</Text>
          </View>
        ) : null}
        {featured ? (
          <View style={styles.creatorCrown}>
            <Text style={styles.creatorCrownText}>♛</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.creatorNameRow}>
        <Text style={styles.creatorName} numberOfLines={1}>
          {name}
        </Text>
        {verified ? (
          <View style={styles.creatorVerifiedBadge}>
            <Text style={styles.verifiedMark}>✓</Text>
          </View>
        ) : null}
      </View>
      {handle ? (
        <Text style={styles.creatorHandle} numberOfLines={1}>
          {handle}
        </Text>
      ) : null}
      <View style={styles.creatorMetaRow}>
        {rating ? <Text style={styles.creatorRating}>★ {rating}</Text> : null}
        {priceLabel ? <Text style={styles.creatorPrice} numberOfLines={1}>{priceLabel}</Text> : null}
      </View>
      <View style={styles.creatorCallButton}>
        <Text style={styles.creatorCallIcon}>☎</Text>
      </View>
    </Pressable>
  );
}

/**
 * Vertical live-stream tile: photo, LIVE badge, viewer count, name + status line.
 */
export function LiveCard({
  name,
  avatarUrl,
  viewerCount,
  statusText,
  onPress,
}: {
  name: string;
  avatarUrl?: string;
  viewerCount?: number;
  statusText?: string;
  onPress?: () => void;
}) {
  const bg = avatarColor(name);
  const photo = usePhotoSource(avatarUrl);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.liveTile, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.livePhoto, { backgroundColor: photo ? colors.surface : bg }]}>
        {photo ? (
          <Image source={photo} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Text style={styles.creatorPhotoLetter}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
        )}
        <View style={styles.liveTileBadge}>
          <Text style={styles.liveTileBadgeText}>LIVE</Text>
        </View>
        {viewerCount !== undefined ? (
          <View style={styles.liveTileViewers}>
            <Text style={styles.liveTileViewersText}>◉ {viewerCount}</Text>
          </View>
        ) : null}
        <View style={styles.liveTileFooter}>
          <Text style={styles.liveTileName} numberOfLines={1}>
            {name}
          </Text>
          {statusText ? (
            <Text style={styles.liveTileStatus} numberOfLines={1}>
              {statusText}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const EmptyState = ({
  icon = '♡',
  title,
  body,
}: {
  icon?: string;
  title: string;
  body: string;
}) => (
  <View style={styles.empty}>
    <View style={styles.emptyIconWrap}>
      <Text style={styles.emptyIcon}>{icon}</Text>
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
  </View>
);

export const Metric = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'gold';
}) => (
  <View style={styles.metric}>
    <Text
      style={[
        styles.metricValue,
        tone === 'success' && { color: colors.success },
        tone === 'gold' && { color: colors.gold },
      ]}
    >
      {value}
    </Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

export const Segmented = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <View style={styles.segmented}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.segment, active && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

export const IconButton = ({
  icon,
  onPress,
  size = 44,
}: {
  icon: string;
  onPress: () => void;
  size?: number;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.iconBtn,
      { width: size, height: size, borderRadius: size / 2 },
      pressed && { opacity: 0.75 },
    ]}
  >
    <Text style={styles.iconBtnText}>{icon}</Text>
  </Pressable>
);

const styles = StyleSheet.create<any>({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 130,
  },
  noPadding: {
    paddingHorizontal: 0,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  titleWrap: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionAction: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },

  field: {
    minHeight: 56,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },

  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderWidth: 1.5,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryGlow: {
    ...shadowPrimary,
  },
  secondaryButton: {
    backgroundColor: colors.primaryMuted,
    borderColor: 'transparent',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  dangerButton: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(255, 107, 122, 0.25)',
  },
  disabled: {
    opacity: 0.38,
  },
  pressed: {
    transform: [{ scale: 0.975 }],
    opacity: 0.92,
  },
  buttonIcon: {
    marginRight: 8,
    fontSize: 15,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  primaryText: {
    color: colors.white,
  },
  secondaryText: {
    color: colors.primaryDark,
  },
  ghostText: {
    color: colors.textSoft,
  },
  dangerText: {
    color: colors.danger,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowSm,
  },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  pillText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  neutralPill: {},
  neutralPillText: {},
  primaryPill: {
    backgroundColor: colors.primaryMuted,
  },
  primaryPillText: {
    color: colors.primaryDark,
  },
  successPill: {
    backgroundColor: colors.successSoft,
  },
  successPillText: {
    color: colors.success,
  },
  goldPill: {
    backgroundColor: colors.goldSoft,
  },
  goldPillText: {
    color: colors.gold,
  },

  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: colors.success,
    borderWidth: 2.5,
    borderColor: colors.bg,
  },

  // Dating-style profile card
  profileCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    ...shadow,
  },
  profileHero: {
    height: Math.min(SCREEN_W * 1.15, 420),
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  profileHeroDecor: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    backgroundColor: 'transparent',
  },
  profileHeroLetter: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    fontSize: 120,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: -4,
  },
  liveBadge: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  profileGradient: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 48,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  profileFooter: {},
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedMark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  profileHandle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  metaChipAccent: {
    backgroundColor: 'rgba(255, 77, 109, 0.35)',
  },
  metaChipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  metaChipAccentText: {
    color: colors.white,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIcon: {
    fontSize: 28,
    color: colors.primary,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    fontSize: 14,
    maxWidth: 280,
  },

  metric: {
    flex: 1,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 14,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  iconBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 18,
    color: colors.text,
  },

  // Compact creator tile (horizontal grid)
  creatorCard: {
    width: 152,
  },
  creatorPhoto: {
    width: 152,
    height: 168,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorPhotoLetter: {
    fontSize: 56,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
  },
  creatorOnlineBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  creatorOnlineText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  creatorCrown: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorCrownText: {
    color: colors.white,
    fontSize: 13,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 9,
  },
  creatorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  creatorVerifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorHandle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  creatorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  creatorRating: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  creatorPrice: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  creatorCallButton: {
    marginTop: 9,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowPrimary,
  },
  creatorCallIcon: {
    color: colors.white,
    fontSize: 15,
  },

  // Live stream tile
  liveTile: {
    width: 130,
  },
  livePhoto: {
    width: 130,
    height: 172,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTileBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveTileBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  liveTileViewers: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveTileViewersText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  liveTileFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveTileName: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  liveTileStatus: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    marginTop: 2,
  },
});
