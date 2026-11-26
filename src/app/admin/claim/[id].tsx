import { router, useLocalSearchParams } from 'expo-router';
import { returnToRoute } from '../../../features/navigation/returnToRoute';
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
import { useFeedback } from '../../../components/ui/Feedback';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useReducedMotion } from '../../../components/ui/Motion';
import {
  AdminContactButton,
  AdminGuard,
  AdminPage,
  AdminSectionTitle,
  AdminServiceCard,
  MissingRecord,
  formatAdminDate,
  performAdminAction,
} from '../../../features/admin/AdminUi';
import { ServiceOwner } from '../../../features/admin/ServiceOwner';
import { useAdminClaimDetails } from '../../../features/claims/useServiceClaims';
import { useProviderState } from '../../../features/provider/ProviderContext';
import {
  ProviderAction,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import type { ThemeColors } from '../../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { typography } from '../../../theme/typography';

export default function AdminClaimScreen() {
  return (
    <AdminGuard>
      <ClaimReviewDetails />
    </AdminGuard>
  );
}

function ClaimReviewDetails() {
  const styles = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  const providerStyles = useProviderStyles();
  const feedback = useFeedback();
  const reducedMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adminBusy, approveClaim, rejectClaim } = useProviderState();
  const { claim, service, loading, error, retry } =
    useAdminClaimDetails(id);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  if (loading) {
    return (
      <AdminPage title="مراجعة طلب نقل الملكية" scroll={false}>
        <LoadingState label="بنحمّل تفاصيل الطلب…" />
      </AdminPage>
    );
  }

  if (error) {
    return (
      <AdminPage title="مراجعة طلب نقل الملكية">
        <Text accessibilityRole="alert" style={providerStyles.notice}>
          {error}
        </Text>
        <ProviderAction title="جرّب تاني" onPress={retry} />
      </AdminPage>
    );
  }

  if (!claim) {
    return (
      <AdminPage title="مراجعة طلب نقل الملكية">
        <MissingRecord />
      </AdminPage>
    );
  }

  const actionable = claim.status === 'pending';

  const submitReject = async () => {
    if (!rejectClaim) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('اكتب سبب الرفض علشان مقدم الطلب يفهم السبب.');
      return;
    }
    try {
      await rejectClaim(claim.id, trimmed);
      setRejecting(false);
      setReason('');
      feedback.show(
        'تم رفض الطلب',
        'تم حفظ سبب رفض طلب نقل الملكية وإبلاغ مقدم الطلب.',
      );
      returnToRoute('/admin');
    } catch (failure) {
      setReasonError(
        failure instanceof Error
          ? failure.message
          : 'مش قادرين نرفض الطلب دلوقتي. جرّب تاني.',
      );
    }
  };

  return (
    <AdminPage
      title="مراجعة طلب نقل الملكية"
      actions={
        actionable && approveClaim && rejectClaim ? (
          <>
            <ProviderAction
              disabled={Boolean(adminBusy)}
              title={
                adminBusy ? 'بننفّذ النقل…' : 'الموافقة ونقل الملكية لحسابه'
              }
              onPress={() =>
                feedback.show(
                  'نقل ملكية الخدمة؟',
                  `الخدمة هتتنقل لإدارة ${claim.claimantName} ومش هتبقى تابعة لحساب المشرف.`,
                  [
                    { text: 'رجوع', style: 'cancel' },
                    {
                      text: 'موافقة ونقل الملكية',
                      onPress: async () => {
                        const done = await performAdminAction(
                          () => approveClaim(claim.id),
                          'تم نقل ملكية الخدمة لحساب مقدم الطلب.',
                          feedback,
                        );
                        if (done) returnToRoute('/admin');
                      },
                    },
                  ],
                )
              }
            />
            <ProviderAction
              secondary
              destructive
              disabled={Boolean(adminBusy)}
              title="رفض الطلب مع توضيح السبب"
              onPress={() => {
                setReasonError('');
                setRejecting(true);
              }}
            />
          </>
        ) : undefined
      }
    >
      {service ? (
        <AdminServiceCard service={service} />
      ) : (
        <View style={providerStyles.card}>
          <Text style={providerStyles.heading}>{claim.serviceName}</Text>
          <Text style={providerStyles.body}>{claim.serviceTitle}</Text>
          <ProviderAction
            secondary
            title="معاينة الخدمة في الدليل"
            onPress={() =>
              router.push({
                pathname: '/provider/[id]',
                params: { id: claim.providerId },
              })
            }
          />
        </View>
      )}

      <AdminSectionTitle
        title="بيانات مقدم طلب النقل"
        icon="account-switch-outline"
        aside={
          claim.status === 'pending'
            ? 'قيد المراجعة'
            : claim.status === 'approved'
              ? 'تم النقل'
              : 'مرفوض'
        }
      />

      <ServiceOwner ownerId={claim.claimantId} />

      <View style={providerStyles.card}>
        <Text style={providerStyles.label}>الاسم المرسل في الطلب</Text>
        <Text selectable style={providerStyles.body}>
          {claim.claimantName}
        </Text>

        <Text style={providerStyles.label}>رقم موبايل مقدم الطلب</Text>
        <Text selectable style={[providerStyles.body, styles.phone]}>
          {claim.claimantPhone}
        </Text>
        <AdminContactButton
          phone={claim.claimantPhone}
          title="اتصال بمقدم الطلب للتأكد"
        />

        {service?.phone ? (
          <>
            <Text style={providerStyles.label}>رقم الخدمة المنشور حاليًا</Text>
            <Text selectable style={[providerStyles.body, styles.phone]}>
              {service.phone}
            </Text>
            <AdminContactButton
              secondary
              phone={service.phone}
              title="اتصال برقم الخدمة المنشور"
            />
          </>
        ) : null}

        {claim.note ? (
          <>
            <Text style={providerStyles.label}>توضيح مقدم الطلب</Text>
            <Text selectable style={providerStyles.body}>
              {claim.note}
            </Text>
          </>
        ) : null}

        <Text style={[providerStyles.body, { color: colors.muted }]}>
          تاريخ إرسال الطلب: {formatAdminDate(claim.createdAt)}
        </Text>
      </View>

      {claim.rejectionReason ? (
        <Text style={providerStyles.notice}>
          سبب الرفض: {claim.rejectionReason}
        </Text>
      ) : null}

      <Modal
        visible={rejecting}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={() => setRejecting(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
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
            <Text style={providerStyles.heading}>سبب رفض طلب النقل</Text>
            <Text style={providerStyles.body}>
              اكتب سبب واضح يوضح لمقدم الطلب ليه تم الرفض.
            </Text>
            <TextInput
              keyboardAppearance={resolved}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              accessibilityLabel="سبب رفض طلب النقل"
              value={reason}
              onChangeText={(value) => {
                setReason(value);
                setReasonError('');
              }}
              placeholder="مثال: تعذّر التأكد من الرقم، اكتب رقمك المسجل في الخدمة"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              style={styles.reason}
            />
            {reasonError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {reasonError}
              </Text>
            ) : null}
            <ProviderAction
              disabled={Boolean(adminBusy)}
              title={adminBusy ? 'بنحفظ المراجعة…' : 'تأكيد رفض الطلب'}
              onPress={() => void submitReject()}
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
