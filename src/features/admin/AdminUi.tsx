import { formatAvailabilityField } from '../availability/format';
import { LoadingState } from '../../components/ui/LoadingState';
import { useFeedback, type FeedbackApi } from '../../components/ui/Feedback';
import { router } from 'expo-router';
import { returnToRoute } from '../navigation/returnToRoute';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { contactUrl, launchContactUrl } from '../discovery/contact';
import {
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BackHeader,
  CategoryIcon,
  EmptyState,
} from '../discovery/components/DiscoveryUi';
import { categories } from '../discovery/data/categories';
import { FormField } from '../provider/FormField';
import { ProviderAction, useProviderStyles } from '../provider/ProviderPage';
import { useProviderState } from '../provider/ProviderContext';
import type { PublishedService, ServiceValues } from '../provider/types';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export function AdminGuard({ children }: { children: ReactNode }) {
  const providerStyles = useProviderStyles();
  const { role, initializing, adminLoading, adminError, refresh } =
    useProviderState();
  if (initializing || (role === 'admin' && adminLoading))
    return (
      <AdminPage title="إدارة الخدمات" scroll={false}>
        <LoadingState label="بنحمّل طلبات المراجعة…" />
      </AdminPage>
    );
  if (role !== 'admin')
    return (
      <AdminPage title="إدارة الخدمات">
        <Text style={providerStyles.notice}>
          الصفحة دي متاحة للمشرف فقط. مفيش صلاحيات إدارة للحساب الحالي.
        </Text>
      </AdminPage>
    );
  if (adminError)
    return (
      <AdminPage title="إدارة الخدمات">
        <Text accessibilityRole="alert" style={providerStyles.notice}>
          {adminError}
        </Text>
        <ProviderAction title="جرّب تاني" onPress={refresh} />
      </AdminPage>
    );
  return children;
}
export function AdminPage({
  title,
  children,
  actions,
  scroll = true,
  badge,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  scroll?: boolean;
  badge?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const providerStyles = useProviderStyles();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <BackHeader title={title} />
        </View>
        {badge ? (
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={18}
              color={styles.badgeText.color}
            />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={providerStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </SafeAreaView>
  );
}
export const fieldLabels: Record<keyof ServiceValues, string> = {
  name: 'الاسم المعروض',
  categoryId: 'نوع الخدمة',
  serviceTitle: 'تخصص الخدمة',
  description: 'نبذة عن الخدمة',
  phone: 'رقم التواصل',
  whatsapp: 'رقم واتساب',

  address: 'العنوان',
  serviceMode: 'طريقة تقديم الخدمة',
  weeklyHours: 'مواعيد العمل',
  photoChange: 'صورة المكان',
};
export function fieldValue(values: ServiceValues, field: keyof ServiceValues) {
  if (field === 'photoChange')
    return values.photoChange?.action === 'replace'
      ? 'صورة جديدة للمراجعة'
      : values.photoChange?.action === 'remove'
        ? 'طلب إزالة الصورة'
        : (values as { placePhoto?: unknown }).placePhoto
          ? 'صورة منشورة حاليًا'
          : 'بدون تغيير';
  if (field === 'serviceMode' || field === 'weeklyHours')
    return formatAvailabilityField(field, values);
  if (field === 'categoryId')
    return (
      categories.find((category) => category.id === values.categoryId)?.name ??
      'قسم غير متاح'
    );
  return String(values[field] || 'غير مضاف');
}
export function ServiceSummary({
  values,
  showAddress = true,
}: {
  values: ServiceValues;
  showAddress?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const providerStyles = useProviderStyles();
  const category = categories.find((item) => item.id === values.categoryId);
  return (
    <View style={styles.summary}>
      <CategoryIcon icon={category?.icon ?? 'briefcase-outline'} />
      <View style={styles.copy}>
        <Text style={styles.summaryTitle}>{values.name}</Text>
        <Text style={providerStyles.body}>{values.serviceTitle}</Text>
        {showAddress ? (
          <Text style={providerStyles.body}>
            {[values.address].filter((value) => value?.trim()).join(' — ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
export function ReadonlyFields({
  values,
  fields = Object.keys(fieldLabels) as (keyof ServiceValues)[],
}: {
  values: ServiceValues;
  fields?: (keyof ServiceValues)[];
}) {
  const styles = useThemedStyles(createStyles);
  const providerStyles = useProviderStyles();
  return (
    <View style={providerStyles.card}>
      {fields.map((field) => (
        <View key={field} style={styles.field}>
          <Text style={providerStyles.label}>{fieldLabels[field]}</Text>
          <Text
            selectable
            style={[
              providerStyles.body,
              (field === 'phone' || field === 'whatsapp') && styles.phone,
            ]}
          >
            {fieldValue(values, field)}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function AdminSectionTitle({
  title,
  icon,
  aside,
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  aside?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeading}>
      <MaterialCommunityIcons
        name={icon}
        size={23}
        color={colors.primaryDark}
        accessibilityElementsHidden
      />
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {aside ? <Text style={styles.badgeText}>{aside}</Text> : null}
    </View>
  );
}
export function AdminContactButton({
  phone,
  title = 'تجربة اتصال',
  secondary = false,
}: {
  phone?: string;
  title?: string;
  secondary?: boolean;
}) {
  const feedback = useFeedback();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const url = contactUrl(phone ?? '', 'call');
  return (
    <ProviderAction
      title={title}
      secondary={secondary}
      disabled={!url || busy}
      onPress={async () => {
        if (!url || lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
          const result = await launchContactUrl(url, Linking);
          if (!result.ok)
            feedback.show(
              'مش قادرين نتواصل دلوقتي',
              result.message ?? 'جرّب تنسخ الرقم وتتواصل بنفسك.',
            );
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    />
  );
}
export function AdminServiceCard({ service }: { service: PublishedService }) {
  const styles = useThemedStyles(createStyles);
  const published = service.publicationStatus === 'published';
  return (
    <View style={styles.serviceCard}>
      <ServiceSummary values={service} showAddress={false} />
      <View style={styles.serviceDetails}>
        <View style={styles.detailCell}>
          <Text style={styles.badgeText}>رقم التواصل</Text>
          <Text selectable style={styles.detailPhone}>
            {service.phone}
          </Text>
        </View>
        <View style={styles.detailCell}>
          <Text style={styles.badgeText}>العنوان</Text>
          <Text style={styles.detailValue}>
            {[service.address].filter(Boolean).join('، ')}
          </Text>
        </View>
      </View>
      {published ? (
        <ProviderAction
          secondary
          title="معاينة الخدمة في الدليل"
          onPress={() =>
            router.push({
              pathname: '/provider/[id]',
              params: { id: service.id },
            })
          }
        />
      ) : null}
    </View>
  );
}
export function MissingRecord({
  text = 'البيانات دي مش موجودة أو مبقتش متاحة.',
}: {
  text?: string;
}) {
  return (
    <EmptyState
      title="العنصر غير متاح"
      message={text}
      actionLabel="العودة لإدارة الخدمات"
      onAction={() => returnToRoute('/admin')}
    />
  );
}
export async function performAdminAction(
  action: () => void | Promise<void>,
  success: string,
  feedback: FeedbackApi,
): Promise<boolean> {
  try {
    await action();
    feedback.show('تم', success);
    return true;
  } catch (error) {
    feedback.show(
      'مش قادرين نكمّل الخطوة دي',
      error instanceof Error ? error.message : 'حصل خطأ. جرّب تاني.',
    );
    return false;
  }
}
export function UnpublishAction({ id }: { id: string }) {
  const feedback = useFeedback();
  const { unpublishService, adminBusy } = useProviderState();
  const s = useProviderStyles();
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const close = () => {
    if (!lock.current) setOpen(false);
  };
  const submit = async () => {
    if (lock.current || adminBusy) return;
    if (!reason.trim() || reason.trim().length > 1000) {
      setError('اكتب سبب واضح يساعد صاحب الخدمة يصحّح بياناته.');
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      const done = await performAdminAction(
        () => unpublishService(id, reason.trim()),
        'تم إخفاء الخدمة وحفظها في الأرشيف.',
        feedback,
      );
      if (done) {
        setOpen(false);
        setReason('');
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <ProviderAction
        secondary
        disabled={adminBusy}
        destructive
        title="إلغاء نشر الخدمة"
        onPress={() => {
          setError('');
          setOpen(true);
        }}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                gap: 16,
                flexGrow: 1,
                justifyContent: 'center',
              }}
            >
              <Text accessibilityRole="header" style={s.heading}>
                ليه هنخفي الخدمة؟
              </Text>
              <Text style={s.body}>
                الخدمة هتختفي من الدليل وتتحفظ في الأرشيف. صاحبها هيشوف السبب
                ويقدر يصحّح البيانات ويبعتها للمراجعة. أي تعديلات مستنية
                المراجعة هتترفض بنفس السبب.
              </Text>
              <FormField
                label="سبب إخفاء الخدمة"
                value={reason}
                onChangeText={(value) => {
                  setReason(value);
                  setError('');
                }}
                error={error}
                multiline
                maxLength={1000}
                editable={!saving}
              />
              <ProviderAction
                destructive
                title={saving ? 'بنحفظ السبب...' : 'تأكيد إخفاء الخدمة'}
                disabled={saving || adminBusy}
                onPress={() => void submit()}
              />
              <ProviderAction
                secondary
                title="رجوع"
                disabled={saving}
                onPress={close}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
export function RestoreAction({ id }: { id: string }) {
  const feedback = useFeedback();
  const { restoreService, adminBusy } = useProviderState();
  const { pendingRequests } = useProviderState();
  const correction = pendingRequests?.find(
    (request) => request.providerId === id && request.type === 'restore',
  );
  if (correction)
    return (
      <ProviderAction
        title="مراجعة التصحيح المرسل"
        onPress={() =>
          router.push({
            pathname: '/admin/request/[id]',
            params: { id: correction.id },
          })
        }
      />
    );
  return (
    <ProviderAction
      title="استرجاع الخدمة للدليل"
      disabled={adminBusy}
      onPress={() =>
        feedback.show(
          'نرجّع الخدمة للدليل؟',
          'اتأكد إن سبب الإخفاء اتحل. هننشر آخر بيانات كانت موجودة، من غير أي تعديلات مستنية المراجعة.',
          [
            { text: 'رجوع', style: 'cancel' },
            {
              text: 'استرجاع ونشر',
              onPress: () =>
                performAdminAction(
                  () => restoreService(id),
                  'الخدمة رجعت للدليل.',
                  feedback,
                ),
            },
          ],
        )
      }
    />
  );
}
export function DeleteServiceAction({
  id,
  onDeleted,
  label = 'حذف الخدمة نهائيًا',
}: {
  id: string;
  onDeleted?: () => void;
  label?: string;
}) {
  const feedback = useFeedback();
  const { deleteService, adminBusy } = useProviderState();
  return (
    <ProviderAction
      secondary
      disabled={adminBusy}
      destructive
      title={label}
      onPress={() =>
        feedback.show(
          'حذف الخدمة نهائيًا؟',
          'هيتم حذف الخدمة وطلبات إضافتها وتعديلها من التطبيق، ومش هتقدر ترجعها. إلغاء النشر بيخفي الخدمة مع الاحتفاظ بسجل الطلبات. البلاغات بتفضل محفوظة للمراجعة.',
          [
            { text: 'رجوع', style: 'cancel' },
            {
              text: 'حذف نهائي',
              style: 'destructive',
              onPress: async () => {
                if (
                  await performAdminAction(
                    () => deleteService(id),
                    'تم حذف الخدمة نهائيًا.',
                    feedback,
                  )
                ) {
                  if (onDeleted) onDeleted();
                  else returnToRoute('/admin');
                }
              },
            },
          ],
        )
      }
    />
  );
}
export function useAdminStyles() {
  const providerStyles = useProviderStyles();
  const { colors } = useAppTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        card: {
          ...providerStyles.card,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        badge: {
          ...typography.caption,
          color: colors.primaryDark,
          backgroundColor: colors.surfaceContainer,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 12,
          alignSelf: 'flex-start',
          writingDirection: 'rtl',
        },
        heading: {
          ...typography.sectionTitle,
          color: colors.primaryDark,
          writingDirection: 'rtl',
        },
      }),
    [providerStyles, colors],
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.header,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginEnd: 16,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainer,
      maxWidth: '35%',
      flexShrink: 1,
    },
    badgeText: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      flex: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    serviceCard: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 18,
    },
    serviceDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    detailCell: {
      flex: 1,
      minWidth: 135,
      padding: 12,
      gap: 5,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
    },
    detailPhone: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'ltr',
    },
    detailValue: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    actions: {
      padding: 16,
      gap: 10,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    summary: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    summaryTitle: {
      ...typography.sectionTitle,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    copy: { flex: 1, gap: 4, minWidth: 0 },
    field: {
      gap: 6,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    phone: { writingDirection: 'ltr', textAlign: 'left' },
  });

export function formatAdminDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'تاريخ غير متاح'
    : date.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Cairo',
      });
}
