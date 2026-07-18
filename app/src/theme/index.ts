/**
 * SocialConnect — Premium dark social / dating design system
 * Inspired by Raya (luxury black), Hinge (story cards), Bumble (clear CTAs).
 */
export const colors = {
  // Canvas
  bg: '#000000',
  bgElevated: '#0C0C0E',
  surface: '#141416',
  surfaceSoft: '#1C1C1F',
  surfaceHover: '#222226',
  dark: '#0A0A0C',

  // Brand — warm rose (connection / dating energy)
  primary: '#FF4D6D',
  primaryDark: '#FF8FA3',
  primaryLight: '#2A1218',
  primaryMuted: 'rgba(255, 77, 109, 0.14)',
  primaryGlow: 'rgba(255, 77, 109, 0.4)',

  // Luxury accents
  gold: '#F5C451',
  goldSoft: 'rgba(245, 196, 81, 0.12)',
  cream: '#F7E7CE',

  // Text
  text: '#FFFFFF',
  textSoft: '#C8C8CE',
  muted: '#7A7A84',

  // Lines
  border: 'rgba(255, 255, 255, 0.08)',
  borderSoft: 'rgba(255, 255, 255, 0.05)',
  borderFocus: 'rgba(255, 77, 109, 0.5)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  // Semantic
  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.12)',
  danger: '#FF6B7A',
  dangerSoft: 'rgba(255, 107, 122, 0.12)',

  // Overlay / glass
  overlay: 'rgba(0, 0, 0, 0.55)',
  glass: 'rgba(20, 20, 22, 0.88)',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  pill: 999,
};

export const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.45,
  shadowRadius: 28,
  elevation: 10,
};

export const shadowSm = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 4,
};

export const shadowPrimary = {
  shadowColor: colors.primary,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.45,
  shadowRadius: 20,
  elevation: 10,
};

/** Soft avatar gradient palette for letter-based avatars */
export const avatarGradients = [
  ['#FF4D6D', '#C9184A'],
  ['#7B2CBF', '#5A189A'],
  ['#F77F00', '#D62828'],
  ['#2A9D8F', '#264653'],
  ['#E9C46A', '#F4A261'],
  ['#4CC9F0', '#4361EE'],
  ['#F72585', '#7209B7'],
  ['#06D6A0', '#118AB2'],
];

export function avatarColor(name?: string) {
  if (!name) return avatarGradients[0][0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length][0];
}
