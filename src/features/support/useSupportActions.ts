import { useRef } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFeedback } from '../../components/ui/Feedback';
import { openSupportLink, supportConfig } from './config';
export function useSupportActions() {
  const feedback = useFeedback();
  const busy = useRef(false);
  const open = async (
    kind: 'privacy' | 'deletion-page' | 'email' | 'deletion',
  ) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (
        await openSupportLink(kind, { openURL: (url) => Linking.openURL(url) })
      ) {
        if (kind === 'deletion')
          feedback.show(
            'كمّل إرسال طلبك',
            'فتح البريد لوحده مش بيبعت الطلب ولا بيحذف الحساب. ابعت الرسالة من بريد حسابك واستنى رد الدعم.',
          );
      } else {
        const value =
          kind === 'privacy'
            ? supportConfig.privacyUrl
            : kind === 'deletion-page'
              ? supportConfig.deletionUrl
              : supportConfig.email;
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
  const requestDeletion = () =>
    feedback.show(
      'طلب حذف الحساب',
      'الدعم هيتأكد إن الحساب حسابك، ويراجع طلب حذف بياناتك وخدماتك المنشورة. الطلب بياخد من ٣ إلى ٥ أيام. لو عايز تعرف إيه اللي بيتحذف وإيه اللي بيتحفظ، اسأل الدعم. مفيش بيانات هتتحذف دلوقتي. بعد تنفيذ الحذف، ممكن متقدرش ترجعها.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'فتح البريد لطلب الحذف',
          style: 'destructive',
          onPress: () => {
            void open('deletion');
          },
        },
      ],
    );
  return {
    openPrivacy: () => void open('privacy'),
    openDeletionPage: () => void open('deletion-page'),
    openEmail: () => void open('email'),
    requestDeletion,
  };
}
