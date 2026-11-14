import { ServiceOwner } from '../../../features/admin/ServiceOwner';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
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
} from '../../../features/admin/AdminUi';
import { useProviderState } from '../../../features/provider/ProviderContext';
import { useProviderStyles } from '../../../features/provider/ProviderPage';

export default function ServiceScreen() {
  return (
    <AdminGuard>
      <ServiceDetails />
    </AdminGuard>
  );
}
function ServiceDetails() {
  const providerStyles = useProviderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { services } = useProviderState();
  const service = services.find((item) => item.id === id);
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
            <UnpublishAction id={service.id} />
            <DeleteServiceAction id={service.id} />
          </>
        ) : (
          <>
            <RestoreAction id={service.id} />
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
