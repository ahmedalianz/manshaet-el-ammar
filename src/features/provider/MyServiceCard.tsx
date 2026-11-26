import { ApprovedPhoto } from '../photos/ApprovedPhoto';
import { PrivatePhotoPreview } from '../photos/PrivatePhotoPreview';
import { categoryImages } from '../discovery/data/categoryImages';
import { ServiceStatusArtwork } from '../../components/brand/ServiceStatusArtwork';
import { ConfirmDetailsAction } from './ConfirmDetailsAction';
import type { ServiceCategory } from '../discovery/types';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { fontFamily, typography } from '../../theme/typography';
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
  const { colors, resolved } = useAppTheme();
  const dark = resolved === 'dark';
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
  const statusDescription = needsAction
    ? listing.status === 'approved'
      ? 'خدمتك الحالية لسه منشورة. راجع الملاحظات وعدّل البيانات وابعت التعديلات للمراجعة.'
      : 'راجع الملاحظات وعدّل البيانات، ثم أعد إرسال الطلب للمراجعة.'
    : review === 'pending'
      ? pendingChanges
        ? 'خدمتك الحالية لسه ظاهرة لأهل البلد، والتعديلات الجديدة هتظهر بعد الموافقة.'
        : unpublished
          ? 'تصحيحك اتبعت للمراجعة. الخدمة هتفضل مخفية لحد الموافقة.'
          : 'بنراجع بيانات خدمتك قبل نشرها في الدليل، وهتظهر لأهل البلد بعد الموافقة عليها.'
      : explanation;
  const statusVariant = needsAction
    ? 'needs-edit'
    : review === 'pending'
      ? 'pending'
      : publication === 'published'
        ? 'published'
        : 'unpublished';
  const statusTheme = {
    published: {
      backgroundColor: colors.publishedBackground,
      borderColor: dark ? 'rgba(131,221,186,0.22)' : 'rgba(0,81,68,0.14)',
      titleColor: colors.success,
    },
    pending: {
      backgroundColor: colors.pendingBackground,
      borderColor: dark ? 'rgba(232,200,137,0.24)' : 'rgba(109,75,22,0.16)',
      titleColor: colors.warning,
    },
    'needs-edit': {
      backgroundColor: colors.errorContainer,
      borderColor: dark ? 'rgba(255,180,171,0.26)' : 'rgba(186,26,26,0.16)',
      titleColor: colors.error,
    },
    unpublished: {
      backgroundColor: colors.surfaceContainer,
      borderColor: colors.border,
      titleColor: colors.textPrimary,
    },
  }[statusVariant];
  const metadataLine = [listing.address, category?.name]
    .filter(Boolean)
    .join(' • ');
  const editLabel = needsAction
    ? 'تعديل وإعادة الإرسال'
    : listing.status === 'approved'
      ? 'تعديل الخدمة'
      : listing.status === 'rejected'
        ? 'تعديل وإعادة الإرسال'
        : 'تعديل الطلب';
  const reviewDecisionRejected = reviewDecision?.status === 'rejected';
  return (
    <View style={[styles.card, reviewDecision && styles.reviewHighlight]}>
      {reviewDecision ? (
        <View
          style={[
            styles.reviewUpdate,
            reviewDecisionRejected
              ? styles.reviewUpdateRejected
              : styles.reviewUpdateApproved,
          ]}
        >
          <View style={styles.reviewUpdateHeader}>
            <View style={styles.reviewUpdateBadge}>
              <MaterialCommunityIcons
                name={
                  reviewDecisionRejected
                    ? 'alert-circle-outline'
                    : 'bell-ring-outline'
                }
                size={18}
                color={reviewDecisionRejected ? colors.error : colors.success}
                accessibilityElementsHidden
              />
              <Text
                accessibilityRole="header"
                style={[
                  styles.reviewUpdateTitle,
                  {
                    color: reviewDecisionRejected
                      ? colors.error
                      : colors.success,
                  },
                ]}
              >
                نتيجة مراجعة جديدة
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`خلاص تمام — نتيجة مراجعة ${listing.name}`}
              onPress={onAcknowledge}
              style={styles.reviewAcknowledge}
            >
              <Text style={styles.reviewUpdateTitle}>خلاص تمام</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="عرض تفاصيل نتيجة المراجعة"
            accessibilityState={{ expanded: reviewExpanded }}
            onPress={() => setReviewExpanded(!reviewExpanded)}
            style={styles.reviewToggle}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={styles.reviewDecisionMessage}
            >
              {reviewDecisionMessage(reviewDecision)}
            </Text>
            <View style={styles.reviewToggleRow}>
              <Text style={styles.reviewUpdateTitle}>
                {reviewExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
              </Text>
              <MaterialCommunityIcons
                name={reviewExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
            </View>
          </Pressable>
          {reviewExpanded ? (
            <View style={styles.reviewDetailsBox}>
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
              {reviewDecision.photoReviewStatus === 'rejected' &&
              reviewDecision.photoReviewReason ? (
                <Text style={styles.noticeText}>
                  سبب رفض الصورة: {reviewDecision.photoReviewReason}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.headerRow}>
        {listing.placePhoto ? (
          <ApprovedPhoto
            uri={listing.placePhoto.thumbnailUrl}
            fallback={categoryImages[listing.categoryId]}
            fallbackElement={
              <CategoryIcon icon={category?.icon ?? 'briefcase-outline'} />
            }
            style={{ width: 52, height: 52, borderRadius: 16 }}
            accessibilityLabel={`الصورة المعتمدة لخدمة ${listing.name}`}
          />
        ) : (
          <CategoryIcon icon={category?.icon ?? 'briefcase-outline'} />
        )}
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={styles.title}>{listing.name}</Text>
            {publication === 'published' && Boolean(review) ? (
              <View style={styles.liveChip}>
                <View style={styles.liveDot} accessibilityElementsHidden />
                <Text style={styles.liveChipText}>ظاهرة حاليًا</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.serviceTitle}>{listing.serviceTitle}</Text>
          {metadataLine ? (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name={listing.address ? 'map-marker-outline' : 'tag-outline'}
                size={14}
                color={colors.muted}
                accessibilityElementsHidden
              />
              <Text style={styles.caption}>{metadataLine}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View
        style={[
          styles.statusPanel,
          {
            backgroundColor: statusTheme.backgroundColor,
            borderColor: statusTheme.borderColor,
          },
        ]}
      >
        <View style={styles.statusHeaderRow}>
          <ServiceStatusArtwork status={statusVariant} />
          <View style={styles.statusCopy}>
            <Text
              style={[styles.statusTitle, { color: statusTheme.titleColor }]}
            >
              {reviewLabel ?? statusLabel}
            </Text>
            <Text style={styles.statusMessage}>{statusDescription}</Text>
          </View>
        </View>
        {needsAction && reviewReason ? (
          <View style={styles.reasonBox}>
            <View style={styles.reasonHeader}>
              <MaterialCommunityIcons
                name="message-alert-outline"
                size={16}
                color={colors.error}
                accessibilityElementsHidden
              />
              <Text style={styles.reasonLabel}>ملاحظة المراجعة</Text>
            </View>
            <Text style={styles.reasonText}>{reviewReason}</Text>
          </View>
        ) : null}
        {unpublished && listing.unpublishReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>
              سبب الإخفاء: {listing.unpublishReason}
            </Text>
          </View>
        ) : null}
        {listing.status === 'pending' ? (
          <View style={styles.reviewStepper}>
            <View style={styles.stepItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={15}
                color={colors.success}
                accessibilityElementsHidden
              />
              <Text style={styles.stepDoneText}>تم إرسال الطلب</Text>
            </View>
            <View style={styles.stepDivider} accessibilityElementsHidden />
            <View style={styles.stepItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={15}
                color={colors.warning}
                accessibilityElementsHidden
              />
              <Text style={styles.stepActiveText}>مراجعة البيانات</Text>
            </View>
            <View style={styles.stepDivider} accessibilityElementsHidden />
            <View style={styles.stepItem}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={15}
                color={colors.muted}
                accessibilityElementsHidden
              />
              <Text style={styles.stepMutedText}>النشر في الدليل</Text>
            </View>
          </View>
        ) : null}
      </View>
      {listing.photoReviewStatus === 'pending' ? (
        <View style={[styles.photoNotice, styles.photoNoticePending]}>
          {listing.photoCandidateId ? (
            <PrivatePhotoPreview candidateId={listing.photoCandidateId} />
          ) : null}
          <View style={styles.copy}>
            <Text style={[styles.photoReviewHeading, { color: colors.warning }]}>
              {listing.photoAction === 'remove'
                ? 'طلب إزالة الصورة قيد المراجعة'
                : 'صورة جديدة قيد المراجعة'}
            </Text>
            <Text style={styles.noticeText}>
              {listing.placePhoto
                ? 'الصورة المعتمدة الحالية لسه ظاهرة لأهل البلد لحد مراجعة التغيير.'
                : 'الصورة في المراجعة وهتظهر في الدليل بعد الموافقة عليها وبيانات الخدمة.'}
            </Text>
          </View>
        </View>
      ) : null}
      {listing.photoReviewStatus === 'rejected'
        ? (() => {
            const canEditPhoto =
              listing.status !== 'pending' && !pendingChanges;
            const body = (
              <>
                <View
                  style={styles.updateArtwork}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <MaterialCommunityIcons
                    name="clipboard-edit-outline"
                    size={40}
                    color={colors.error}
                  />
                  <View style={styles.updateBadge}>
                    <MaterialCommunityIcons
                      name="exclamation"
                      size={14}
                      color={colors.onPrimary}
                    />
                  </View>
                </View>
                {listing.photoCandidateId ? (
                  <PrivatePhotoPreview candidateId={listing.photoCandidateId} />
                ) : null}
                <View style={styles.copy}>
                  <Text
                    style={[styles.photoReviewHeading, { color: colors.error }]}
                  >
                    {listing.photoAction === 'remove'
                      ? 'طلب إزالة الصورة محتاج مراجعة'
                      : 'الصورة الجديدة محتاجة تعديل'}
                  </Text>
                  {listing.photoReviewReason ? (
                    <Text style={styles.updateMessage}>
                      {listing.photoReviewReason}
                    </Text>
                  ) : null}
                  <Text style={styles.updateMessage}>
                    {listing.placePhoto
                      ? 'الصورة المعتمدة الحالية لسه منشورة. راجع الملاحظات واختار صورة تانية أو كمّل من غير تغيير.'
                      : 'راجع الملاحظات واختار صورة أوضح للمكان ثم أعد الإرسال.'}
                  </Text>
                </View>
                {canEditPhoto ? (
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={26}
                    color={colors.error}
                    accessibilityElementsHidden
                  />
                ) : null}
              </>
            );
            return canEditPhoto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="الصورة محتاجة تعديل — راجع الملاحظات وعدّل الصورة"
                onPress={() =>
                  router.push({
                    pathname: '/provider/edit/[id]',
                    params: { id: listing.id },
                  })
                }
                style={styles.updateReminder}
              >
                {body}
              </Pressable>
            ) : (
              <View style={styles.updateReminder}>{body}</View>
            );
          })()
        : null}
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
    card: {
      padding: spacing.md,
      gap: 14,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reviewHighlight: { borderColor: colors.primary },
    reviewUpdate: {
      padding: 12,
      borderRadius: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reviewUpdateApproved: { backgroundColor: colors.publishedBackground },
    reviewUpdateRejected: { backgroundColor: colors.errorContainer },
    reviewUpdateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    reviewUpdateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    reviewUpdateTitle: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reviewAcknowledge: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    reviewToggle: { gap: 4 },
    reviewDecisionMessage: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reviewToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    reviewDetailsBox: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      gap: 4,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    title: {
      ...typography.title,
      flexShrink: 1,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    liveChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: colors.publishedBackground,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    liveChipText: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      lineHeight: 20,
      color: colors.success,
      writingDirection: 'rtl',
    },
    serviceTitle: {
      fontFamily: fontFamily.medium,
      fontSize: 15,
      lineHeight: 24,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    caption: {
      ...typography.caption,
      flexShrink: 1,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    statusPanel: {
      borderRadius: 18,
      padding: 14,
      gap: 12,
      borderWidth: 1,
    },
    statusHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    statusCopy: { flex: 1, minWidth: 0, gap: 2 },
    statusTitle: {
      ...typography.title,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    statusMessage: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reasonBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    reasonLabel: {
      ...typography.label,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reasonText: {
      ...typography.body,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reviewStepper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stepItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stepDivider: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    stepDoneText: {
      ...typography.caption,
      color: colors.success,
      writingDirection: 'rtl',
    },
    stepActiveText: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      lineHeight: 22,
      color: colors.warning,
      writingDirection: 'rtl',
    },
    stepMutedText: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    photoNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoNoticePending: { backgroundColor: colors.pendingBackground },
    updateReminder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      minHeight: 88,
      borderRadius: 18,
      backgroundColor: colors.errorContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    updateArtwork: {
      width: 50,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateBadge: {
      position: 'absolute',
      bottom: 0,
      end: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.errorContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateMessage: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    photoReviewHeading: {
      ...typography.label,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    noticeText: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    actions: { gap: spacing.sm },
    action: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: 14,
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryAction: { backgroundColor: colors.actionBackground },
    secondaryAction: {
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryActionText: { color: colors.onPrimary },
    actionText: {
      ...typography.label,
      flexShrink: 1,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });
