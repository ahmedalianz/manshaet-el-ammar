import { fieldValue } from '../../../features/admin/AdminUi';
import { PrivatePhotoPreview } from '../../../features/photos/PrivatePhotoPreview';
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
          {(proposal.photoChange && proposal.photoChange.action !== 'keep') ||
          listing.photoReviewStatus === 'pending' ? (
            <View style={s.card}>
              <Text style={s.label}>صورة المكان</Text>
              <Text style={s.body}>
                المنشور:{' '}
                {listing.placePhoto
                  ? 'صورة منشورة حاليًا'
                  : 'لا توجد صورة منشورة'}
              </Text>
              <Text style={s.body}>
                المقترح:{' '}
                {proposal.photoChange?.action === 'remove'
                  ? 'طلب إزالة الصورة'
                  : 'صورة جديدة قيد المراجعة'}
              </Text>
              {listing.photoCandidateId ?? proposal.photoChange?.candidateId ? (
                <PrivatePhotoPreview
                  candidateId={
                    (listing.photoCandidateId ??
                      proposal.photoChange?.candidateId)!
                  }
                />
              ) : null}
            </View>
          ) : null}
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
