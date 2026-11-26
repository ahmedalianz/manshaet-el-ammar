import { useAdminService } from '../../../features/admin/useAdminService';
import { useFeedback } from '../../../components/ui/Feedback';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  AdminGuard,
  formatAdminDate,
  AdminPage,
  AdminSectionTitle,
  AdminServiceCard,
  AdminContactButton,
  MissingRecord,
  UnpublishAction,
  DeleteServiceAction,
  performAdminAction,
} from '../../../features/admin/AdminUi';
import { useProviderState } from '../../../features/provider/ProviderContext';
import {
  ProviderAction,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import type { ThemeColors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';

export default function ReportScreen() {
  return (
    <AdminGuard>
      <ReportDetails />
    </AdminGuard>
  );
}
function ReportDetails() {
  const styles = useThemedStyles(createStyles);
  const providerStyles = useProviderStyles();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports, closeReport, adminBusy } = useProviderState();
  const report = reports.find((item) => item.id === id);
  const { service } = useAdminService(report?.providerId);
  if (!report)
    return (
      <AdminPage title="مراجعة البلاغ">
        <MissingRecord />
      </AdminPage>
    );
  return (
    <AdminPage
      title="تفاصيل الخدمة والبلاغ"
      badge={
        service?.publicationStatus === 'published' ? 'منشورة' : 'غير منشورة'
      }
    >
      {service ? (
        <AdminServiceCard service={service} />
      ) : (
        <MissingRecord text="الخدمة المرتبطة بالبلاغ غير متاحة." />
      )}
      <AdminSectionTitle
        title="مراجعة بلاغ وارد"
        icon="flag-outline"
        aside={report.status === 'open' ? 'قيد المراجعة' : 'مغلق'}
      />
      <View style={styles.card}>
        <View style={styles.reportMeta}>
          <Text style={styles.status}>
            {report.status === 'open'
              ? 'بلاغ مفتوح — محتاج مراجعة المشرف.'
              : 'البلاغ مغلق.'}
          </Text>
          <Text style={styles.date}>
            تاريخ البلاغ: {formatAdminDate(report.createdAt)}
          </Text>
          <Text selectable style={styles.date}>
            معرّف الخدمة: {report.providerId}
          </Text>
        </View>
        <View style={styles.reason}>
          <Text style={providerStyles.label}>سبب البلاغ</Text>
          <Text selectable style={styles.reasonText}>
            {report.reason}
          </Text>
        </View>
        {service ? (
          <>
            <AdminContactButton
              phone={service.phone}
              title="اتصال للتأكد من الرقم"
            />
            <ProviderAction
              secondary
              disabled={Boolean(adminBusy)}
              title="تعديل بيانات الخدمة"
              onPress={() =>
                router.push({
                  pathname: '/provider/edit/[id]',
                  params: {
                    id: service.id,
                    from: 'admin-report',
                    reportId: report.id,
                  },
                })
              }
            />
          </>
        ) : null}
        {report.status === 'open' ? (
          <ProviderAction
            secondary
            disabled={adminBusy}
            title="إغلاق البلاغ"
            onPress={() =>
              feedback.show(
                'إغلاق البلاغ؟',
                'إغلاق البلاغ مش بيغيّر حالة نشر الخدمة.',
                [
                  { text: 'رجوع', style: 'cancel' },
                  {
                    text: 'تأكيد الإغلاق',
                    onPress: () =>
                      performAdminAction(
                        () => closeReport(report.id),
                        'تم إغلاق البلاغ.',
                        feedback,
                      ),
                  },
                ],
              )
            }
          />
        ) : null}
        <Text style={styles.date}>
          قفل البلاغ مش بيحذف الخدمة أو بيخفيها من الدليل.
        </Text>
      </View>
      {service ? (
        <>
          <AdminSectionTitle title="إدارة حالة النشر" icon="tune-variant" />
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerTitle}>
              {service.publicationStatus === 'published'
                ? 'إخفاء الخدمة من الدليل'
                : 'الخدمة غير منشورة حاليًا.'}
            </Text>
            <Text style={providerStyles.body}>
              إلغاء النشر بيخفي الخدمة من الدليل مع الاحتفاظ بسجل طلباتها. الحذف
              النهائي بيزيل الخدمة وطلبات إضافتها وتعديلها، والبلاغات بتفضل
              محفوظة للمراجعة.
            </Text>
            {service.publicationStatus === 'published' ? (
              <UnpublishAction id={service.id} />
            ) : null}
            <DeleteServiceAction id={service.id} />
          </View>
        </>
      ) : null}
      <Text style={styles.date}>
        راجع البلاغ وبيانات الخدمة قبل ما تختار الخطوة الجاية.
      </Text>
    </AdminPage>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    reportMeta: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      gap: 6,
    },
    status: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    date: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reason: {
      padding: 16,
      gap: 8,
      borderRadius: 16,
      backgroundColor: colors.pendingBackground,
    },
    reasonText: {
      ...typography.body,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    dangerCard: { borderColor: colors.error },
    dangerTitle: {
      ...typography.sectionTitle,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
  });
