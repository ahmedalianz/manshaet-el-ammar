import { RemoteDataNotice } from '../../../features/provider/RemoteDataNotice';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { ProviderPage } from '../../../features/provider/ProviderPage';
import { EmptyState } from '../../../features/discovery/components/DiscoveryUi';
import { ServiceForm } from '../../../features/provider/ServiceForm';
import { useProviderState } from '../../../features/provider/ProviderContext';

export default function EditServiceScreen() {
  const { id, proposal } = useLocalSearchParams<{
    id: string;
    proposal?: string;
  }>();
  const { userId, listings, initializing, privateLoading, privateError } =
    useProviderState();
  if (initializing || privateLoading || privateError)
    return (
      <ProviderPage title="تعديل الخدمة">
        <RemoteDataNotice privateData />
      </ProviderPage>
    );
  if (!userId) return <Redirect href="/provider/sign-in?next=my-services" />;
  const listing = listings.find((record) => record.id === id);
  if (!listing)
    return (
      <ProviderPage title="تعديل الخدمة">
        <EmptyState
          title="الخدمة مش متاحة"
          message="الخدمة دي غير موجودة أو مش تابعة لحسابك."
          actionLabel="عرض خدماتي"
          onAction={() => router.replace('/(tabs)/my-services')}
        />
      </ProviderPage>
    );
  if (listing.status === 'pending')
    return (
      <ProviderPage title="طلب قيد المراجعة">
        <EmptyState
          title="طلبك قيد المراجعة"
          message="طلبك اتبعت للمراجعة، ومش هتقدر تعدّله دلوقتي. استنى نتيجة المراجعة قبل ما تبعته تاني."
        />
      </ProviderPage>
    );
  if (listing.pendingChanges)
    return (
      <Redirect href={{ pathname: '/provider/changes/[id]', params: { id } }} />
    );
  return (
    <ServiceForm
      key={`${id}-${proposal ?? ''}`}
      listing={listing}
      proposal={proposal === '1'}
    />
  );
}
