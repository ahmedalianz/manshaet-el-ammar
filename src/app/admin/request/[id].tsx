import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ServiceOwner } from '../../../features/admin/ServiceOwner';
import { useFeedback } from '../../../components/ui/Feedback';
import {
  useReducedMotion,
  MotionPressable as Pressable,
} from '../../../components/ui/Motion';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AdminGuard,
  AdminSectionTitle,
  AdminContactButton,
  formatAdminDate,
  AdminPage,
  MissingRecord,
  ReadonlyFields,
  ServiceSummary,
  fieldLabels,
  fieldValue,
  performAdminAction,
} from '../../../features/admin/AdminUi';
import {
  ProviderAction,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import { useProviderState } from '../../../features/provider/ProviderContext';
import { changedFields } from '../../../features/provider/changedFields';
import type { ThemeColors } from '../../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { typography } from '../../../theme/typography';

export default function RequestScreen() {
  return (
    <AdminGuard>
      <RequestDetails />
    </AdminGuard>
  );
}
function RequestDetails() {
  const styles = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  const providerStyles = useProviderStyles();
  const feedback = useFeedback();
  const reducedMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requests, services, approveRequest, rejectRequest, adminBusy } =
    useProviderState();
  const request = requests.find((item) => item.id === id);
  const current = services.find((item) => item.id === request?.providerId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  if (!request)
    return (
      <AdminPage title="مراجعة الطلب">
        <MissingRecord />
      </AdminPage>
    );
  const actionable = request.status === 'pending';
  const changes =
    request.type === 'update' && current
      ? changedFields(current, request.proposedData)
      : [];
  const reject = async () => {
    if (!reason.trim()) {
      setError('اكتب سبب الرفض علشان صاحب الخدمة يقدر يصححه.');
      return;
    }
    try {
      await rejectRequest(request.id, reason.trim());
      setRejecting(false);
      setReason('');
      feedback.show('تم رفض الطلب', 'سبب الرفض متاح لصاحب الخدمة.');
      router.replace('/admin');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'مش قادرين نرفض الطلب دلوقتي. جرّب تاني.',
      );
    }
  };
  return (
    <AdminPage
      title={
        request.type === 'create'
          ? 'مراجعة خدمة جديدة'
          : 'مراجعة تعديلات الخدمة'
      }
      actions={
        actionable ? (
          <>
            <ProviderAction
              disabled={adminBusy}
              title={adminBusy ? 'بنحفظ المراجعة...' : 'الموافقة على الطلب'}
              onPress={() =>
                feedback.show(
                  'الموافقة على الطلب؟',
                  request.type === 'update'
                    ? 'التعديلات المقترحة هتحل محل بيانات الخدمة المنشورة.'
                    : 'الخدمة هتظهر في الدليل العام بعد الموافقة.',
                  [
                    { text: 'رجوع', style: 'cancel' },
                    {
                      text: 'موافقة ونشر',
                      onPress: async () => {
                        const approved = await performAdminAction(
                          () => approveRequest(request.id),
                          'تم اعتماد الطلب ونشر البيانات.',
                          feedback,
                        );
                        if (approved) router.replace('/admin');
                      },
                    },
                  ],
                )
              }
            />
            <ProviderAction
              secondary
              disabled={adminBusy}
              destructive
              title="رفض الطلب مع توضيح السبب"
              onPress={() => {
                setError('');
                setRejecting(true);
              }}
            />
          </>
        ) : undefined
      }
    >
      <View style={styles.reviewHero}>
        <ServiceSummary values={request.proposedData} />
        <Text style={styles.requestBadge}>
          {request.type === 'restore'
            ? 'تصحيح خدمة مخفية وطلب استرجاعها'
            : request.type === 'update'
              ? 'طلب تعديل بيانات'
              : 'طلب إضافة جديدة'}
        </Text>
        <Text style={styles.heroNotice}>
          راجع بيانات التواصل والعنوان قبل نشر الخدمة لأهالي البلد.
        </Text>
      </View>
      {request.type === 'restore' && current?.unpublishReason ? (
        <Text style={providerStyles.notice}>
          سبب الإخفاء: {current.unpublishReason}
        </Text>
      ) : null}
      <ServiceOwner ownerId={request.ownerId} />
      <Text style={[providerStyles.body, { color: colors.muted }]}>
        تاريخ الإرسال: {formatAdminDate(request.createdAt)}
      </Text>
      <Text style={providerStyles.label}>
        {request.status === 'pending'
          ? 'قيد المراجعة'
          : request.status === 'approved'
            ? 'تمت الموافقة'
            : 'تم رفض الطلب'}
      </Text>
      {request.rejectionReason ? (
        <Text style={providerStyles.notice}>{request.rejectionReason}</Text>
      ) : null}
      {request.type === 'create' || request.type === 'restore' ? (
        <ReadonlyFields values={request.proposedData} />
      ) : current ? (
        <>
          {current.publicationStatus === 'published' ? (
            <Text style={providerStyles.notice}>
              البيانات الحالية هتفضل منشورة لحد الموافقة على التعديلات.
            </Text>
          ) : null}
          <AdminSectionTitle
            title="التغييرات المقترحة فقط"
            icon="file-document-edit-outline"
            aside={`${changes.length} تغييرات`}
          />
          {changes.length ? (
            changes.map((field) => (
              <View key={field} style={styles.comparisonCard}>
                <View style={styles.comparisonHeading}>
                  <MaterialCommunityIcons
                    name={
                      field === 'phone' || field === 'whatsapp'
                        ? 'cellphone'
                        : field === 'address'
                          ? 'map-marker-outline'
                          : 'pencil-outline'
                    }
                    size={24}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.fieldTitle}>{fieldLabels[field]}</Text>
                  <Text style={styles.requestBadge}>مُعدّل</Text>
                </View>
                <View style={styles.currentValue}>
                  <Text style={styles.smallLabel}>البيانات الحالية</Text>
                  <Text
                    selectable
                    style={[
                      styles.oldValue,
                      (field === 'phone' || field === 'whatsapp') &&
                        styles.phone,
                    ]}
                  >
                    {fieldValue(current, field)}
                  </Text>
                  {field === 'phone' || field === 'whatsapp' ? (
                    <AdminContactButton
                      secondary
                      phone={current[field]}
                      title="تجربة اتصال بالرقم الحالي"
                    />
                  ) : null}
                </View>
                <View style={styles.proposedValue}>
                  <Text style={styles.proposedLabel}>البيانات المقترحة</Text>
                  <Text
                    selectable
                    style={[
                      styles.newValue,
                      (field === 'phone' || field === 'whatsapp') &&
                        styles.phone,
                    ]}
                  >
                    {fieldValue(request.proposedData, field)}
                  </Text>
                  {field === 'phone' || field === 'whatsapp' ? (
                    <AdminContactButton
                      phone={request.proposedData[field]}
                      title="تجربة اتصال بالرقم الجديد"
                    />
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={providerStyles.notice}>
              مفيش اختلافات بين البيانات الحالية والمقترحة.
            </Text>
          )}
          <View style={styles.comparisonCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showUnchanged }}
              onPress={() => setShowUnchanged((value) => !value)}
              style={styles.comparisonHeading}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={22}
                color={colors.muted}
              />
              <Text style={styles.unchangedLabel}>
                عرض باقي بيانات الخدمة الأساسية (غير معدلة)
              </Text>
              <MaterialCommunityIcons
                name={showUnchanged ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.muted}
              />
            </Pressable>
            {showUnchanged ? (
              <ReadonlyFields
                values={current}
                fields={(
                  Object.keys(fieldLabels) as (keyof typeof fieldLabels)[]
                ).filter((field) => !changes.includes(field))}
              />
            ) : null}
          </View>
          {current.publicationStatus === 'unpublished' ? (
            <Text style={providerStyles.notice}>
              الخدمة غير منشورة حاليًا، ومينفعش الموافقة على تعديلها وهي غير
              منشورة.
            </Text>
          ) : null}
        </>
      ) : (
        <MissingRecord text="الخدمة الأصلية مش متاحة، فمش هنقدر نعرض المقارنة." />
      )}
      <Text style={providerStyles.notice}>
        البيانات المعتمدة هتظهر في الدليل العام بعد الموافقة.
      </Text>
      <Modal
        visible={rejecting}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={() => setRejecting(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          // Android's native Modal already uses adjustResize. A second height
          // adjustment can create a layout feedback loop as the IME changes size.
          enabled={Platform.OS === 'ios'}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            accessibilityViewIsModal
            style={styles.modalCard}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={providerStyles.heading}>سبب رفض الطلب</Text>
            <Text style={providerStyles.body}>
              اكتب ملاحظة واضحة تساعد صاحب الخدمة يعدّل طلبه.
            </Text>
            <TextInput
              keyboardAppearance={resolved}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              accessibilityLabel="سبب الرفض"
              value={reason}
              onChangeText={(value) => {
                setReason(value);
                setError('');
              }}
              placeholder="مثال: راجع رقم الموبايل واكتبه صح"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              style={styles.reason}
            />
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <ProviderAction
              disabled={adminBusy}
              title={adminBusy ? 'بنحفظ المراجعة...' : 'تأكيد رفض الطلب'}
              onPress={reject}
            />
            <ProviderAction
              secondary
              title="رجوع"
              onPress={() => setRejecting(false)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </AdminPage>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    phone: { writingDirection: 'ltr', textAlign: 'left' },
    reviewHero: {
      padding: 20,
      borderRadius: 22,
      backgroundColor: colors.surface,
      gap: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    requestBadge: {
      ...typography.caption,
      color: colors.primaryDark,
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 18,
      alignSelf: 'flex-start',
      writingDirection: 'rtl',
    },
    heroNotice: {
      ...typography.body,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceLow,
      padding: 14,
      borderRadius: 16,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    comparisonCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 16,
      gap: 14,
    },
    comparisonHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      minHeight: 44,
    },
    fieldTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      flex: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    currentValue: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      gap: 8,
    },
    proposedValue: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    oldValue: {
      ...typography.body,
      color: colors.muted,
      textDecorationLine: 'line-through',
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    newValue: {
      ...typography.title,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    proposedLabel: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    unchangedLabel: {
      ...typography.label,
      color: colors.textSecondary,
      flex: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    smallLabel: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    modalBackdrop: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      backgroundColor: colors.overlay,
    },
    modalCard: {
      flexGrow: 0,
      maxHeight: '100%',
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    modalContent: { padding: 20, gap: 16 },
    reason: {
      ...typography.body,
      height: 100,
      textAlign: 'auto',
      writingDirection: 'rtl',
      textAlignVertical: 'top',
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      color: colors.textPrimary,
    },
    error: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
    },
  });
