import {
  PhotoViewportProvider,
  usePhotoScroll,
} from '../../features/photos/PhotoViewport';
import {
  SearchNotFoundCard,
  categoryShortLabels,
} from '../../features/discovery/components/SearchNotFoundCard';
import { useCompactHeader } from '../../components/brand/useCompactHeader';
import {
  CommunityHeader,
  communityHeaderExpandedHeight,
} from '../../components/brand/CommunityHeader';
import { AddServiceCard } from '../../features/discovery/components/AddServiceCard';
import { LocalHeritageBanner } from '../../features/discovery/components/LocalHeritageBanner';
import { EmergencyShortcut } from '../../features/emergency/EmergencyShortcut';
import { useDirectorySearch } from '../../features/discovery/DirectoryPagination';
import { ProviderAction } from '../../features/provider/ProviderPage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingState } from '../../components/ui/LoadingState';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import {
  EmptyState,
  SearchInput,
} from '../../features/discovery/components/DiscoveryUi';
import { ProviderCard } from '../../features/discovery/components/ProviderCard';
import { useProviderState } from '../../features/provider/ProviderContext';
import { searchDirectory } from '../../features/discovery/search';
import { homeCategoryIds } from '../../features/discovery/data/categories';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { fontFamily, typography } from '../../theme/typography';

export default function HomeScreen() {
  return (
    <PhotoViewportProvider>
      <HomeScreenContent />
    </PhotoViewportProvider>
  );
}
function HomeScreenContent() {
  const photoScroll = usePhotoScroll();
  const { colors } = useAppTheme();
  const { compact, scrollY, ...headerScroll } = useCompactHeader();
  const { fontScale } = useWindowDimensions();
  const headerHeight = communityHeaderExpandedHeight(fontScale);
  const styles = useThemedStyles(createStyles);
  const {
    publicProviders: providers,
    categories,
    publicLoading,
    publicHasMore,
    publicFetching,
    publicError,
    loadMorePublicProviders,
    userId,
  } = useProviderState();
  const [query, setQuery] = useState('');
  const openSearchResults = (submittedQuery = query) =>
    router.push({
      pathname: '/explore',
      params: submittedQuery.trim()
        ? { search: submittedQuery, searchRequest: String(Date.now()) }
        : { filter: 'all' },
    });
  useDirectorySearch(query, {
    hasMore: publicHasMore,
    fetching: publicFetching,
    error: publicError,
    loadMore: loadMorePublicProviders,
  });
  const searching = Boolean(query.trim());
  const results = searchDirectory(query, providers, categories);
  const visibleProviders = providers
    .filter(
      (provider) =>
        provider.status === 'approved' &&
        provider.publicationStatus !== 'unpublished',
    )
    .slice(0, 3);
  const openResult = (result: (typeof results)[number]) => {
    if (result.type === 'category')
      router.push({
        pathname: '/category/[id]',
        params: { id: result.category.id },
      });
    else
      router.push({
        pathname: '/provider/[id]',
        params: { id: result.provider.id },
      });
  };
  const homeCategories = homeCategoryIds
    .flatMap((id) => {
      const category = categories.find((item) => item.id === id);
      return category ? [category] : [];
    })
    .slice(0, 4);
  const accentSurfaces = [
    colors.categoryBlue,
    colors.categoryTeal,
    colors.categoryLavender,
    colors.categorySand,
    colors.categorySlate,
  ];
  const sectionHeading = (title: string, action: string) => (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={() =>
          router.push({ pathname: '/explore', params: { filter: 'all' } })
        }
        style={styles.sectionAction}
      >
        <Text style={styles.sectionActionText}>
          {action.replaceAll(' ', '\u00a0')}
        </Text>
        <MaterialCommunityIcons
          name="arrow-left"
          size={16}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
      </Pressable>
    </View>
  );
  if (publicLoading)
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LoadingState />
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bodyFrame}>
        <CommunityHeader
          overlay
          compact={compact}
          scrollY={scrollY}
          signedIn={Boolean(userId)}
          onAccount={() =>
            router.push(userId ? '/account/profile' : '/provider/sign-in')
          }
        />
        <ScrollView
          testID="home-scroll"
          {...headerScroll}
          onScroll={(event) => {
            headerScroll.onScroll(event);
            photoScroll();
          }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {searching &&
          (providers.some((provider) => provider.cachedAt) ||
            categories.some((category) => category.cachedAt)) ? (
            <RemoteDataNotice />
          ) : null}
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              بتدور على إيه؟
            </Text>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              onSubmit={openSearchResults}
              placeholder="ابحث عن خدمة أو مقدم خدمة..."
              accessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    query.trim() ? 'افتح نتائج البحث' : 'استكشف كل الخدمات'
                  }
                  onPress={() => openSearchResults()}
                  style={styles.searchAccessory}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={19}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </Pressable>
              }
            />
            {searching ? (
              results.length ? (
                <View style={styles.searchResults}>
                  {results.map((result, index) => {
                    const label =
                      result.type === 'category'
                        ? result.category.name
                        : result.provider.name;
                    const detail =
                      result.type === 'category'
                        ? result.category.description
                        : result.provider.serviceTitle;
                    const isLast = index === results.length - 1;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          result.type === 'category'
                            ? `قسم: ${label}`
                            : `مقدم خدمة: ${label}، ${detail}`
                        }
                        key={`${result.type}-${result.type === 'category' ? result.category.id : result.provider.id}`}
                        onPress={() => openResult(result)}
                        style={[
                          styles.searchResult,
                          isLast && styles.lastSearchResult,
                        ]}
                      >
                        <View
                          pointerEvents="none"
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={styles.searchResultIcon}
                        >
                          <MaterialCommunityIcons
                            name={
                              result.type === 'category'
                                ? result.category.icon
                                : 'storefront-outline'
                            }
                            size={20}
                            color={colors.primaryDark}
                            accessibilityElementsHidden
                          />
                        </View>
                        <View style={styles.searchResultCopy}>
                          <View style={styles.searchResultHeading}>
                            <Text style={styles.searchResultTitle}>
                              {label}
                            </Text>
                            <View style={styles.searchResultTypePill}>
                              <Text style={styles.searchResultType}>
                                {result.type === 'category'
                                  ? 'قسم'
                                  : 'مقدم خدمة'}
                              </Text>
                            </View>
                          </View>
                          <Text
                            numberOfLines={
                              result.type === 'category' ? 1 : undefined
                            }
                            style={styles.searchResultDetail}
                          >
                            {detail}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : publicHasMore || publicError || publicFetching ? null : (
                <SearchNotFoundCard
                  title="ملقيناش اللي بتدور عليه"
                  message="جرّب اسم أقصر أو نوع الخدمة، زي سباك أو نجار."
                  query={query}
                  suggestions={homeCategories.slice(0, 3)}
                  onSelectSuggestion={(category) => setQuery(category.name)}
                  primaryActionLabel="امسح البحث وارجع للرئيسية"
                  onPrimaryAction={() => setQuery('')}
                  onContactSupport={() => router.push('/info/contact')}
                />
              )
            ) : null}
            {searching && (publicHasMore || publicFetching) && !publicError ? (
              <LoadingState compact label="بندور في باقي الخدمات…" />
            ) : null}
            {searching && publicError ? (
              <View style={styles.searchStatus}>
                <Text
                  accessibilityRole="alert"
                  style={styles.searchResultDetail}
                >
                  مقدرناش نكمّل البحث. جرّب تاني عشان تشوف باقي النتائج.
                </Text>
                <ProviderAction
                  title="جرّب تاني"
                  disabled={publicFetching}
                  onPress={() => {
                    void loadMorePublicProviders().catch(() => {});
                  }}
                />
              </View>
            ) : null}
            {searching && results.length > 0 ? (
              <ProviderAction
                title="عرض كل النتائج"
                onPress={() => openSearchResults()}
              />
            ) : null}
          </View>
          {!searching ? (
            <>
              <LocalHeritageBanner />
              <RemoteDataNotice />
              <View style={styles.section}>
                {sectionHeading('استكشف الأقسام', 'كل الأقسام')}
                <View style={styles.categoryRow}>
                  {homeCategories.map((category, index) => (
                    <Pressable
                      key={category.id}
                      testID={`home-category-${category.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`استكشف ${category.name}`}
                      onPress={() =>
                        router.push({
                          pathname: '/category/[id]',
                          params: { id: category.id },
                        })
                      }
                      style={styles.categoryCard}
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          {
                            backgroundColor:
                              accentSurfaces[index % accentSurfaces.length],
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={category.icon}
                          size={26}
                          color={colors.primaryDark}
                          accessibilityElementsHidden
                        />
                      </View>
                      <Text style={styles.categoryName}>
                        {categoryShortLabels[category.id] ?? category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.providersSection}>
                {sectionHeading('خدمات في بلدنا', 'عرض الكل')}
                {visibleProviders.length === 0 ? (
                  <EmptyState
                    title="لسه مفيش خدمات منشورة"
                    message="تقدر تستكشف الأقسام أو تضيف خدمتك لحد ما تتضاف خدمات جديدة."
                    actionLabel="استكشف الخدمات"
                    onAction={() =>
                      router.push({
                        pathname: '/explore',
                        params: { filter: 'all' },
                      })
                    }
                  />
                ) : null}
                {visibleProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    presentation="home"
                    category={categories.find(
                      (category) => category.id === provider.categoryId,
                    )}
                    onPress={() =>
                      router.push({
                        pathname: '/provider/[id]',
                        params: { id: provider.id },
                      })
                    }
                  />
                ))}
              </View>
              <AddServiceCard onPress={() => router.push('/provider/join')} />
              <EmergencyShortcut />
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    bodyFrame: { flex: 1 },
    content: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    hero: { gap: spacing.sm + spacing.xs },
    heroTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    searchAccessory: {
      width: 44,
      height: 44,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceContainer,
    },
    section: { gap: spacing.xs },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm + spacing.xs,
    },
    sectionTitle: {
      ...typography.title,
      color: c.textPrimary,
      flexShrink: 1,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    sectionAction: {
      minHeight: 44,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sectionActionText: {
      ...typography.caption,
      color: c.primaryDark,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    categoryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    categoryCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 15,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      alignItems: 'center',
    },
    categoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryName: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      lineHeight: 22,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    providersSection: { gap: spacing.sm },
    searchResults: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    searchResult: {
      minHeight: 60,
      padding: spacing.sm + spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    lastSearchResult: {
      borderBottomWidth: 0,
    },
    searchResultIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    searchResultCopy: { flex: 1, minWidth: 0, gap: 2 },
    searchResultHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    searchResultTitle: {
      ...typography.label,
      flex: 1,
      minWidth: 0,
      color: c.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    searchResultTypePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: c.surfaceLow,
    },
    searchResultType: { ...typography.caption, color: c.muted },
    searchResultDetail: {
      ...typography.caption,
      color: c.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    searchStatus: { gap: spacing.sm },
  });
