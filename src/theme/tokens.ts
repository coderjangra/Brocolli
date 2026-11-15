// Design tokens from SPEC §8. Components must use these; no hard-coded colors or sizes.

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  brand: string;
  brandPressed: string;
  onBrand: string;
  owe: string;
  owed: string;
  neutral: string;
  warn: string;
  overlay: string;
}

export const darkColors: ColorTokens = {
  bg: '#0B0F0C',
  surface: '#141A16',
  surfaceRaised: '#1C241F',
  text: '#F1F5F2',
  textMuted: '#94A3B8',
  border: '#27322B',
  brand: '#22C55E',
  brandPressed: '#16A34A',
  onBrand: '#052E14',
  owe: '#FB7185',
  owed: '#4ADE80',
  neutral: '#94A3B8',
  warn: '#F59E0B',
  overlay: 'rgba(0,0,0,0.6)',
};

// Light mirrors dark; text-on-background pairs chosen for WCAG AA (verify in M9 pass).
export const lightColors: ColorTokens = {
  bg: '#F7FAF8',
  surface: '#FFFFFF',
  surfaceRaised: '#EEF3EF',
  text: '#0B0F0C',
  textMuted: '#475569',
  border: '#D5DED8',
  brand: '#15803D',
  brandPressed: '#166534',
  onBrand: '#FFFFFF',
  owe: '#BE123C',
  owed: '#15803D',
  neutral: '#475569',
  warn: '#B45309',
  overlay: 'rgba(11,15,12,0.4)',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { input: 14, card: 20, sheet: 28, pill: 999 } as const;

export const typography = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

/** Apply to every money label so digits don't jitter. */
export const tabularNums = { fontVariant: ['tabular-nums'] as 'tabular-nums'[] };

export const minTapTarget = 44;

/** Mascot ("Broc") palette. Same in both themes so the character stays on-brand. */
export const mascotColors = {
  floret: '#22C55E',
  floretDark: '#16A34A',
  floretLight: '#4ADE80',
  stalk: '#D9F99D',
  stalkShade: '#BEF264',
  face: '#14532D',
  eyeShine: '#FFFFFF',
  cheek: '#FB7185',
  coin: '#FBBF24',
  coinEdge: '#D97706',
  shadow: 'rgba(0,0,0,0.18)',
} as const;

/** Avatar backgrounds, picked by hashing the person id. */
export const avatarColors = ['#14532D', '#1E3A5F', '#4C1D95', '#7C2D12', '#831843', '#134E4A'];

export const confettiColors = ['#22C55E', '#4ADE80', '#FBBF24', '#FB7185', '#38BDF8', '#A78BFA'];

// Springs everywhere, no linear tweens.
export const motion = {
  springBack: { damping: 15, stiffness: 180 },
  enter: { damping: 18, stiffness: 160 },
  press: { damping: 14, stiffness: 320 },
  bouncy: { damping: 9, stiffness: 140 },
} as const;

export interface Theme {
  scheme: 'dark' | 'light';
  colors: ColorTokens;
}

export const themes: Record<'dark' | 'light', Theme> = {
  dark: { scheme: 'dark', colors: darkColors },
  light: { scheme: 'light', colors: lightColors },
};

/** QR codes stay dark-on-white in both themes so every scanner can read them. */
export const qrColors = { modules: '#0B0F0C', background: '#FFFFFF' } as const;
