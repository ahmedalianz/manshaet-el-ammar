import { Text } from 'react-native';
import { useAdminService } from '../../../features/admin/useAdminService';
import { RemoteDataNotice } from '../../../features/provider/RemoteDataNotice';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { returnToRoute } from '../../../features/navigation/returnToRoute';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import { EmptyState } from '../../../features/discovery/components/DiscoveryUi';
import { ServiceForm } from '../../../features/provider/ServiceForm';
import { useProviderState } from '../../../features/provider/ProviderContext';
import type { ProviderListing } from '../../../features/provider/types';

export default function EditServiceScreen() {
  const styles = useProviderStyles();
  const { id, proposal, from, reportId, categoryId } = useLocalSearchParams<{
    id: string;
    proposal?: string;
    from?: string;
    reportId?: string;
    categoryId?: string;
  }>();
  const {
    userId,
    role,
    listings,
    pendingRequests,
    adminError,
    initializing,
    privateLoading,
    privateError,
    refresh,
  } = useProviderState();
  const isAdmin = role === 'admin' && Boolean(userId);
  const adminLookup = useAdminService(isAdmin ? id : undefined);

  if (initializing || (!isAdmin && (privateLoading || privateError)))
    return (
      <ProviderPage title="تعديل الخدمة">
        <RemoteDataNotice privateData />
      </ProviderPage>
    );
  if (!userId) return <Redirect href="/provider/sign-in?next=my-services" />;

  if (isAdmin) {
    if (adminLookup.loading)
      return (
        <ProviderPage title="تعديل الخدمة">
          <RemoteDataNotice privateData />
        </ProviderPage>
      );
    const adminListing: ProviderListing | undefined = adminLookup.service
      ? {
          ...adminLookup.service,
          status: 'approved',
          dataSource: 'firestore',
        }
      : listings?.find((record) => record.id === id);
    if ((adminLookup.error || adminError) && !adminListing)
      return (
        <ProviderPage title="تعديل الخدمة">
          <Text accessibilityRole="alert" style={styles.body}>
            {adminLookup.error || adminError}
          </Text>
          <ProviderAction
            title="جرّب تاني"
            onPress={() => {
              refresh();
              adminLookup.retry();
            }}
          />
        </ProviderPage>
      );
    if (!adminListing)
      return (
        <ProviderPage title="تعديل الخدمة">
          <EmptyState
            title="الخدمة مش متاحة"
            message="الخدمة دي غير موجودة أو اتحذفت."
            actionLabel="العودة لإدارة الخدمات"
            onAction={() => returnToRoute('/admin')}
          />
        </ProviderPage>
      );
    const hasPendingRequest = Boolean(
      pendingRequests?.some(
        (request) => request.providerId === id && request.status === 'pending',
      ),
    );
    return (
      <ServiceForm
        key={`${id}-admin`}
        listing={adminListing}
        adminDirect
        hasPendingRequest={hasPendingRequest}
        onAdminComplete={(providerId) => {
          if (from === 'admin-report' && reportId)
            returnToRoute({
              pathname: '/admin/report/[id]',
              params: { id: reportId },
            });
          else if (from === 'provider')
            returnToRoute({
              pathname: '/provider/[id]',
              params: { id: providerId },
            });
          else if (from === 'category' && categoryId)
            returnToRoute({
              pathname: '/category/[id]',
              params: { id: categoryId },
            });
          else if (from === 'my-services') returnToRoute('/(tabs)/my-services');
          else
            returnToRoute({
              pathname: '/admin/service/[id]',
              params: { id: providerId },
            });
        }}
      />
    );
  }

  const listing = listings.find((record) => record.id === id);
  if (!listing)
    return (
      <ProviderPage title="تعديل الخدمة">
        <EmptyState
          title="الخدمة مش متاحة"
          message="الخدمة دي غير موجودة أو مش تابعة لحسابك."
          actionLabel="عرض خدماتي"
          onAction={() => returnToRoute('/(tabs)/my-services')}
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
