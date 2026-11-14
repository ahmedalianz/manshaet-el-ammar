import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  listDrafts,
  discardDraft,
  type ServiceDraft,
} from '../../features/local/drafts';
import {
  ProviderPage,
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { useFeedback } from '../../components/ui/Feedback';
export default function DraftsScreen() {
  const { user, initializing } = useAuth();
  const styles = useProviderStyles(),
    feedback = useFeedback();
  const [rows, setRows] = useState<(ServiceDraft & { id: string })[]>([]),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void version;
      setRows([]);
      if (user)
        void listDrafts(user.uid)
          .then((rows) => {
            if (active) setRows(rows);
          })
          .catch(() => {
            if (active) setError('مش قادرين نقرأ المسودات.');
          });
      return () => {
        active = false;
      };
    }, [user, version]),
  );
  if (!user && !initializing)
    return <Redirect href="/provider/sign-in?next=drafts" />;
  return (
    <ProviderPage title="مسودات الخدمات">
      <Text style={styles.notice}>
        محفوظة على الجهاز لحسابك، ومش طلبات اتبعتت. بتتمسح لما تسجّل خروجك.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      ) : null}
      {!rows.length ? (
        <Text style={styles.body}>لسه مفيش مسودات محفوظة.</Text>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.heading}>
            {row.values.serviceTitle || 'مسودة خدمة'}
          </Text>
          <Text style={styles.body}>
            آخر حفظ: {new Date(row.savedAt).toLocaleString('ar-EG')}
          </Text>
          <ProviderAction
            title="كمّل المسودة"
            onPress={() =>
              router.push({
                pathname: '/provider/draft/[id]',
                params: { id: row.id },
              })
            }
          />
          <ProviderAction
            secondary
            destructive
            title="حذف المسودة"
            onPress={() =>
              feedback.show(
                'نمسح المسودة؟',
                'البيانات اللي فيها هتتمسح من الجهاز.',
                [
                  { text: 'رجوع', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await discardDraft(user!.uid, row.id);
                        setVersion((v) => v + 1);
                      } catch {
                        setError('مش قادرين نمسح المسودة.');
                      }
                    },
                  },
                ],
              )
            }
          />
        </View>
      ))}
    </ProviderPage>
  );
}
