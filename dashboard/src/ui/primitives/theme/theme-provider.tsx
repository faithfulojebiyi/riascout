'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes';

export const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
};

export { useTheme } from 'next-themes';

export const THEME_NAMES = {
  dark: 'Dark',
  light: 'Light',
  // 'pulse-dark': 'Pulse Dark',
  system: 'System',
};

export const THEME_KEYS_TO_DS_MAP = {
  dark: '_dark',
  light: 'base',
  // 'pulse-dark': '_pulseDark'
};
