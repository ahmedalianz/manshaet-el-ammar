import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Pressable as BackdropPressable,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedback } from '../../components/ui/Feedback';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import type { ServiceProvider } from '../discovery/types';
import { FormField } from '../provider/FormField';
import { useProviderState } from '../provider/ProviderContext';
import { ProviderAction } from '../provider/ProviderPage';
import { validateMobile } from '../provider/validation';
import { useMyProviderClaim } from './useServiceClaims';

export function ProviderClaimSection({
  provider,
}: {
  provider: ServiceProvider;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const { userId, role, initializing, account, listings, submitClaim } =
    useProviderState();
  const ownedLocally = Boolean(
    listings?.some((item) => item.id === provider.id),
  );
  const eligibleViewer = Boolean(
    userId &&
    !initializing &&
    role !== 'admin' &&
    provider.dataSource === 'firestore' &&
    provider.claimable === true &&
    !ownedLocally,
  );

  const claimState = useMyProviderClaim(
    eligibleViewer ? provider.id : undefined,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  if (!eligibleViewer) return null;

  const claim = claimState.claim;

  const openModal = () => {
    setClaimantName((account?.name ?? '').trim());
    setClaimantPhone('');
    setNote('');
    setConsent(false);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!submitLock.current) setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (submitLock.current || !submitClaim) return;
    const trimmedName = claimantName.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setFormError('اكتب اسمك الكامل، بحد أقصى ١٠٠ حرف.');
      return;
    }
    const mobileError = validateMobile(claimantPhone);
    if (mobileError) {
      setFormError(mobileError);
      return;
    }
    if (note.trim().length > 1000) {
      setFormError('التوضيح الإضافي لازم يكون ١٠٠٠ حرف أو أقل.');
      return;
    }
    if (!consent) {
      setFormError('لازم تأكّد إن الخدمة تخصّك قبل إرسال الطلب.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setFormError('');
    try {
      await submitClaim({
        providerId: provider.id,
        claimantName: trimmedName,
        claimantPhone: claimantPhone.trim(),
        note: note.trim(),
        consent: true,
      });
      setModalOpen(false);
      feedback.show(
        'تم إرسال طلبك',
        'مشرف الدليل هيراجع طلب نقل الخدمة لحسابك قريبًا.',
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'مش قادرين نبعت الطلب دلوقتي. جرّب تاني.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <View testID="provider-claim-card" style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name={
                claim?.status === 'pending'
                  ? 'clock-check-outline'
                  : 'account-switch-outline'
              }
              size={22}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {claim?.status === 'pending'
              ? 'طلب نقل الخدمة قيد المراجعة'
              : 'هل دي خدمتك؟'}
          </Text>
          {claim?.status === 'pending' ? (
            <Text style={styles.pendingBadge}>قيد المراجعة</Text>
          ) : null}
        </View>

        {claimState.loading ? (
          <Text style={styles.body}>بنتأكد من حالة حسابك…</Text>
        ) : claim?.status === 'pending' ? (
          <Text style={styles.body}>
            بعتّ طلب نقل للخدمة دي باسمك ({claim.claimantName}). مشرف الدليل
            هيراجع الطلب ويتواصل معاك على الرقم{' '}
            <Text style={styles.phoneText}>
              {'\u2066'}
              {claim.claimantPhone}
              {'\u2069'}
            </Text>{' '}
            قبل نقل الملكية لحسابك.
          </Text>
        ) : (
          <>
            <Text style={styles.body}>
              الخدمة دي مضافة بواسطة إدارة الدليل. لو هي خدمتك تقدر تطلب نقلها
              لحسابك علشان تعدّل بياناتها وتديرها بنفسك.
            </Text>
            {claim?.status === 'rejected' && claim.rejectionReason ? (
              <View style={styles.rejectedBox}>
                <Text style={styles.rejectedTitle}>سبب رفض الطلب السابق:</Text>
                <Text style={styles.rejectedReason}>
                  {claim.rejectionReason}
                </Text>
              </View>
            ) : null}
            <ProviderAction
              secondary
              title={
                claim?.status === 'rejected'
                  ? 'إعادة إرسال طلب نقل الخدمة'
                  : 'طلب نقل الخدمة لحسابي'
              }
              onPress={openModal}
            />
          </>
        )}
      </View>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.backdrop}>
          <BackdropPressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق نافذة طلب نقل الخدمة"
            onPress={closeModal}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <KeyboardAvoidingView
              enabled={Platform.OS === 'ios'}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.modalHeader}>
                  <Text accessibilityRole="header" style={styles.modalTitle}>
                    طلب نقل ملكية الخدمة
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="إلغاء"
                    onPress={closeModal}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                <View style={styles.serviceBanner}>
                  <Text style={styles.serviceBannerName}>{provider.name}</Text>
                  <Text style={styles.serviceBannerTitle}>
                    {provider.serviceTitle}
                  </Text>
                </View>

                <Text style={styles.body}>
                  اكتب بياناتك علشان مشرف الدليل يتأكد من ملكيتك للخدمة قبل ما
                  ينقلها لحسابك.
                </Text>

                <FormField
                  label="الاسم الكامل *"
                  value={claimantName}
                  onChangeText={(value) => {
                    setClaimantName(value);
                    setFormError('');
                  }}
                  placeholder="مثال: أحمد محمود"
                  maxLength={100}
                />

                <FormField
                  label="رقم الموبايل للتواصل والتأكيد *"
                  phone
                  keyboardType="phone-pad"
                  value={claimantPhone}
                  onChangeText={(value) => {
                    setClaimantPhone(value);
                    setFormError('');
                  }}
                  placeholder="01012345678"
                  maxLength={15}
                />

                <FormField
                  label="توضيح إضافي للمشرف (اختياري)"
                  value={note}
                  onChangeText={(value) => {
                    setNote(value);
                    setFormError('');
                  }}
                  placeholder="مثال: أنا صاحب المحل وده رقمي المسجل على اليافطة"
                  multiline
                  maxLength={1000}
                />

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  onPress={() => {
                    setConsent((value) => !value);
                    setFormError('');
                  }}
                  style={[styles.consentRow, consent && styles.consentChecked]}
                >
                  <MaterialCommunityIcons
                    name={
                      consent ? 'checkbox-marked' : 'checkbox-blank-outline'
                    }
                    size={24}
                    color={consent ? colors.primaryDark : colors.textSecondary}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.consentText}>
                    بأكّد إن الخدمة دي تخصّني فعليًا وموافق إن مشرف الدليل
                    يتواصل معايا للتأكد قبل نقلها لحسابي.
                  </Text>
                </Pressable>

                {formError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {formError}
                  </Text>
                ) : null}

                <View style={styles.modalActions}>
                  <ProviderAction
                    disabled={submitting}
                    title={submitting ? 'بنبعت الطلب…' : 'إرسال طلب النقل'}
                    onPress={() => void handleSubmit()}
                  />
                  <ProviderAction
                    secondary
                    disabled={submitting}
                    title="إلغاء"
                    onPress={closeModal}
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: spacing.md,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.sectionTitle,
      flex: 1,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    pendingBadge: {
      ...typography.caption,
      color: colors.warning,
      backgroundColor: colors.pendingBackground,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      writingDirection: 'rtl',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    phoneText: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'ltr',
    },
    rejectedBox: {
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      borderStartWidth: 4,
      borderStartColor: colors.error,
      gap: 4,
    },
    rejectedTitle: {
      ...typography.label,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    rejectedReason: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
    },
    modalContent: {
      padding: 20,
      gap: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    modalTitle: {
      ...typography.title,
      flex: 1,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceBanner: {
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      gap: 2,
    },
    serviceBannerName: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    serviceBannerTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    consentChecked: {
      backgroundColor: colors.surfaceContainer,
      borderColor: colors.primary,
    },
    consentText: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    modalActions: {
      gap: spacing.sm,
    },
  });
