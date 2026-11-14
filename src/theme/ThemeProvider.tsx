import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { colors as lightColors, darkColors, type ThemeColors } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'manshaet-el-ammar.appearance';
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
export function resolveTheme(
  preference: ThemePreference,
  system: string | null | undefined,
): 'light' | 'dark' {
  return preference === 'system'
    ? system === 'dark'
      ? 'dark'
      : 'light'
    : preference;
}
type AppTheme = {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  colors: ThemeColors;
  ready: boolean;
  persistenceError: string | null;
  setPreference: (preference: ThemePreference) => void;
};
const Context = createContext<AppTheme | null>(null);
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setSelected] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const revision = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (active && !revision.current)
          setSelected(isThemePreference(saved) ? saved : 'system');
      })
      .catch(() => {
        if (active && !revision.current)
          setPersistenceError(
            'مش قادرين نحمّل المظهر اللي اخترته. تقدر تختاره تاني.',
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const setPreference = useCallback((next: ThemePreference) => {
    if (!isThemePreference(next)) return;
    const current = ++revision.current;
    setSelected(next);
    setPersistenceError(null);
    writes.current = writes.current.then(async () => {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
        if (current === revision.current) setPersistenceError(null);
      } catch {
        if (current === revision.current)
          setPersistenceError(
            'مش قادرين نحفظ المظهر. اختيارك شغال لحد ما تقفل التطبيق.',
          );
      }
    });
  }, []);
  useEffect(() => {
    if (ready)
      Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  }, [preference, ready]);
  const resolved = resolveTheme(preference, system);
  const palette = resolved === 'dark' ? darkColors : lightColors;
  const value = useMemo(
    () => ({
      preference,
      resolved,
      colors: palette,
      ready,
      persistenceError,
      setPreference,
    }),
    [preference, resolved, palette, ready, persistenceError, setPreference],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppTheme() {
  const theme = useContext(Context);
  if (!theme) throw new Error('AppThemeProvider is required');
  return theme;
}
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useAppTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
