import {
  PhotoViewportProvider,
  usePhotoScroll,
} from '../../features/photos/PhotoViewport';
import { DeleteServiceAction } from '../../features/admin/AdminUi';
import { categoryImages } from '../../features/discovery/data/categoryImages';
import { CommunityArtwork } from '../../components/brand/CommunityArtwork';
import {
  DirectoryPagination,
  useDirectorySearch,
} from '../../features/discovery/DirectoryPagination';
import { LoadingState } from '../../components/ui/LoadingState';
import { useCategoryProviders } from '../../features/discovery/firebaseQueries';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import {
  MotionReveal,
  MotionPressable as Pressable,
} from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  BackHeader,
  EmptyState,
  SearchInput,
} from '../../features/discovery/components/DiscoveryUi';
import { ProviderCard } from '../../features/discovery/components/ProviderCard';
import { searchProviders } from '../../features/discovery/search';
import { categoryEmptyState } from '../../features/discovery/emptyState';
import { useProviderState } from '../../features/provider/ProviderContext';
import {
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { firebaseMessage } from '../../features/auth/errors';

export default function CategoryDetailsScreen() {
  return (
    <PhotoViewportProvider>
      <CategoryDetailsScreenContent />
    </PhotoViewportProvider>
  );
}
function CategoryDetailsScreenContent() {
  const photoScroll = usePhotoScroll();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const {
    categories,
    configured,
    publicLoading,
    publicError,
    categoriesLoading,
    userId,
    initializing,
    role,
    listings,
  } = useProviderState();
  const statusStyles = useProviderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = categories.find((item) => item.id === id);
  const [query, setQuery] = useState('');
  const categoryQuery = useCategoryProviders(id);
  const categoryProviders = categoryQuery.data ?? [];
  useDirectorySearch(query, {
    hasMore: categoryQuery.hasNextPage,
    fetching: categoryQuery.isFetching,
    error: categoryQuery.error,
    loadMore: categoryQuery.loadMore,
  });
  const visibleProviders = searchProviders(
    query,
    id,
    categoryProviders,
    categories,
  );
  const empty = categoryEmptyState(
    categoryProviders.length,
    query,
    category?.name,
  );
  const resetEmpty = () => {
    if (empty.action === 'explore') {
      router.push('/(tabs)/explore');
      return;
    }
    setQuery('');
  };

  const listHeader = category ? (
    <View style={styles.listHeader}>
      {categoryQuery.isError ? (
        <View>
          <Text accessibilityRole="alert" style={statusStyles.body}>
            {firebaseMessage(categoryQuery.error)}
          </Text>
          <ProviderAction
            title="جرّب تاني"
            onPress={() => {
              void categoryQuery.refetch();
            }}
          />
        </View>
      ) : null}
      <View style={styles.introCard}>
        {categoryImages[category.id] ? (
          <Image
            source={categoryImages[category.id]}
            style={styles.categoryBackdrop}
            resizeMode="cover"
            accessible={false}
          />
        ) : null}
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name={category.icon}
            size={34}
            color={colors.onPrimary}
            accessibilityElementsHidden
          />
        </View>
        <View style={styles.introCopy}>
          <Text accessibilityRole="header" style={styles.introTitle}>
            {category.name.startsWith('خدمات')
              ? category.name
              : `خدمات ${category.name}`}
          </Text>
          <Text style={styles.introDescription}>
            تواصل مع أصحاب الخدمات في منشأة العمار مباشرة، من غير وسيط أو عمولة.
          </Text>
        </View>
      </View>
      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث بالاسم أو الخدمة أو العنوان..."
      />
      {categoryProviders.length || query.trim() ? (
        <View style={styles.filterHeading}>
          <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
            عرض {visibleProviders.length.toLocaleString('ar-EG')} مقدم خدمة من
            البيانات المحملة
          </Text>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.navigationBar}>
        <View style={styles.backHeader}>
          <BackHeader title="تفاصيل القسم" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={userId ? 'الملف الشخصي' : 'تسجيل الدخول'}
          disabled={initializing}
          onPress={() =>
            userId
              ? router.push('/account/profile')
              : router.push({
                  pathname: '/provider/sign-in',
                  params: { next: 'more' },
                })
          }
          style={styles.accountButton}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={23}
            color={colors.onPrimary}
            accessibilityElementsHidden
          />
        </Pressable>
      </View>
      {categoryQuery.data?.some((item) => item.cachedAt) ? (
        <Text style={statusStyles.notice}>
          بيانات محفوظة — آخر تحديث{' '}
          {new Date(
            categoryQuery.data.find((item) => item.cachedAt)!.cachedAt!,
          ).toLocaleString('ar-EG')}
          . ممكن تكون اتغيّرت، والمعروض هو اللي اتحمّل قبل كده.
        </Text>
      ) : null}
      {!category && !(categoriesLoading ?? publicLoading) ? (
        <RemoteDataNotice />
      ) : null}
      {configured &&
      ((id && category && categoryQuery.isPending) ||
        (!category && (categoriesLoading ?? publicLoading))) ? (
        <LoadingState label="بنحمّل خدمات القسم…" />
      ) : category && categoryQuery.isError && !categoryQuery.data ? (
        <View style={styles.invalidCategory}>
          <Text accessibilityRole="alert" style={statusStyles.body}>
            {firebaseMessage(categoryQuery.error)}
          </Text>
          <ProviderAction
            title="جرّب تاني"
            onPress={() => {
              void categoryQuery.refetch();
            }}
          />
        </View>
      ) : category ? (
        <MotionReveal
          animateOnMount
          changeKey={visibleProviders.length ? 'results' : 'empty'}
          style={{ flex: 1 }}
        >
          <FlatList
            onScroll={photoScroll}
            scrollEventThrottle={100}
            refreshing={categoryQuery.isFetching && !categoryQuery.isPending}
            onRefresh={() => {
              void categoryQuery.refetch();
            }}
            data={visibleProviders}
            keyExtractor={(provider) => provider.id}
            renderItem={({ item }) => {
              const owned =
                userId && !initializing
                  ? listings?.find(
                      (listing) =>
                        listing.id === item.id && listing.ownerId === userId,
                    )
                  : undefined;
              const isAdmin =
                role === 'admin' && Boolean(userId) && !initializing;
              return (
                <ProviderCard
                  presentation="illustrated"
                  provider={item}
                  category={category}
                  onPress={() =>
                    router.push({
                      pathname: '/provider/[id]',
                      params: { id: item.id },
                    })
                  }
                  managementActions={
                    owned || isAdmin ? (
                      <>
                        {owned && !isAdmin ? (
                          <ProviderAction
                            secondary
                            title="إدارة خدمتك"
                            onPress={() =>
                              router.push({
                                pathname: owned.pendingChanges
                                  ? '/provider/changes/[id]'
                                  : '/provider/edit/[id]',
                                params: { id: item.id },
                              })
                            }
                          />
                        ) : null}
                        {isAdmin ? (
                          <>
                            <ProviderAction
                              secondary
                              title="تعديل الخدمة"
                              onPress={() =>
                                router.push({
                                  pathname: '/provider/edit/[id]',
                                  params: {
                                    id: item.id,
                                    from: 'category',
                                    categoryId: category.id,
                                  },
                                })
                              }
                            />
                            <DeleteServiceAction
                              id={item.id}
                              label="حذف الخدمة"
                              onDeleted={() => {
                                void categoryQuery.refetch();
                              }}
                            />
                          </>
                        ) : null}
                      </>
                    ) : undefined
                  }
                />
              );
            }}
            ListHeaderComponent={listHeader ?? undefined}
            ListEmptyComponent={
              categoryQuery.hasNextPage || categoryQuery.isError ? undefined : (
                <View style={styles.emptyCard}>
                  {!categoryProviders.length && !query.trim() ? (
                    <>
                      <View
                        style={styles.emptyIllustration}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <View style={styles.emptyVillage}>
                          <CommunityArtwork />
                        </View>
                        <View style={styles.toolbox}>
                          <MaterialCommunityIcons
                            name="toolbox-outline"
                            size={70}
                            color={colors.primaryDark}
                          />
                        </View>
                      </View>
                      <Text
                        accessibilityRole="header"
                        style={styles.emptyTitle}
                      >
                        لسه مفيش خدمات في القسم ده
                      </Text>
                      <Text style={styles.emptyDescription}>
                        تقدر تضيف أول خدمة وتكون جزء من دليل خدمات منشأة العمار.
                      </Text>
                      <ProviderAction
                        title="إضافة خدمة جديدة"
                        onPress={() => router.push('/provider/add')}
                      />
                    </>
                  ) : (
                    <EmptyState {...empty} onAction={resetEmpty} />
                  )}
                </View>
              )
            }
            ListFooterComponentStyle={styles.listFooter}
            ListFooterComponent={
              <View style={{ gap: 16 }}>
                {categoryProviders.length ||
                categoryQuery.hasNextPage ||
                categoryQuery.error ||
                categoryQuery.isFetching ? (
                  <DirectoryPagination
                    totalLabel="إجمالي القسم"
                    loaded={categoryProviders.length}
                    total={categoryQuery.total}
                    matches={visibleProviders.length}
                    searching={Boolean(query.trim())}
                    hasMore={categoryQuery.hasNextPage}
                    fetching={categoryQuery.isFetching}
                    error={categoryQuery.error}
                    loadMore={categoryQuery.loadMore}
                  />
                ) : null}
                {categoryProviders.length > 0 ? (
                  <ProviderAction
                    title="إضافة خدمة جديدة"
                    onPress={() => router.push('/provider/add')}
                  />
                ) : null}
                <View style={styles.communityNote}>
                  <View style={styles.noteIcon}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={25}
                      color={colors.onPrimary}
                      accessibilityElementsHidden
                    />
                  </View>
                  <View style={styles.noteCopy}>
                    <Text style={styles.noteTitle}>
                      خدمات أهل البلد، من غير عمولة
                    </Text>
                    <Text style={styles.noteBody}>
                      تواصل مع أصحاب الصنعة مباشرة، من غير وسيط أو عمولة. الدليل
                      مجاني لأهل البلد.
                    </Text>
                    <Text style={styles.noteBody}>
                      وجود الخدمة في الدليل مش ضمان لجودة الشغل.
                    </Text>
                  </View>
                </View>
              </View>
            }
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </MotionReveal>
      ) : !configured ||
        (categoriesLoading ?? publicLoading) ||
        publicError ? null : (
        <View style={styles.invalidCategory}>
          <EmptyState
            title="القسم غير موجود"
            message="ارجع واستكشف الأقسام المتاحة"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
    },
    listFooter: { marginTop: spacing.lg },
    listHeader: { gap: spacing.md, paddingBottom: spacing.md },
    introCard: {
      minHeight: 124,
      padding: spacing.md,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: 18,
      backgroundColor: colors.actionBackground,
    },
    categoryBackdrop: {
      position: 'absolute',
      end: 0,
      top: 0,
      bottom: 0,
      width: '45%',
      height: '140%',
      opacity: 0.13,
    },
    emptyIllustration: {
      height: 156,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyVillage: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      opacity: 0.5,
      overflow: 'hidden',
      borderRadius: 70,
    },
    toolbox: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 28,
      padding: spacing.md,
    },
    emptyTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptyDescription: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    introCopy: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
    introTitle: {
      ...typography.sectionTitle,
      color: colors.onPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    introDescription: {
      ...typography.body,
      color: colors.onPrimary,
      opacity: 0.85,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    navigationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingEnd: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider,
    },
    backHeader: { flex: 1 },
    accountButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionBackground,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.14)',
    },
    filterHeading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    resultCount: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: spacing.md,
      gap: spacing.md,
    },
    communityNote: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: colors.surfaceContainer,
      padding: 20,
      borderRadius: 22,
    },
    noteIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.actionBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteCopy: { flex: 1, gap: 6 },
    noteTitle: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    noteBody: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    resultsHeading: {
      ...typography.title,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    separator: { height: spacing.md },
    invalidCategory: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  });
