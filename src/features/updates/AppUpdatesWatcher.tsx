import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useFeedback } from '../../components/ui/Feedback';

const DEFAULT_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export type AppUpdatesWatcherProps = {
  /** Overrides automatic environment detection (used in tests). */
  enabled?: boolean;
  /** Minimum interval between foreground-resume checks. */
  cooldownMs?: number;
};

/**
 * Checks for EAS OTA updates on mount and foreground resume without blocking startup,
 * then prompts the user before reloading so active forms or auth flows are not lost.
 */
export function AppUpdatesWatcher({
  enabled = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled,
  cooldownMs = DEFAULT_CHECK_COOLDOWN_MS,
}: AppUpdatesWatcherProps) {
  const feedback = useFeedback();

  const checkingRef = useRef(false);
  const promptedRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function checkAndFetch(respectCooldown: boolean) {
      if (checkingRef.current || promptedRef.current) return;
      const now = Date.now();
      if (respectCooldown && now - lastCheckAtRef.current < cooldownMs) return;

      checkingRef.current = true;
      lastCheckAtRef.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!active || !result.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (!active || !fetched.isNew) return;
        promptedRef.current = true;
        feedback.show(
          'في تحديث جديد للتطبيق',
          'نزّلنا تحديث جديد للتطبيق. أعد التشغيل دلوقتي عشان يظهر لك.',
          [
            { text: 'بعدين', style: 'cancel' },
            {
              text: 'إعادة التشغيل دلوقتي',
              onPress: () => {
                void Updates.reloadAsync().catch(() => {});
              },
            },
          ],
          { key: 'ota-update-ready', tone: 'info' },
        );
      } catch {
        // Silent background check: connectivity or update-server errors must not disrupt users.
      } finally {
        checkingRef.current = false;
      }
    }

    void checkAndFetch(false);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkAndFetch(true);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [enabled, cooldownMs, feedback]);

  return null;
}
