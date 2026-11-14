import { ConfirmDetailsAction } from './ConfirmDetailsAction';
import type { ServiceCategory } from '../discovery/types';
import {
  MotionPressable as Pressable,
  MotionReveal,
} from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CategoryIcon } from '../discovery/components/DiscoveryUi';
import type { ProviderListing, ServiceRequest } from './types';
import { reviewDecisionMessage } from './useReviewDecisions';

export type PublicationStatus = 'published' | 'unpublished';
export type ReviewStatus = 'pending' | 'needs-edit';
export function servicePublicationStatus(
  listing: ProviderListing,
): PublicationStatus {
  return listing.status === 'approved' &&
    listing.publicationStatus !== 'unpublished'
    ? 'published'
    : 'unpublished';
}
export function serviceReviewStatus(
  listing: ProviderListing,
): ReviewStatus | null {
  if (listing.status === 'pending' || listing.pendingChanges) return 'pending';
  if (listing.status === 'rejected' || listing.editRejectionReason)
    return 'needs-edit';
  return null;
}

export function MyServiceCard({
  listing,
  category,
  reviewDecision,
  onAcknowledge,
}: {
  listing: ProviderListing;
  category?: ServiceCategory;
  reviewDecision?: ServiceRequest;
  onAcknowledge?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const { colors } = useAppTheme();
  const pendingChanges =
    listing.status === 'approved' && Boolean(listing.pendingChanges);
  const publication = servicePublicationStatus(listing);
  const review = serviceReviewStatus(listing);
  const unpublished = listing.publicationStatus === 'unpublished';
  const needsAction = review === 'needs-edit';
  const reviewReason = listing.editRejectionReason || listing.rejectionReason;
  const statusLabel = publication === 'published' ? 'منشورة' : 'غير منشورة';
  const reviewLabel =
    review === 'pending'
      ? pendingChanges
        ? 'تعديلات قيد المراجعة'
        : unpublished
          ? 'تصحيح قيد المراجعة'
          : 'طلب إضافة قيد المراجعة'
      : needsAction
        ? listing.editRejectionReason
          ? 'تعديلات تحتاج تعديل'
          : 'مطلوب تعديل وإعادة الإرسال'
        : null;
  const explanation = unpublished
    ? listing.status === 'pending'
      ? 'تصحيحك اتبعت للمراجعة. الخدمة هتفضل مخفية لحد الموافقة.'
      : 'الخدمة مخفية من الدليل. راجع السبب وصحّح البيانات وابعتها للمراجعة.'
    : listing.editRejectionReason
      ? `خدمتك الحالية لسه منشورة. سبب رفض التعديلات: ${listing.editRejectionReason}`
      : pendingChanges
        ? 'خدمتك الحالية لسه ظاهرة لأهل البلد، والتعديلات الجديدة هتظهر بعد الموافقة.'
        : listing.status === 'approved'
          ? 'خدمتك ظاهرة حاليًا لأهل البلد.'
          : listing.status === 'rejected'
            ? listing.rejectionReason ||
              'راجع بيانات خدمتك وعدّلها قبل ما تبعتها تاني.'
            : 'خدمتك قيد المراجعة، وهتظهر للناس بعد الموافقة عليها.';
  const editLabel = needsAction
    ? 'تعديل وإعادة الإرسال'
    : listing.status === 'approved'
      ? 'تعديل الخدمة'
      : listing.status === 'rejected'
        ? 'تعديل وإعادة الإرسال'
        : 'تعديل الطلب';
  const statusStyle =
    publication === 'published' ? styles.approved : styles.neutral;
  const statusColor =
    publication === 'published' ? colors.success : colors.muted;
  return (
    <View style={[styles.card, reviewDecision && styles.reviewHighlight]}>
      {reviewDecision ? (
        <View style={styles.reviewUpdate}>
          <Text accessibilityRole="header" style={styles.reviewUpdateTitle}>
            نتيجة مراجعة جديدة
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="عرض تفاصيل نتيجة المراجعة"
            accessibilityState={{ expanded: reviewExpanded }}
            onPress={() => setReviewExpanded(!reviewExpanded)}
          >
            <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
              {reviewDecisionMessage(reviewDecision)}
            </Text>
            <Text style={styles.reviewUpdateTitle}>
              {reviewExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
            </Text>
          </Pressable>
          {reviewExpanded ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.noticeText}>الخدمة: {listing.name}</Text>
              <Text style={styles.noticeText}>
                نوع الخدمة: {reviewDecision.proposedData.serviceTitle}
              </Text>
              <Text style={styles.noticeText}>
                {reviewDecision.reviewedAt
                  ? `تاريخ المراجعة: ${new Date(reviewDecision.reviewedAt).toLocaleDateString('ar-EG')}`
                  : 'تمت مراجعة الطلب'}
              </Text>
              <Text style={styles.noticeText}>{explanation}</Text>
              {reviewDecision.status === 'rejected' &&
              reviewDecision.rejectionReason ? (
                <Text style={styles.noticeText}>
                  سبب الرفض: {reviewDecision.rejectionReason}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`خلاص تمام — نتيجة مراجعة ${listing.name}`}
            onPress={onAcknowledge}
            style={styles.reviewAcknowledge}
          >
            <Text style={styles.reviewUpdateTitle}>خلاص تمام</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        <CategoryIcon icon={category?.icon ?? 'briefcase-outline'} />
        <View style={styles.copy}>
          <Text style={styles.title}>{listing.name}</Text>
          <Text style={styles.body}>{listing.serviceTitle}</Text>
          <MotionReveal
            changeKey={statusLabel}
            style={[styles.badge, statusStyle]}
          >
            <MaterialCommunityIcons
              name={
                publication === 'published'
                  ? 'check-circle-outline'
                  : 'eye-off-outline'
              }
              size={16}
              color={statusColor}
              accessibilityElementsHidden
            />
            <Text
              accessibilityLabel={`حالة النشر: ${statusLabel}`}
              style={[styles.badgeText, { color: statusColor }]}
            >
              {statusLabel}
            </Text>
          </MotionReveal>
          {reviewLabel ? (
            <MotionReveal
              changeKey={reviewLabel}
              style={[
                styles.badge,
                needsAction ? styles.rejected : styles.pending,
              ]}
            >
              <MaterialCommunityIcons
                name={needsAction ? 'alert-circle-outline' : 'clock-outline'}
                size={16}
                color={needsAction ? colors.error : colors.warning}
                accessibilityElementsHidden
              />
              <Text
                accessibilityLabel={`حالة الطلب: ${reviewLabel}`}
                style={[
                  styles.badgeText,
                  { color: needsAction ? colors.error : colors.warning },
                ]}
              >
                {reviewLabel}
              </Text>
            </MotionReveal>
          ) : null}
          <Text style={styles.caption}>
            {[listing.address, category?.name].filter(Boolean).join(' • ')}
          </Text>
        </View>
      </View>
      <View style={[styles.notice, needsAction && styles.rejected]}>
        <MaterialCommunityIcons
          name={
            needsAction
              ? 'message-alert-outline'
              : publication === 'published'
                ? 'eye-outline'
                : review === 'pending'
                  ? 'clock-outline'
                  : 'information-outline'
          }
          size={20}
          color={needsAction ? colors.error : colors.primaryDark}
        />
        {needsAction ? (
          <View style={styles.copy}>
            <Text style={styles.reviewHeading}>ملاحظات المراجعة</Text>
            {reviewReason ? (
              <Text style={[styles.noticeText, styles.warningText]}>
                {reviewReason}
              </Text>
            ) : null}
            <Text style={[styles.noticeText, styles.warningText]}>
              {listing.status === 'approved'
                ? 'خدمتك الحالية لسه منشورة. عدّل البيانات حسب الملاحظات وابعت التعديلات للمراجعة تاني.'
                : 'خدمتك لسه مش منشورة. عدّل البيانات حسب الملاحظات وابعت الطلب للمراجعة تاني.'}
            </Text>
          </View>
        ) : (
          <Text style={styles.noticeText}>{explanation}</Text>
        )}
      </View>
      {unpublished && listing.unpublishReason ? (
        <Text style={styles.noticeText}>
          سبب الإخفاء: {listing.unpublishReason}
        </Text>
      ) : null}
      {listing.dataSource === 'firestore' &&
      listing.publicationStatus === 'published' ? (
        <ConfirmDetailsAction listing={listing} />
      ) : null}
      {listing.status !== 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unpublished
                ? 'تصحيح وإرسال للمراجعة'
                : pendingChanges
                  ? 'عرض التعديلات'
                  : editLabel
            }
            style={[styles.action, styles.primaryAction]}
            onPress={() =>
              pendingChanges
                ? router.push({
                    pathname: '/provider/changes/[id]',
                    params: { id: listing.id },
                  })
                : router.push({
                    pathname: '/provider/edit/[id]',
                    params: { id: listing.id },
                  })
            }
          >
            <MaterialCommunityIcons
              name={
                pendingChanges
                  ? 'file-compare'
                  : needsAction
                    ? 'autorenew'
                    : 'file-document-edit-outline'
              }
              size={20}
              color={colors.onPrimary}
              accessibilityElementsHidden
            />
            <Text style={[styles.actionText, styles.primaryActionText]}>
              {unpublished
                ? 'تصحيح وإرسال للمراجعة'
                : pendingChanges
                  ? 'عرض التعديلات'
                  : editLabel}
            </Text>
          </Pressable>
          {!unpublished && listing.status === 'approved' ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.action, styles.secondaryAction]}
              onPress={() =>
                router.push({
                  pathname: '/provider/[id]',
                  params: { id: listing.id },
                })
              }
            >
              <MaterialCommunityIcons
                name="eye-outline"
                size={20}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
              <Text style={styles.actionText}>
                {pendingChanges
                  ? 'معاينة الخدمة المنشورة'
                  : 'شوف خدمتك زي ما الناس بتشوفها'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    reviewHighlight: { borderWidth: 1, borderColor: colors.primary },
    reviewUpdate: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainer,
      gap: 6,
    },
    reviewUpdateTitle: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reviewAcknowledge: {
      minHeight: 44,
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
    },
    card: {
      padding: 12,
      gap: spacing.sm,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceContainer,
    },
    warningText: { color: colors.error, flex: 0 },
    reviewHeading: {
      ...typography.label,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    primaryAction: { backgroundColor: colors.actionBackground },
    secondaryAction: { backgroundColor: colors.secondaryAction },
    primaryActionText: { color: colors.onPrimary },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 16,
      maxWidth: '100%',
    },
    badgeText: {
      flexShrink: 1,
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    approved: { backgroundColor: colors.publishedBackground },
    pending: { backgroundColor: colors.pendingBackground },
    rejected: { backgroundColor: colors.errorContainer },
    neutral: { backgroundColor: colors.surfaceContainer },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    copy: { flex: 1, minWidth: 0, gap: spacing.xs },
    title: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    caption: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
    },
    noticeText: {
      ...typography.caption,
      flex: 1,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    action: {
      flexGrow: 1,
      flexBasis: 140,
      minHeight: 48,
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
    },
    actionText: {
      ...typography.label,
      flexShrink: 1,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });
