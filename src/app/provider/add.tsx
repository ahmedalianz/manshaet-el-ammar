import { ProviderPage } from '../../features/provider/ProviderPage';
import { LoadingState } from '../../components/ui/LoadingState';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ServiceForm } from '../../features/provider/ServiceForm';
import { useProviderState } from '../../features/provider/ProviderContext';

export default function AddServiceScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { userId, role, initializing, categoriesLoading } = useProviderState();
  if (initializing || categoriesLoading)
    return (
      <ProviderPage title="إضافة خدمة">
        <LoadingState />
      </ProviderPage>
    );
  if (!userId) return <Redirect href="/provider/sign-in?next=add" />;
  const isAdmin = role === 'admin';
  return (
    <ServiceForm
      key={userId}
      adminDirect={isAdmin}
      onAdminComplete={(providerId) =>
        router.replace(
          from === 'admin'
            ? {
                pathname: '/admin/service/[id]',
                params: { id: providerId },
              }
            : { pathname: '/provider/[id]', params: { id: providerId } },
        )
      }
    />
  );
}
