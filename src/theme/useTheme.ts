import { useColorScheme } from 'react-native';

import { useStore } from '@/store/useStore';

import { themes, type Theme } from './tokens';

/** Follows the user's setting; "system" is dark-first (dark unless the OS says light). */
export function useTheme(): Theme {
  const preference = useStore((s) => s.settings.theme);
  const system = useColorScheme();
  if (preference === 'system') return system === 'light' ? themes.light : themes.dark;
  return themes[preference];
}
