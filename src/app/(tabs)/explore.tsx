import {
  PhotoViewportProvider,
  usePhotoScroll,
} from '../../features/photos/PhotoViewport';
import { useCompactHeader } from '../../components/brand/useCompactHeader';
import {
  CommunityHeader,
  communityHeaderExpandedHeight,
} from '../../components/brand/CommunityHeader';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable as BackdropPressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { LoadingState } from '../../components/ui/LoadingState';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import { useProviderState } from '../../features/provider/ProviderContext';
import { SearchInput } from '../../features/discovery/components/DiscoveryUi';
import { ProviderCard } from '../../features/discovery/components/ProviderCard';
import { SearchNotFoundCard } from '../../features/discovery/components/SearchNotFoundCard';
import { useDirectorySearch } from '../../features/discovery/DirectoryPagination';
import { ProviderAction } from '../../features/provider/ProviderPage';
import { homeCategoryIds } from '../../features/discovery/data/categories';
import {
  searchCategories,
  searchProviders,
} from '../../features/discovery/search';
import type {
  CategoryGroup,
  ServiceCategory,
} from '../../features/discovery/types';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

type GroupFilter = CategoryGroup | 'transport' | 'education' | 'other';
const groupFilters: { id: GroupFilter; label: string }[] = [
  { id: 'trades', label: 'مهن وحرف' },
  { id: 'health', label: 'صحة وطب' },
  { id: 'education', label: 'تعليم ودروس' },
  { id: 'shops', label: 'محلات' },
  { id: 'transport', label: 'مواصلات ونقل' },
  { id: 'other', label: 'خدمات تانية' },
];

function inGroup(category: ServiceCategory, filter?: GroupFilter) {
  if (!filter) return true;
  if (filter === 'transport' || filter === 'education' || filter === 'other')
    return category.id === filter;
  return category.group === filter;
}

export default function ExploreScreen() {
  return (
    <PhotoViewportProvider>
      <ExploreScreenContent />
    </PhotoViewportProvider>
  );
}
function ExploreScreenContent() {
  const photoScroll = usePhotoScroll();
  const { compact, scrollY, ...headerScroll } = useCompactHeader();
  const { fontScale } = useWindowDimensions();
  const headerHeight = communityHeaderExpandedHeight(fontScale);
  const [screenHeight, setScreenHeight] = useState(0);
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const {
    publicProviders,
    categories,
    publicLoading,
    userId,
    initializing,
    publicError,
    publicHasMore,
    publicFetching,
    loadMorePublicProviders,
  } = useProviderState();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter | undefined>();
  const { filter, search, category, searchRequest } = useLocalSearchParams<{
    filter?: string;
    search?: string;
    category?: string;
    searchRequest?: string;
  }>();
  const appliedRoute = useRef<string | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      const signature = JSON.stringify([
        filter,
        search,
        category,
        searchRequest,
      ]);
      if (appliedRoute.current === signature) return;
      if (category && !categories.length) return;
      appliedRoute.current = signature;
      if (typeof search === 'string') {
        setQuery(search);
        if (!filter && !category) {
          setSelectedCategory(undefined);
          setSelectedGroup(undefined);
        }
      }
      const group = groupFilters.find((item) => item.id === filter)?.id;
      if (filter === 'all') {
        setSelectedCategory(undefined);
        setSelectedGroup(undefined);

        if (typeof search !== 'string') setQuery('');
      } else if (group) {
        setSelectedCategory(undefined);
        setSelectedGroup(group);
        if (typeof search !== 'string') setQuery('');
      } else if (
        typeof category === 'string' &&
        categories.some((item) => item.id === category)
      ) {
        setSelectedCategory(category);
        setSelectedGroup(undefined);
      }
    }, [filter, search, category, categories, searchRequest]),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searching = Boolean(query.trim());
  const hasFilters = Boolean(searching || selectedCategory || selectedGroup);
  useDirectorySearch(query || selectedCategory || selectedGroup || '', {
    hasMore: publicHasMore,
    fetching: publicFetching,
    error: publicError,
    loadMore: loadMorePublicProviders,
  });

  const matchingProviders = useMemo(() => {
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    return searchProviders(
      query,
      selectedCategory,
      publicProviders,
      categories,
    ).filter((provider) => {
      const category = categoryById.get(provider.categoryId);
      return (
        !selectedGroup || Boolean(category && inGroup(category, selectedGroup))
      );
    });
  }, [query, selectedCategory, selectedGroup, publicProviders, categories]);

  const orderedCategories = useMemo(() => {
    if (!searching) return categories;
    const matched = searchCategories(query, publicProviders, categories);
    const matchedIds = new Set(matched.map((item) => item.id));
    return [
      ...matched,
      ...categories.filter((item) => !matchedIds.has(item.id)),
    ];
  }, [searching, query, publicProviders, categories]);

  const otherCategoriesMatchCount = useMemo(() => {
    if (
      !searching ||
      (!selectedCategory && !selectedGroup) ||
      matchingProviders.length > 0
    )
      return 0;
    return searchProviders(query, undefined, publicProviders, categories)
      .length;
  }, [
    searching,
    selectedCategory,
    selectedGroup,
    matchingProviders.length,
    query,
    publicProviders,
    categories,
  ]);

  const quickSuggestions = useMemo(
    () =>
      homeCategoryIds
        .flatMap((id) => {
          const found = categories.find((item) => item.id === id);
          return found ? [found] : [];
        })
        .slice(0, 3),
    [categories],
  );

  const activeGroupLabel = selectedGroup
    ? groupFilters.find((item) => item.id === selectedGroup)?.label
    : undefined;
  const activeFilterLabel = selectedCategory
    ? categories.find((item) => item.id === selectedCategory)?.name
    : activeGroupLabel;

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory(undefined);
    setSelectedGroup(undefined);
  };
  const visibleEmptyCopy = searching
    ? 'ملقيناش خدمات مطابقة لبحثك'
    : selectedCategory || selectedGroup
      ? 'مفيش خدمات منشورة في القسم ده حاليًا'
      : 'لسه مفيش خدمات منشورة';

  const emptyMessage = searching
    ? 'جرّب اسم أقصر أو نوع الخدمة، أو وسّع البحث لكل الأقسام.'
    : hasFilters
      ? 'جرّب قسم تاني، أو شوف كل الخدمات المتاحة في البلد.'
      : 'أول ما تتنشر خدمات جديدة هتلاقيها هنا. محتاج مساعدة؟ إحنا معاك.';

  const categoryChip = (category: ServiceCategory | undefined) => {
    const selected = category
      ? selectedCategory === category.id
      : !selectedCategory && !selectedGroup;
    return (
      <Pressable
        key={category?.id ?? 'all'}
        accessibilityRole="button"
        accessibilityLabel={category?.name ?? 'الكل'}
        accessibilityState={{ selected }}
        onPress={() => {
          setSelectedCategory(category?.id);
          setSelectedGroup(undefined);
        }}
        style={[styles.categoryChip, selected && styles.selectedChip]}
      >
        {category ? (
          <MaterialCommunityIcons
            name={category.icon}
            size={18}
            color={selected ? colors.onPrimary : colors.primaryDark}
            accessibilityElementsHidden
          />
        ) : null}
        <Text style={[styles.chipText, selected && styles.selectedChipText]}>
          {category?.name ?? 'الكل'}
        </Text>
      </Pressable>
    );
  };

  if (publicLoading)
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <LoadingState />
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      testID="discover-screen"
      edges={['top']}
      style={styles.screen}
      onLayout={({ nativeEvent }) => setScreenHeight(nativeEvent.layout.height)}
    >
      <View style={styles.bodyFrame}>
        <CommunityHeader
          overlay
          compact={compact}
          scrollY={scrollY}
          signedIn={Boolean(userId)}
          disabled={initializing}
          onAccount={() =>
            userId
              ? router.push('/account/profile')
              : router.push({
                  pathname: '/provider/sign-in',
                  params: { next: 'more' },
                })
          }
        />

        <FlatList
          testID="discover-list"
          {...headerScroll}
          onScroll={(event) => {
            headerScroll.onScroll(event);
            photoScroll();
          }}
          data={matchingProviders}
          keyExtractor={(provider) => provider.id}
          renderItem={({ item }) => (
            <ProviderCard
              presentation="illustrated"
              provider={item}
              category={categories.find(
                (category) => category.id === item.categoryId,
              )}
              onPress={() =>
                router.push({
                  pathname: '/provider/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              {!searching ||
              publicProviders.some((provider) => provider.cachedAt) ||
              categories.some((category) => category.cachedAt) ? (
                <RemoteDataNotice />
              ) : null}
              <Text accessibilityRole="header" style={styles.title}>
                استكشف الخدمات
              </Text>
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث عن خدمة أو مقدم خدمة..."
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="تصفية الأقسام"
                    accessibilityState={{
                      selected: Boolean(selectedGroup),
                      expanded: filtersOpen,
                    }}
                    onPress={() => setFiltersOpen(true)}
                    style={[
                      styles.filterButton,
                      selectedGroup && styles.selectedFilterButton,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="tune-variant"
                      size={19}
                      color={
                        selectedGroup ? colors.onPrimary : colors.primaryDark
                      }
                      accessibilityElementsHidden
                    />
                    <Text
                      style={[
                        styles.filterButtonText,
                        selectedGroup && styles.selectedChipText,
                      ]}
                      numberOfLines={1}
                    >
                      فلترة
                    </Text>
                  </Pressable>
                }
              />
              {activeGroupLabel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`إزالة فلتر ${activeGroupLabel}`}
                  onPress={() => setSelectedGroup(undefined)}
                  style={styles.activeGroup}
                >
                  <Text style={styles.activeGroupText}>{activeGroupLabel}</Text>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={16}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </Pressable>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChips}
                keyboardShouldPersistTaps="handled"
              >
                {categoryChip(undefined)}
                {orderedCategories.map(categoryChip)}
              </ScrollView>
              <View style={styles.resultsHeading}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  أصحاب الخدمات المتاحة
                </Text>
                {hasFilters ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="مسح الفلاتر"
                    onPress={clearFilters}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearText}>مسح الفلاتر</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            searching && publicError && !publicFetching ? (
              <View style={styles.emptyErrorCard}>
                <Text accessibilityRole="alert" style={styles.emptyMessage}>
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
            ) : !publicError && !publicHasMore && !publicFetching ? (
              <SearchNotFoundCard
                variant={hasFilters ? 'search' : 'directory-empty'}
                title={visibleEmptyCopy}
                message={emptyMessage}
                query={searching ? query : undefined}
                filterLabel={activeFilterLabel}
                otherCategoriesMatchCount={otherCategoriesMatchCount}
                onSearchAllCategories={() => {
                  setSelectedCategory(undefined);
                  setSelectedGroup(undefined);
                }}
                suggestions={searching ? quickSuggestions : undefined}
                onSelectSuggestion={(item) => {
                  setSelectedCategory(undefined);
                  setSelectedGroup(undefined);
                  setQuery(item.name);
                }}
                primaryActionLabel={hasFilters ? 'شوف كل الخدمات' : undefined}
                onPrimaryAction={hasFilters ? clearFilters : undefined}
                onContactSupport={() => router.push('/info/contact')}
              />
            ) : undefined
          }
          ListFooterComponent={
            publicHasMore || publicFetching ? (
              <View style={styles.footer}>
                {publicFetching ? (
                  <LoadingState
                    compact
                    label={
                      hasFilters
                        ? 'بندور في باقي الخدمات…'
                        : 'بنحمّل خدمات أكتر…'
                    }
                  />
                ) : (
                  <ProviderAction
                    secondary
                    title={
                      publicError
                        ? 'جرّب تحميل باقي الخدمات'
                        : 'تحميل خدمات أكتر'
                    }
                    onPress={() => {
                      void loadMorePublicProviders().catch(() => {});
                    }}
                  />
                )}
              </View>
            ) : undefined
          }
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + 16 },
            // Base empty scroll space on the screen, not the resizing header.
            matchingProviders.length === 0 && [
              styles.emptyContent,
              { minHeight: screenHeight },
            ],
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>

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
            accessibilityViewIsModal
            style={styles.filterSheet}
          >
            <View style={styles.sheetHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                تصفية النتائج
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                onPress={() => setFiltersOpen(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textPrimary}
                  accessibilityElementsHidden
                />
              </Pressable>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>نوع الخدمة</Text>
              <View style={styles.filterOptions}>
                {groupFilters.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedGroup === item.id }}
                    onPress={() => {
                      setSelectedGroup(item.id);
                      setSelectedCategory(undefined);
                    }}
                    style={[
                      styles.option,
                      selectedGroup === item.id && styles.selectedChip,
                    ]}
                  >
                    {selectedGroup === item.id ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={colors.onPrimary}
                        accessibilityElementsHidden
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.chipText,
                        selectedGroup === item.id && styles.selectedChipText,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="عرض النتائج"
              onPress={() => setFiltersOpen(false)}
              style={styles.showResults}
            >
              <MaterialCommunityIcons
                name="filter-outline"
                size={22}
                color={colors.onPrimary}
                accessibilityElementsHidden
              />
              <Text style={styles.showResultsText}>عرض النتائج</Text>
            </Pressable>
            {selectedGroup ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedGroup(undefined);
                }}
                style={styles.clearModalButton}
              >
                <Text style={styles.clearText}>مسح فلتر نوع الخدمة</Text>
              </Pressable>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    bodyFrame: { flex: 1 },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
      maxWidth: 960,
      width: '100%',
      alignSelf: 'center',
      flexGrow: 1,
    },
    emptyContent: { paddingBottom: 80 },
    header: { gap: 12, paddingTop: 4, paddingBottom: 2 },
    title: {
      ...typography.screenTitle,
      color: c.textPrimary,
      writingDirection: 'rtl',
    },
    categoryChips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    categoryChip: {
      minHeight: 44,
      maxWidth: 240,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    selectedChip: {
      backgroundColor: c.actionBackground,
      borderColor: c.actionBackground,
    },
    chipText: {
      ...typography.body,
      color: c.textSecondary,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    selectedChipText: { color: c.onPrimary },
    filterButton: {
      minHeight: 44,
      maxWidth: 150,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: c.surfaceContainer,
    },
    selectedFilterButton: { backgroundColor: c.actionBackground },
    filterButtonText: {
      ...typography.caption,
      color: c.primaryDark,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    activeGroup: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceContainer,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    activeGroupText: {
      ...typography.caption,
      color: c.primaryDark,
      writingDirection: 'rtl',
    },
    resultsHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      writingDirection: 'rtl',
    },
    clearButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    clearText: { ...typography.caption, color: c.primaryDark },
    separator: { height: 12 },
    emptyErrorCard: {
      alignItems: 'stretch',
      gap: 12,
      padding: 16,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    footer: { marginTop: 18, gap: 12 },
    emptyMessage: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay,
    },
    filterSheet: {
      gap: 14,
      padding: 20,
      paddingBottom: 32,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      backgroundColor: c.surfaceLow,
    },
    sheetHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      backgroundColor: c.surfaceContainer,
    },
    filterGroup: {
      padding: 16,
      gap: 14,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    showResults: {
      minHeight: 52,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.actionBackground,
    },
    showResultsText: { ...typography.button, color: c.onPrimary },
    filterLabel: { ...typography.body, color: c.textPrimary },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 22,
      backgroundColor: c.surfaceContainer,
    },
    clearModalButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
