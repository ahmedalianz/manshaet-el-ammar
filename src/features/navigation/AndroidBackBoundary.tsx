import { useLayoutEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';

/** Last fallback only: focused forms and native modals retain their own Back handling. */
export function AndroidBackBoundary() {
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useLayoutEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);
  // Register before passive navigation/focus listeners, and never reorder on route changes.
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (router.canGoBack()) return false;
        if (currentPath.current !== '/') router.replace('/(tabs)');
        return true;
      },
    );
    return () => subscription.remove();
  }, []);
  return null;
}
