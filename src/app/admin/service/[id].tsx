import { ServiceOwner } from '../../../features/admin/ServiceOwner';
import { RecoverServicePhotoAction } from '../../../features/admin/AdminPhotoReview';
import { useAdminService } from '../../../features/admin/useAdminService';
import { useFeedback } from '../../../components/ui/Feedback';
import { LoadingState } from '../../../components/ui/LoadingState';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  AdminGuard,
  AdminPage,
  MissingRecord,
  ReadonlyFields,
  AdminServiceCard,
  AdminSectionTitle,
  UnpublishAction,
  RestoreAction,
  DeleteServiceAction,
  performAdminAction,
} from '../../../features/admin/AdminUi';
import { useProviderState } from '../../../features/provider/ProviderContext';
import {
  ProviderAction,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';

export default function ServiceScreen() {
  return (
    <AdminGuard>
      <ServiceDetails />
    </AdminGuard>
  );
}
function ServiceDetails() {
  const providerStyles = useProviderStyles();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adminBusy, setServiceClaimable } = useProviderState();
  const { service, loading, error, retry } = useAdminService(id);
  if (loading)
    return (
      <AdminPage title="إدارة الخدمة" scroll={false}>
        <LoadingState />
      </AdminPage>
    );
  if (error)
    return (
      <AdminPage title="إدارة الخدمة">
        <Text accessibilityRole="alert" style={providerStyles.notice}>
          {error}
        </Text>
        <ProviderAction title="جرّب تاني" onPress={retry} />
      </AdminPage>
    );
  if (!service)
    return (
      <AdminPage title="إدارة الخدمة">
        <MissingRecord />
      </AdminPage>
    );
  return (
    <AdminPage
      title={
        service.publicationStatus === 'published'
          ? 'تفاصيل الخدمة المنشورة'
          : 'خدمة في الأرشيف'
      }
      actions={
        service.publicationStatus === 'published' ? (
          <>
            <ProviderAction
              disabled={Boolean(adminBusy)}
              title="تعديل بيانات الخدمة"
              onPress={() =>
                router.push({
                  pathname: '/provider/edit/[id]',
                  params: { id: service.id, from: 'admin-service' },
                })
              }
            />
            <RecoverServicePhotoAction service={service} onRestored={retry} />
            <UnpublishAction id={service.id} />
            <DeleteServiceAction id={service.id} />
          </>
        ) : (
          <>
            <RestoreAction id={service.id} />
            <ProviderAction
              secondary
              disabled={Boolean(adminBusy)}
              title="تعديل بيانات الخدمة"
              onPress={() =>
                router.push({
                  pathname: '/provider/edit/[id]',
                  params: { id: service.id, from: 'admin-service' },
                })
              }
            />
            <DeleteServiceAction id={service.id} />
          </>
        )
      }
    >
      <AdminServiceCard service={service} />
      <AdminSectionTitle
        title="بيانات الخدمة"
        icon="card-account-details-outline"
      />
      <ServiceOwner ownerId={service.ownerId} />
      {service.publicationStatus === 'published' && setServiceClaimable ? (
        <View style={providerStyles.card}>
          <Text accessibilityRole="header" style={providerStyles.heading}>
            نقل ملكية الخدمة لصاحبها
          </Text>
          <Text style={providerStyles.body}>
            {service.claimable
              ? 'الخدمة متاحة حاليًا لمقدمي الخدمات لطلب نقلها لحسابهم (هيظهر لهم قسم «هل دي خدمتك؟»).'
              : 'طلبات نقل الملكية مقفولة حاليًا على الخدمة دي.'}
          </Text>
          <ProviderAction
            secondary
            disabled={Boolean(adminBusy)}
            title={
              service.claimable
                ? 'إيقاف طلبات نقل الملكية'
                : 'إتاحة طلب نقل الملكية لصاحب الخدمة'
            }
            onPress={async () => {
              const nextClaimable = !service.claimable;
              const done = await performAdminAction(
                () => setServiceClaimable(service.id, nextClaimable),
                nextClaimable
                  ? 'تم تفعيل استقبال طلبات نقل الملكية للخدمة.'
                  : 'تم إيقاف استقبال طلبات نقل الملكية للخدمة.',
                feedback,
              );
              if (done) retry();
            }}
          />
        </View>
      ) : null}
      <Text style={providerStyles.notice}>
        {service.publicationStatus === 'published'
          ? 'الخدمة ظاهرة حاليًا في دليل البلد.'
          : 'الخدمة غير منشورة ومش ظاهرة في الدليل العام.'}
      </Text>
      {service.unpublishReason ? (
        <Text style={providerStyles.notice}>
          سبب الإخفاء: {service.unpublishReason}
        </Text>
      ) : null}
      <ReadonlyFields values={service} />
      <Text style={providerStyles.notice}>
        {service.publicationStatus === 'published'
          ? 'بيانات الخدمة ظاهرة لأهالي البلد في الدليل العام.'
          : 'بيانات الخدمة مخفية من الدليل العام.'}
      </Text>
    </AdminPage>
  );
}
