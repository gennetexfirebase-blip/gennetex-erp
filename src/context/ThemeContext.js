import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, makeGradients, makeShadow } from '../theme/tokens';

const STORAGE_KEY = '@app_theme_mode';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system'); // 'light' | 'dark' | 'system'
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub?.remove?.();
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';

  const value = useMemo(() => {
    const colors = isDark ? darkColors : lightColors;
    return {
      mode,
      setMode,
      isDark,
      loaded,
      colors,
      gradients: makeGradients(colors),
      shadow: makeShadow(colors, isDark),
      toggle: () => setMode(isDark ? 'light' : 'dark'),
    };
  }, [isDark, mode, setMode, loaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Provider-гүй үед dark fallback
    return {
      mode: 'dark',
      setMode: () => {},
      isDark: true,
      loaded: true,
      colors: darkColors,
      gradients: makeGradients(darkColors),
      shadow: makeShadow(darkColors, true),
      toggle: () => {},
    };
  }
  return ctx;
}

/** makeStyles factory-г theme-д холбож memo хийнэ */
export function useStyles(factory) {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
