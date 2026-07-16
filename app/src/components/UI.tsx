import React from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export const Screen = ({ children, scroll = false, padded = true }: { children: React.ReactNode; scroll?: boolean; padded?: boolean }) => {
  const content = scroll ? <ScrollView contentContainerStyle={[styles.content, !padded && styles.noPadding]} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[styles.content, !padded && styles.noPadding]}>{children}</View>;
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
};

export const Eyebrow = ({ children }: { children: React.ReactNode }) => <Text style={styles.eyebrow}>{children}</Text>;
export const Title = ({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) => <View style={styles.titleWrap}><Text style={styles.title}>{children}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
export const SectionTitle = ({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) => <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{children}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
export const Field = (props: TextInputProps) => <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.field, props.style]} />;

export function Button({ title, onPress, disabled = false, variant = 'primary', icon, loading = false }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: string; loading?: boolean }) {
  return <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, styles[`${variant}Button`], (disabled || loading) && styles.disabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={variant === 'primary' ? '#FFF' : colors.primary} /> : <><Text style={styles.buttonIcon}>{icon}</Text><Text style={[styles.buttonText, styles[`${variant}Text`]]}>{title}</Text></>}</Pressable>;
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) => <View style={[styles.card, style]}>{children}</View>;
export const Pill = ({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'default' | 'primary' | 'success' | 'gold' }) => { const resolved = tone === 'default' ? 'neutral' : tone; return <View style={[styles.pill, styles[`${resolved}Pill`]]}><Text style={[styles.pillText, styles[`${resolved}PillText`]]}>{label}</Text></View>; };
export const Avatar = ({ name, size = 52, online = false }: { name?: string; size?: number; online?: boolean }) => <View style={{ width: size, height: size }}><View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: size * .34 }]}>{(name || '?').slice(0, 1).toUpperCase()}</Text></View>{online ? <View style={styles.onlineDot} /> : null}</View>;
export const EmptyState = ({ icon = '✦', title, body }: { icon?: string; title: string; body: string }) => <Card style={styles.empty}><Text style={styles.emptyIcon}>{icon}</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></Card>;
export const Metric = ({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'success' | 'gold' }) => <View style={styles.metric}><Text style={[styles.metricValue, tone === 'success' && { color: colors.success }, tone === 'gold' && { color: colors.gold }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;

const styles = StyleSheet.create<any>({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 }, noPadding: { paddingHorizontal: 0 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  titleWrap: { marginBottom: spacing.xl }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8, color: colors.text }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 5 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '850' }, sectionAction: { color: colors.primary, fontWeight: '750' },
  field: { minHeight: 54, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, color: colors.text, fontSize: 15, marginBottom: spacing.md },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1 }, primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary }, secondaryButton: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }, ghostButton: { backgroundColor: colors.surface, borderColor: colors.border }, dangerButton: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }, disabled: { opacity: .45 }, pressed: { transform: [{ scale: .985 }], opacity: .9 }, buttonIcon: { marginRight: 7, fontSize: 16 }, buttonText: { fontSize: 15, fontWeight: '800' }, primaryText: { color: '#FFF' }, secondaryText: { color: colors.primaryDark }, ghostText: { color: colors.textSoft }, dangerText: { color: colors.danger },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#F0EFF3' }, pillText: { color: colors.textSoft, fontSize: 11, fontWeight: '800' }, neutralPill: {}, neutralPillText: {}, primaryPill: { backgroundColor: colors.primaryLight }, primaryPillText: { color: colors.primaryDark }, successPill: { backgroundColor: colors.successSoft }, successPillText: { color: colors.success }, goldPill: { backgroundColor: colors.goldSoft }, goldPillText: { color: '#AD6C00' },
  avatar: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' }, avatarText: { color: colors.primaryDark, fontWeight: '900' }, onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: '#FFF' },
  empty: { alignItems: 'center', paddingVertical: 30 }, emptyIcon: { fontSize: 28, color: colors.primary, marginBottom: 10 }, emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, emptyBody: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 5 },
  metric: { flex: 1 }, metricValue: { color: colors.text, fontSize: 22, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
