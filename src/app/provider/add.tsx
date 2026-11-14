import { ServiceQuotaGate } from '../../features/provider/ServiceQuotaGate';
import { ProviderPage } from '../../features/provider/ProviderPage';
import { LoadingState } from '../../components/ui/LoadingState';
import { Redirect } from 'expo-router';
import { ServiceForm } from '../../features/provider/ServiceForm';
import { useProviderState } from '../../features/provider/ProviderContext';

export default function AddServiceScreen() {
  const { userId, initializing, categoriesLoading } = useProviderState();
  if (initializing || categoriesLoading)
    return (
      <ProviderPage title="إضافة خدمة">
        <LoadingState />
      </ProviderPage>
    );
  if (!userId) return <Redirect href="/provider/sign-in?next=add" />;
  return (
    <ServiceQuotaGate userId={userId}>
      <ServiceForm key={userId} />
    </ServiceQuotaGate>
  );
}
