import { LocalDirectoryProvider } from '../features/local/LocalDirectory';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { AppThemeProvider, useAppTheme } from '../theme/ThemeProvider';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '../components/ui/Feedback';
import '../lib/firebase/config';
import { queryClient } from '../lib/query-client';
import { ProviderStateProvider } from '../features/provider/ProviderContext';
import { AndroidBackBoundary } from '../features/navigation/AndroidBackBoundary';
import { AuthProvider } from '../features/auth/AuthProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootContent />
    </AppThemeProvider>
  );
}
function RootContent() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
      if (state === 'active')
        void queryClient.invalidateQueries({ queryKey: ['public'] });
    });
    return () => subscription.remove();
  }, []);
  const { colors, resolved, ready } = useAppTheme();
  const navigationTheme = useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.header,
        text: colors.textPrimary,
        border: colors.divider,
        notification: colors.error,
      },
    };
  }, [resolved, colors]);
  useEffect(() => {
    if (ready)
      void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [ready, colors.background]);
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashImageLoaded, setSplashImageLoaded] = useState(false);
  useEffect(() => {
    if (!fontsLoaded || !splashImageLoaded || !ready) return;
    let active = true;
    const finish = () => {
      if (active) setSplashVisible(false);
    };
    void SplashScreen.hideAsync().then(finish, finish);
    return () => {
      active = false;
    };
  }, [fontsLoaded, splashImageLoaded, ready]);

  if (fontError) throw fontError;
  if (!fontsLoaded || !ready) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ProviderStateProvider>
              <LocalDirectoryProvider>
                <FeedbackProvider>
                  <StatusBar
                    style={
                      splashVisible
                        ? 'dark'
                        : resolved === 'dark'
                          ? 'light'
                          : 'dark'
                    }
                  />
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <AndroidBackBoundary />
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                        headerStyle: { backgroundColor: colors.header },
                        headerTintColor: colors.textPrimary,
                      }}
                    />
                    {splashVisible ? (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: '#EAF5FA' },
                        ]}
                        accessibilityLabel="منشأة العمار — دليلك للخدمات في بلدنا"
                      >
                        <Image
                          source={require('../../assets/images/splash-screen.png')}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                          onLoad={() => setSplashImageLoaded(true)}
                          onError={() => setSplashImageLoaded(true)}
                        />
                      </View>
                    ) : null}
                  </View>
                </FeedbackProvider>
              </LocalDirectoryProvider>
            </ProviderStateProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </NavigationThemeProvider>
  );
}
