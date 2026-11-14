import { useCompactHeader } from '../../components/brand/useCompactHeader';
import { CommunityHeader } from '../../components/brand/CommunityHeader';
import { AddServiceCard } from '../../features/discovery/components/AddServiceCard';
import { LocalHeritageBanner } from '../../features/discovery/components/LocalHeritageBanner';
import { EmergencyShortcut } from '../../features/emergency/EmergencyShortcut';
import { useDirectorySearch } from '../../features/discovery/DirectoryPagination';
import { ProviderAction } from '../../features/provider/ProviderPage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const { colors } = useAppTheme();
  const { compact, ...headerScroll } = useCompactHeader();
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
  const shortLabels: Record<string, string> = {
    electricity: 'كهرباء',
    plumbing: 'سباكة',
    pharmacies: 'صيدليات',
    clinics: 'أطباء',
    carpentry: 'نجارة',
    shops: 'محلات',
    transport: 'نقل',
    education: 'تعليم',
  };
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
        <ScrollView contentContainerStyle={styles.content}>
          <LoadingState />
          <EmergencyShortcut />
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <CommunityHeader
        compact={compact}
        signedIn={Boolean(userId)}
        onAccount={() =>
          router.push(userId ? '/account/profile' : '/provider/sign-in')
        }
      />
      <ScrollView
        testID="home-scroll"
        {...headerScroll}
        contentContainerStyle={styles.content}
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
            containerStyle={styles.searchBox}
            textStyle={styles.searchText}
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
          {query.trim() ? (
            <View style={styles.searchResults}>
              {results.length ? (
                results.map((result) => {
                  const label =
                    result.type === 'category'
                      ? result.category.name
                      : result.provider.name;
                  const detail =
                    result.type === 'category'
                      ? result.category.description
                      : result.provider.serviceTitle;
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
                      style={styles.searchResult}
                    >
                      <MaterialCommunityIcons
                        name={
                          result.type === 'category'
                            ? 'shape-outline'
                            : 'account-outline'
                        }
                        size={20}
                        color={colors.primaryDark}
                      />
                      <View style={styles.searchResultCopy}>
                        <View style={styles.searchResultHeading}>
                          <Text style={styles.searchResultTitle}>{label}</Text>
                          <Text style={styles.searchResultType}>
                            {result.type === 'category' ? 'قسم' : 'مقدم خدمة'}
                          </Text>
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
                })
              ) : publicHasMore || publicError || publicFetching ? null : (
                <View style={styles.noResults}>
                  <View style={styles.noResultsIcon}>
                    <MaterialCommunityIcons
                      name="text-search"
                      size={32}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={styles.noResultsTitle}
                  >
                    ملقيناش اللي بتدور عليه
                  </Text>
                  <Text style={styles.noResultsMessage}>
                    جرّب اسم أقصر أو نوع الخدمة، زي سباك أو نجار.
                  </Text>
                  <View style={styles.searchSuggestions}>
                    {homeCategories.slice(0, 3).map((category) => (
                      <Pressable
                        key={category.id}
                        accessibilityRole="button"
                        accessibilityLabel={`ابحث عن ${category.name}`}
                        onPress={() => setQuery(category.name)}
                        style={styles.searchSuggestion}
                      >
                        <Text style={styles.searchSuggestionText}>
                          {shortLabels[category.id] ?? category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setQuery('')}
                    style={styles.clearSearch}
                  >
                    <Text style={styles.searchSuggestionText}>
                      امسح البحث وارجع للرئيسية
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
          {searching && (publicHasMore || publicFetching) && !publicError ? (
            <LoadingState compact label="بندور في باقي الخدمات…" />
          ) : null}
          {searching && publicError ? (
            <View style={styles.searchStatus}>
              <Text accessibilityRole="alert" style={styles.searchResultDetail}>
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
                      {shortLabels[category.id] ?? category.name}
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
    </SafeAreaView>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
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
    searchBox: {
      minHeight: 52,
      borderRadius: 14,
      paddingHorizontal: spacing.sm + spacing.xs,
      borderColor: c.border,
      backgroundColor: c.surface,
      gap: spacing.sm,
    },
    searchText: {
      minHeight: 50,
      fontSize: 14,
      lineHeight: 24,
      paddingVertical: spacing.sm,
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
      borderRadius: 14,
      overflow: 'hidden',
    },
    searchResult: {
      minHeight: 56,
      padding: spacing.sm + spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    searchResultCopy: { flex: 1, minWidth: 0 },
    searchResultHeading: {
      flexDirection: 'row',
      alignItems: 'baseline',
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
    searchResultType: { ...typography.caption, color: c.muted },
    searchResultDetail: {
      ...typography.caption,
      color: c.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    searchStatus: { gap: spacing.sm },
    noResults: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
    },
    noResultsIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: c.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    noResultsTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    noResultsMessage: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    searchSuggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    searchSuggestion: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      backgroundColor: c.surfaceContainer,
      justifyContent: 'center',
    },
    searchSuggestionText: {
      ...typography.label,
      color: c.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    clearSearch: {
      minHeight: 44,
      justifyContent: 'center',
      padding: spacing.sm,
    },
  });
