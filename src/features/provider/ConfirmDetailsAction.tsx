import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedback } from '../../components/ui/Feedback';
import { MotionPressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { fontFamily, typography } from '../../theme/typography';
import { AvailabilityDetails } from '../availability/AvailabilityDetails';
import { ProviderAction } from './ProviderPage';
import { useProviderState } from './ProviderContext';
import { fetchProvider } from './firebaseRepository';
import { db } from '../../lib/firebase/firestore';
import { serviceConfirmationDue } from './confirmation';
import type { ProviderListing } from './types';
import type { ServiceProvider } from '../discovery/types';

export function ConfirmDetailsAction({
  listing,
}: {
  listing: ProviderListing;
}) {
  const feedback = useFeedback();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { confirmDetails } = useProviderState();
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<ServiceProvider | null>(null);
  const lock = useRef(false);
  const review = async () => {
    if (lock.current || !db) return;
    lock.current = true;
    setBusy(true);
    try {
      const current = await fetchProvider(db, listing.id);
      if (!current || current.cachedAt || !current.updatedAt)
        throw new Error('اتصل بالإنترنت وحدّث بيانات الخدمة قبل التأكيد.');
      setReviewed(current);
    } catch (error) {
      feedback.show(
        'مش قادرين نعرض البيانات',
        error instanceof Error ? error.message : 'جرّب تاني.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (lock.current || !reviewed?.updatedAt) return;
    lock.current = true;
    setBusy(true);
    try {
      await confirmDetails(reviewed.id, reviewed.updatedAt);
      setReviewed(null);
      feedback.show('تم التأكيد', 'تاريخ تأكيد بيانات خدمتك اتحدّث.');
    } catch (error) {
      feedback.show(
        'مش قادرين نأكد البيانات',
        error instanceof Error ? error.message : 'جرّب تاني.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (!lock.current) setReviewed(null);
  };
  const rows = reviewed
    ? [
        {
          icon: 'storefront-outline' as const,
          label: 'اسم مقدم الخدمة',
          value: reviewed.name,
        },
        {
          icon: 'briefcase-outline' as const,
          label: 'الخدمة',
          value: reviewed.serviceTitle,
        },
        {
          icon: 'phone-outline' as const,
          label: 'رقم التواصل',
          value: reviewed.phone,
          phone: true,
        },
        {
          icon: 'whatsapp' as const,
          label: 'واتساب',
          value: reviewed.whatsapp,
          phone: true,
        },
        {
          icon: 'map-marker-outline' as const,
          label: 'العنوان',
          value: reviewed.address,
        },
      ]
    : [];
  return (
    <View style={{ gap: 8 }}>
      {serviceConfirmationDue(listing) ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="راجع وأكّد بيانات خدمتك"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => void review()}
          style={styles.confirmReminder}
        >
          <View
            style={styles.reminderIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={20}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={styles.reminderTitle}>
              {busy ? 'بنحمّل البيانات…' : 'تحتاج تأكيد البيانات'}
            </Text>
            <Text style={styles.reminderBody}>
              راجع بيانات خدمتك واتأكد من صحتها.
            </Text>
          </View>
          <View style={styles.reminderChevron}>
            <MaterialCommunityIcons
              name="chevron-left"
              size={20}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
          </View>
        </MotionPressable>
      ) : (
        <View style={styles.confirmedMeta}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={16}
            color={colors.muted}
            accessibilityElementsHidden
          />
          <Text style={styles.confirmedMetaText}>
            {listing.lastConfirmedAt
              ? `آخر تأكيد منك: ${new Date(listing.lastConfirmedAt).toLocaleDateString('ar-EG')}`
              : `آخر تحديث منشور: ${new Date(listing.updatedAt!).toLocaleDateString('ar-EG')}`}
          </Text>
        </View>
      )}
      <Modal
        visible={Boolean(reviewed)}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق مراجعة البيانات"
            disabled={busy}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.headingRow}>
                <View style={styles.heroIcon}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={30}
                    color={colors.onPrimary}
                    accessibilityElementsHidden
                  />
                </View>
                <View style={styles.headingCopy}>
                  <Text style={styles.eyebrow}>تأكيد بيانات خدمتك</Text>
                  <Text accessibilityRole="header" style={styles.title}>
                    البيانات دي لسه صحيحة؟
                  </Text>
                </View>
              </View>
              <Text style={styles.body}>
                راجع بيانات التواصل والخدمة، عشان أهالي البلد يقدروا يوصلوا لك
                بسهولة.
              </Text>
              <View style={styles.details}>
                {rows
                  .filter((row) => Boolean(row.value))
                  .map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <MaterialCommunityIcons
                          name={row.icon}
                          size={21}
                          color={colors.primaryDark}
                          accessibilityElementsHidden
                        />
                      </View>
                      <View style={styles.headingCopy}>
                        <Text style={styles.label}>{row.label}</Text>
                        {row.phone ? (
                          <View style={styles.phoneContainer}>
                            <Text style={[styles.value, styles.phone]}>
                              {row.value}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.value}>{row.value}</Text>
                        )}
                      </View>
                    </View>
                  ))}
              </View>
              {reviewed ? <AvailabilityDetails value={reviewed} /> : null}
              <View style={styles.reassurance}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={20}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
                <Text style={[styles.body, styles.headingCopy]}>
                  التأكيد بيحدّث تاريخ مراجعتك للبيانات. لو في معلومة اتغيّرت،
                  ارجع وعدّل الخدمة الأول.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <MotionPressable
                accessibilityLabel={
                  busy ? 'بنأكد البيانات…' : 'أيوه، البيانات لسه صحيحة'
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void confirm()}
                style={[styles.confirmButton, busy && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={23}
                  color={colors.onPrimary}
                  accessibilityElementsHidden
                />
                <Text style={styles.confirmText}>
                  {busy ? 'بنأكد البيانات…' : 'أيوه، البيانات لسه صحيحة'}
                </Text>
              </MotionPressable>
              <ProviderAction
                title="رجوع"
                secondary
                disabled={busy}
                onPress={close}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    confirmReminder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 68,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reminderIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.categoryBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderCopy: { flex: 1, minWidth: 0, gap: 2 },
    reminderTitle: {
      fontFamily: fontFamily.semibold,
      fontSize: 15,
      lineHeight: 24,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reminderBody: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reminderChevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmedMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    confirmedMetaText: {
      ...typography.caption,
      flex: 1,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    content: { padding: 20, gap: 18 },
    headingRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    headingCopy: { flex: 1 },
    eyebrow: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },
    details: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceLow,
      paddingHorizontal: 16,
    },
    detailRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      paddingVertical: 14,
    },
    detailIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainer,
    },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },
    value: {
      ...typography.body,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    phoneContainer: { direction: 'ltr', alignItems: 'flex-end' },
    phone: { writingDirection: 'ltr', maxWidth: '100%' },
    reassurance: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
    },
    actions: {
      padding: 20,
      paddingTop: 12,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    confirmButton: {
      minHeight: 58,
      padding: 16,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
    },
    confirmText: {
      ...typography.button,
      color: colors.onPrimary,
      flexShrink: 1,
      writingDirection: 'rtl',
    },
  });
