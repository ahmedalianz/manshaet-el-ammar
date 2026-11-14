import { useRef, useState } from 'react';
import { Linking, Share } from 'react-native';
import {
  isTransientReadError,
  useLocalDirectory,
} from '../local/LocalDirectory';
import { providerShareText } from '../local/sharing';
import * as Clipboard from 'expo-clipboard';
import { useFeedback } from '../../components/ui/Feedback';
import { copyProviderNumber, openProviderContact } from './contact';
import type { ServiceProvider } from './types';

// Each caller supplies a fresh public read; never launch against stale cached data.
export function useProviderContactActions(
  loadProvider: () => Promise<ServiceProvider | null | undefined>,
  fallbackProvider?: ServiceProvider | null,
) {
  const feedback = useFeedback();
  const local = useLocalDirectory();
  const actionLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const performContact = async (
    action:
      | 'call'
      | 'whatsapp'
      | 'copy'
      | 'copy-whatsapp'
      | 'share'
      | 'share-native'
      | 'share-copy',
    acknowledged?: ServiceProvider,
  ) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      let current = acknowledged;
      if (!current) {
        try {
          current = (await loadProvider()) ?? undefined;
        } catch (error) {
          if (!isTransientReadError(error)) throw error;
          current = fallbackProvider
            ? local.getCachedProvider(fallbackProvider.id)
            : undefined;
          if (!current) throw error;
        }
        if (!current && fallbackProvider)
          local.markUnavailable(fallbackProvider.id);
        if (current?.cachedAt) {
          const saved = current;
          feedback.show(
            'بيانات محفوظة على الجهاز',
            `آخر حفظ: ${new Date(saved.cachedAt!).toLocaleDateString('ar-EG')}. مش قادرين نتأكد إن الخدمة لسه متاحة. تكمل بالبيانات المحفوظة؟`,
            [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'استخدام البيانات المحفوظة',
                onPress: () => {
                  void performContact(action, saved);
                },
              },
            ],
          );
          return;
        }
      }
      if (acknowledged && !local.getCachedProvider(acknowledged.id)) {
        feedback.show('البيانات المحفوظة مش متاحة', 'حدّث الخدمة قبل التواصل.');
        return;
      }
      if (
        action === 'share' ||
        action === 'share-native' ||
        action === 'share-copy'
      ) {
        if (
          !current ||
          current.dataSource !== 'firestore' ||
          current.status !== 'approved' ||
          current.publicationStatus !== 'published'
        ) {
          feedback.show('الخدمة مش متاحة', 'مش قادرين نشارك خدمة غير متاحة.');
          return;
        }
        const message = providerShareText(current);
        if (action === 'share-native') {
          await Share.share({ message }).catch(() =>
            feedback.show('مش قادرين نشارك', 'جرّب تاني.'),
          );
          return;
        }
        if (action === 'share-copy') {
          await Clipboard.setStringAsync(message)
            .then((ok) => {
              if (!ok) throw new Error('Clipboard unavailable');
              feedback.show('تم نسخ بيانات الخدمة', '');
            })
            .catch(() => feedback.show('مش قادرين ننسخ', 'جرّب تاني.'));
          return;
        }
        try {
          await Linking.openURL(
            `whatsapp://send?text=${encodeURIComponent(message)}`,
          );
        } catch {
          feedback.show(
            'مشاركة الخدمة',
            'تقدر تفتح قائمة المشاركة أو تنسخ بيانات الخدمة.',
            [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'مشاركة',
                onPress: () => {
                  void performContact(
                    'share-native',
                    current?.cachedAt ? current : undefined,
                  );
                },
              },
              {
                text: 'نسخ البيانات',
                onPress: () => {
                  void performContact(
                    'share-copy',
                    current?.cachedAt ? current : undefined,
                  );
                },
              },
            ],
          );
        }
        return;
      }
      const method =
        action === 'whatsapp' || action === 'copy-whatsapp'
          ? 'whatsapp'
          : 'call';
      const result =
        action === 'copy' || action === 'copy-whatsapp'
          ? await copyProviderNumber(current, Clipboard, method)
          : await openProviderContact(current, method, {
              openURL: (url) => Linking.openURL(url),
            });
      if (result.ok) {
        if (action === 'copy' || action === 'copy-whatsapp')
          feedback.show('تم نسخ الرقم', '');
      } else {
        feedback.show(
          'مش قادرين نفتح التواصل',
          result.message ?? 'رقم الموبايل مش متاح دلوقتي',
          result.copyNumber
            ? [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'نسخ الرقم',
                  onPress: () => {
                    void performContact(
                      method === 'whatsapp' ? 'copy-whatsapp' : 'copy',
                    );
                  },
                },
              ]
            : undefined,
        );
      }
    } catch (error) {
      const permission =
        typeof error === 'object' &&
        error &&
        'code' in error &&
        String(error.code).includes('permission-denied');
      feedback.show(
        'مش قادرين نتواصل دلوقتي',
        permission
          ? 'مش مسموح بقراءة بيانات الخدمة دلوقتي. البيانات المحفوظة مش متاحة للتواصل.'
          : 'مش قادرين نتأكد إن الخدمة لسه متاحة. اتأكد من الإنترنت وجرّب تاني.',
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  return { busy, performContact };
}
