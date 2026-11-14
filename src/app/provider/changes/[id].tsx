import { fieldValue } from '../../../features/admin/AdminUi';
import { RemoteDataNotice } from '../../../features/provider/RemoteDataNotice';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useProviderState } from '../../../features/provider/ProviderContext';
import {
  ProviderPage,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import { EmptyState } from '../../../features/discovery/components/DiscoveryUi';
import type { ServiceValues } from '../../../features/provider/types';

const fields: { key: keyof ServiceValues; label: string }[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'categoryId', label: 'المجال' },
  { key: 'serviceTitle', label: 'الخدمة' },
  { key: 'description', label: 'النبذة' },
  { key: 'phone', label: 'الموبايل' },
  { key: 'whatsapp', label: 'واتساب' },
  { key: 'address', label: 'العنوان' },
  { key: 'serviceMode', label: 'طريقة تقديم الخدمة' },
  { key: 'coverageAreas', label: 'مناطق التغطية' },
  { key: 'weeklyHours', label: 'مواعيد العمل' },
];
export default function PendingChangesScreen() {
  const s = useProviderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listings, initializing, privateLoading, privateError } =
    useProviderState();
  const listing = listings.find((item) => item.id === id);
  const proposal = listing?.pendingChanges;
  if (initializing || privateLoading || privateError)
    return (
      <ProviderPage title="التعديلات المرسلة">
        <RemoteDataNotice privateData />
      </ProviderPage>
    );
  return (
    <ProviderPage title="التعديلات المرسلة">
      {listing && proposal ? (
        <>
          <Text style={s.notice}>
            خدمتك الحالية لسه منشورة. دي مقارنة بالتعديلات المقترحة للمراجعة.
          </Text>
          {fields.map(({ key, label }) => (
            <View key={key} style={s.card}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.body}>المنشور: {fieldValue(listing, key)}</Text>
              <Text style={s.body}>المقترح: {fieldValue(proposal, key)}</Text>
            </View>
          ))}
          <Text style={s.notice}>
            طلبك اتبعت للمراجعة، ومش هتقدر تعدّله دلوقتي. استنى نتيجة المراجعة
            قبل ما تبعت طلب جديد.
          </Text>
        </>
      ) : (
        <EmptyState
          title="التعديلات دي مش متاحة لحسابك."
          message="ممكن يكون الطلب اتراجع أو مش تابع لحسابك."
          actionLabel="عرض خدماتي"
          onAction={() => router.replace('/(tabs)/my-services')}
        />
      )}
    </ProviderPage>
  );
}
