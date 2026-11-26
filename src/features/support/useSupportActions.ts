import { useRef } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFeedback } from '../../components/ui/Feedback';
import { openSupportLink, supportConfig } from './config';
export function useSupportActions() {
  const feedback = useFeedback();
  const busy = useRef(false);
  const open = async (kind: 'privacy' | 'email') => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (
        !(await openSupportLink(kind, {
          openURL: (url) => Linking.openURL(url),
        }))
      ) {
        const value =
          kind === 'privacy' ? supportConfig.privacyUrl : supportConfig.email;
        feedback.show(
          'مش قادرين نفتح الرابط',
          `تقدر تستخدم العنوان ده بنفسك:\n${value}`,
          [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'نسخ العنوان',
              onPress: async () => {
                try {
                  if (await Clipboard.setStringAsync(value)) {
                    feedback.show('تم النسخ', 'تم نسخ العنوان');
                    return;
                  }
                } catch {
                  /* Report below. */
                }
                feedback.show(
                  'مش قادرين ننسخ العنوان',
                  'انسخ العنوان اللي ظاهر قدامك وجرّب تاني.',
                );
              },
            },
          ],
        );
      }
    } finally {
      busy.current = false;
    }
  };
  return {
    openPrivacy: () => void open('privacy'),
    openEmail: () => void open('email'),
  };
}
