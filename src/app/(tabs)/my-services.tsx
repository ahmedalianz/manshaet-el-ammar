import { MyServicesEmptyArtwork } from '../../features/provider/MyServicesEmptyArtwork';
import { useCompactHeader } from '../../components/brand/useCompactHeader';
import { CommunityHeader } from '../../components/brand/CommunityHeader';
import {
  reviewDecisionMessage,
  useReviewDecisions,
} from '../../features/provider/useReviewDecisions';
import { LoadingState } from '../../components/ui/LoadingState';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable as BackdropPressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MyServiceCard,
  servicePublicationStatus,
  serviceReviewStatus,
  type PublicationStatus,
  type ReviewStatus,
} from '../../features/provider/MyServiceCard';
import { useSupportActions } from '../../features/support/useSupportActions';
import { useProviderState } from '../../features/provider/ProviderContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const publicationFilters: { id: PublicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'published', label: 'منشورة' },
  { id: 'unpublished', label: 'غير منشورة' },
];
const reviewFilters: { id: ReviewStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'needs-edit', label: 'تحتاج تعديل' },
];
export default function MyServicesScreen() {
  const { compact, ...headerScroll } = useCompactHeader();
  const [screenHeight, setScreenHeight] = useState(0);
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const support = useSupportActions();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewResultsOpen, setReviewResultsOpen] = useState(false);
  const [publicationFilter, setPublicationFilter] = useState<
    PublicationStatus | 'all'
  >('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('all');
  const {
    userId,
    listings,
    categories,
    initializing,
    privateLoading,
    privateError,
    privateRefreshing,
    refresh,
    refreshMyServices,
    requests,
  } = useProviderState();
  const reload = refreshMyServices ?? refresh;
  useFocusEffect(
    useCallback(() => {
      if (!userId || initializing) return;
      void reload();
      let previous = AppState.currentState;
      const listener = AppState.addEventListener('change', (next) => {
        if (next === 'active' && previous !== 'active') void reload();
        previous = next;
      });
      return () => listener.remove();
    }, [userId, initializing, reload]),
  );
  const { unread, acknowledge, persistenceError } = useReviewDecisions(
    userId,
    listings,
    requests ?? [],
  );
  const visibleListings = userId
    ? listings.filter(
        (listing) =>
          (publicationFilter === 'all' ||
            servicePublicationStatus(listing) === publicationFilter) &&
          (reviewFilter === 'all' ||
            serviceReviewStatus(listing) === reviewFilter),
      )
    : [];
  const filteredEmpty = Boolean(
    userId &&
    listings.length &&
    (publicationFilter !== 'all' || reviewFilter !== 'all'),
  );
  const signIn = () =>
    router.push({
      pathname: '/provider/sign-in',
      params: { next: 'my-services', mode: 'sign-in' },
    });
  if (initializing || (userId && privateLoading))
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <LoadingState label="بنحمّل خدماتك…" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      testID="my-services-screen"
      edges={['top']}
      style={styles.screen}
      onLayout={({ nativeEvent }) => setScreenHeight(nativeEvent.layout.height)}
    >
      <CommunityHeader
        compact={compact}
        signedIn={Boolean(userId)}
        pageTitle="خدماتي"
        onAccount={() => (userId ? router.push('/account/profile') : signIn())}
      />
      <FlatList
        testID="my-services-list"
        {...headerScroll}
        data={visibleListings}
        refreshing={Boolean(privateRefreshing)}
        onRefresh={reload}
        keyExtractor={(listing) => listing.id}
        renderItem={({ item }) => (
          <MyServiceCard
            listing={item}
            reviewDecision={unread.find(
              (request) => request.providerId === item.id,
            )}
            onAcknowledge={() => {
              const request = unread.find(
                (request) => request.providerId === item.id,
              );
              if (request) acknowledge(request);
            }}
            category={categories?.find(
              (category) => category.id === item.categoryId,
            )}
          />
        )}
        contentContainerStyle={[
          styles.content,
          // The screen stays the same size while the header animates. Keeping
          // empty content this tall prevents its scroll offset being clamped
          // back to zero when the list viewport grows.
          visibleListings.length === 0 && [
            styles.emptyContent,
            { minHeight: screenHeight },
          ],
        ]}
        ListFooterComponent={
          userId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تواصل مع الدعم"
              onPress={support.openEmail}
              style={styles.support}
            >
              <View style={styles.supportIcon}>
                <MaterialCommunityIcons
                  name="headset"
                  size={24}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.supportTitle}>
                  محتاج مساعدة في إضافة خدمتك؟
                </Text>
                <Text style={styles.overviewCaption}>
                  تواصل مع دعم منشأة العمار
                </Text>
              </View>
              <View style={styles.supportArrow}>
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
              </View>
            </Pressable>
          ) : undefined
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <RemoteDataNotice privateData />
            {userId ? (
              <>
                {unread.length ? (
                  <View style={styles.reviewSummary}>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.supportTitle}
                    >
                      عندك {unread.length.toLocaleString('ar-EG')} نتائج مراجعة
                      جديدة
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="عرض نتائج المراجعة الجديدة"
                      onPress={() => setReviewResultsOpen(true)}
                      style={styles.reviewSummaryAction}
                    >
                      <Text style={styles.link}>عرض نتائج المراجعة</Text>
                    </Pressable>
                  </View>
                ) : null}
                {persistenceError ? (
                  <Text accessibilityRole="alert" style={styles.body}>
                    {persistenceError}
                  </Text>
                ) : null}
                <View style={styles.overview}>
                  <View style={styles.overviewCopy}>
                    <View style={styles.overviewHeading}>
                      <MaterialCommunityIcons
                        name="layers-outline"
                        size={22}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.overviewTitle}>إدارة خدماتك</Text>
                    </View>
                    <Text style={styles.overviewCaption}>
                      تابع النشر وطلبات المراجعة
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="إضافة خدمة"
                    onPress={() => router.push('/provider/add')}
                    style={styles.addButton}
                  >
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={21}
                      color={colors.onPrimary}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.primaryText}>إضافة خدمة</Text>
                  </Pressable>
                </View>
                <View style={styles.listHeading}>
                  <Text accessibilityRole="header" style={styles.overviewTitle}>
                    خدماتي ({listings.length.toLocaleString('ar-EG')})
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="تصفية الخدمات"
                    accessibilityState={{
                      expanded: filtersOpen,
                      selected:
                        publicationFilter !== 'all' || reviewFilter !== 'all',
                    }}
                    onPress={() => setFiltersOpen(true)}
                    style={styles.filter}
                  >
                    <MaterialCommunityIcons
                      name="tune-variant"
                      size={20}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.link}>
                      فلترة
                      {publicationFilter !== 'all' || reviewFilter !== 'all'
                        ? ' •'
                        : ''}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !(initializing || privateLoading || privateError) ? (
            filteredEmpty ? (
              <View style={styles.empty}>
                <View style={styles.filteredIcon}>
                  <MaterialCommunityIcons
                    name="text-search"
                    size={32}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </View>
                <Text accessibilityRole="header" style={styles.emptyTitle}>
                  مفيش خدمات بالحالة دي
                </Text>
                <Text style={styles.emptyBody}>
                  اختار حالة تانية أو اعرض كل خدماتك.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondary}
                  onPress={() => {
                    setPublicationFilter('all');
                    setReviewFilter('all');
                  }}
                >
                  <Text style={styles.link}>عرض كل الخدمات</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <MyServicesEmptyArtwork />
                <Text accessibilityRole="header" style={styles.emptyTitle}>
                  {userId ? 'لسه مضفتش أي خدمة' : 'عندك خدمة بتقدمها؟'}
                </Text>
                <Text style={styles.emptyBody}>
                  {userId
                    ? 'ضيف خدمتك الأولى عشان تبدأ تظهر لأهالي البلد بعد مراجعتها.'
                    : 'سجّل دخولك علشان تضيف خدمتك وتتابع طلباتك.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.primary}
                  onPress={userId ? () => router.push('/provider/add') : signIn}
                >
                  <MaterialCommunityIcons
                    name={userId ? 'plus-circle-outline' : 'login'}
                    size={24}
                    color={colors.onPrimary}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.primaryText}>
                    {userId ? 'إضافة خدمة' : 'تسجيل الدخول'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.secondary, styles.emptySecondary]}
                  onPress={
                    userId
                      ? () => router.push('/(tabs)/explore')
                      : () =>
                          router.push({
                            pathname: '/provider/sign-in',
                            params: { next: 'my-services', mode: 'register' },
                          })
                  }
                >
                  <Text style={[styles.link, { textAlign: 'center' }]}>
                    {userId ? 'استكشف خدمات البلد' : 'إنشاء حساب'}
                  </Text>
                </Pressable>
                {!userId ? (
                  <Text style={styles.body}>
                    تقدر تتصفح خدمات البلد من غير حساب.
                  </Text>
                ) : undefined}
              </View>
            )
          ) : undefined
        }
      />
      <Modal
        visible={reviewResultsOpen && Boolean(userId)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewResultsOpen(false)}
      >
        <View style={styles.backdrop}>
          <BackdropPressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق نتائج المراجعة من الخلفية"
            onPress={() => setReviewResultsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <ScrollView contentContainerStyle={styles.header}>
              <View style={styles.listHeading}>
                <Text accessibilityRole="header" style={styles.overviewTitle}>
                  نتائج المراجعة
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق نتائج المراجعة"
                  onPress={() => setReviewResultsOpen(false)}
                  style={styles.textButton}
                >
                  <Text style={styles.link}>إغلاق</Text>
                </Pressable>
              </View>
              {unread.length ? (
                unread.map((request) => (
                  <View key={request.id} style={styles.reviewSummary}>
                    <Text style={styles.supportTitle}>
                      {
                        listings.find((item) => item.id === request.providerId)
                          ?.name
                      }
                    </Text>
                    <Text style={styles.body}>
                      {reviewDecisionMessage(request)}
                    </Text>
                    <Text style={styles.body}>
                      نوع الخدمة: {request.proposedData.serviceTitle}
                    </Text>
                    {request.reviewedAt ? (
                      <Text style={styles.body}>
                        تاريخ المراجعة:{' '}
                        {new Date(request.reviewedAt).toLocaleDateString(
                          'ar-EG',
                        )}
                      </Text>
                    ) : null}
                    {request.status === 'rejected' &&
                    request.rejectionReason ? (
                      <Text style={styles.body}>
                        سبب الرفض: {request.rejectionReason}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`خلاص تمام — ${request.proposedData.name}`}
                      onPress={() => acknowledge(request)}
                      style={styles.reviewSummaryAction}
                    >
                      <Text style={styles.link}>خلاص تمام</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.body}>
                  تم الاطلاع على كل نتائج المراجعة.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.backdrop}>
          <BackdropPressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق النافذة"
            onPress={() => setFiltersOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <ScrollView contentContainerStyle={styles.header}>
              <View style={styles.listHeading}>
                <Text accessibilityRole="header" style={styles.overviewTitle}>
                  تصفية الخدمات
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق الفلاتر"
                  style={styles.textButton}
                  onPress={() => setFiltersOpen(false)}
                >
                  <Text style={styles.link}>تم</Text>
                </Pressable>
              </View>
              {(['publication', 'review'] as const).map((dimension) => {
                const publication = dimension === 'publication';
                const filters = publication
                  ? publicationFilters
                  : reviewFilters;
                return (
                  <View key={dimension}>
                    <Text style={styles.filterHeading}>
                      {publication
                        ? 'حالة النشر في الدليل'
                        : 'حالة طلب المراجعة'}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filters}
                    >
                      {filters.map((filter) => {
                        const selected =
                          (publication ? publicationFilter : reviewFilter) ===
                          filter.id;
                        const count = listings.filter((listing) => {
                          const matchesOtherDimension = publication
                            ? reviewFilter === 'all' ||
                              serviceReviewStatus(listing) === reviewFilter
                            : publicationFilter === 'all' ||
                              servicePublicationStatus(listing) ===
                                publicationFilter;
                          return (
                            matchesOtherDimension &&
                            (filter.id === 'all' ||
                              (publication
                                ? servicePublicationStatus(listing)
                                : serviceReviewStatus(listing)) === filter.id)
                          );
                        }).length;
                        const label = `${filter.label} (${count.toLocaleString('ar-EG')})`;
                        return (
                          <Pressable
                            key={filter.id}
                            accessibilityRole="button"
                            accessibilityLabel={
                              filter.id === 'all'
                                ? `${publication ? 'كل حالات النشر' : 'كل حالات الطلب'} (${count.toLocaleString('ar-EG')})`
                                : label
                            }
                            accessibilityState={{ selected }}
                            onPress={() =>
                              publication
                                ? setPublicationFilter(
                                    filter.id as PublicationStatus | 'all',
                                  )
                                : setReviewFilter(
                                    filter.id as ReviewStatus | 'all',
                                  )
                            }
                            style={[
                              styles.filter,
                              selected && styles.filterSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.filterText,
                                selected && styles.filterTextSelected,
                              ]}
                            >
                              {label.replaceAll(' ', '\u00a0')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}
              <Pressable
                accessibilityRole="button"
                style={styles.secondary}
                onPress={() => {
                  setPublicationFilter('all');
                  setReviewFilter('all');
                }}
              >
                <Text style={styles.link}>مسح الفلاتر</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    reviewSummary: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainer,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    reviewSummaryAction: { minHeight: 44, justifyContent: 'center' },
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    emptyContent: { paddingBottom: spacing.xxl * 2 },
    header: { gap: spacing.md },
    listHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 4,
      flexWrap: 'wrap',
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '85%',
      padding: 16,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    brandCopy: { flex: 1, minWidth: 0, gap: 2 },
    overview: {
      padding: spacing.md,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainer,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    overviewCopy: { flexGrow: 1, flexBasis: 140, gap: spacing.xs },
    overviewHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    overviewCaption: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    overviewTitle: {
      ...typography.sectionTitle,
      color: colors.primaryDark,
      flexShrink: 1,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    addButton: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 14,
      backgroundColor: colors.actionBackground,
    },
    filterHeading: {
      ...typography.label,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    filters: { gap: spacing.sm, paddingVertical: spacing.xs },
    filter: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterSelected: { backgroundColor: colors.actionBackground },
    filterText: {
      ...typography.caption,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    filterTextSelected: { color: colors.onPrimary },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    support: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 88,
    },
    supportIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportArrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportTitle: {
      ...typography.title,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    title: {
      ...typography.screenTitle,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    body: {
      ...typography.body,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    empty: {
      padding: spacing.md + spacing.xs,
      borderRadius: 24,
      backgroundColor: colors.surface,
      gap: spacing.sm + spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      ...typography.screenTitle,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptySecondary: { backgroundColor: 'transparent' },
    filteredIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainer,
    },
    primary: {
      minHeight: 54,
      padding: spacing.sm,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionBackground,
    },
    primaryText: {
      ...typography.button,
      color: colors.onPrimary,
      textAlign: 'center',
    },
    secondary: {
      minHeight: 48,
      padding: spacing.sm,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainer,
    },
    demo: {
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
    },
    textButton: { minHeight: 44, justifyContent: 'center' },
    link: {
      ...typography.label,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
  });
