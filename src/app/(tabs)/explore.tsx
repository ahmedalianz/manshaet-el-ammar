import { useCompactHeader } from '../../components/brand/useCompactHeader';
import { CommunityHeader } from '../../components/brand/CommunityHeader';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable as BackdropPressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import { useDirectorySearch } from '../../features/discovery/DirectoryPagination';
import { ProviderAction } from '../../features/provider/ProviderPage';
import { searchProviders } from '../../features/discovery/search';
import type {
  CategoryGroup,
  ServiceCategory,
} from '../../features/discovery/types';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

type GroupFilter = CategoryGroup | 'transport' | 'education';
const groupFilters: { id: GroupFilter; label: string }[] = [
  { id: 'trades', label: 'مهن وحرف' },
  { id: 'health', label: 'صحة وطب' },
  { id: 'education', label: 'تعليم ودروس' },
  { id: 'shops', label: 'محلات' },
  { id: 'transport', label: 'مواصلات ونقل' },
];

function inGroup(category: ServiceCategory, filter?: GroupFilter) {
  if (!filter) return true;
  if (filter === 'transport' || filter === 'education')
    return category.id === filter;
  return category.group === filter;
}

export default function ExploreScreen() {
  const { compact, ...headerScroll } = useCompactHeader();
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
      <CommunityHeader
        compact={compact}
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
            <RemoteDataNotice />
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
            {selectedGroup ? (
              <View style={styles.activeGroup}>
                <Text style={styles.activeGroupText}>
                  {
                    groupFilters.find((item) => item.id === selectedGroup)
                      ?.label
                  }
                </Text>
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
              keyboardShouldPersistTaps="handled"
            >
              {categoryChip(undefined)}
              {categories.map(categoryChip)}
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
          !publicError && !publicHasMore && !publicFetching ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons
                  name={hasFilters ? 'text-search' : 'storefront-outline'}
                  size={32}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
              </View>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {visibleEmptyCopy}
              </Text>
              <Text style={styles.emptyMessage}>{emptyMessage}</Text>
              {hasFilters ? (
                <ProviderAction title="شوف كل الخدمات" onPress={clearFilters} />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="تواصل مع مشرفي الدليل"
                onPress={() => router.push('/info/contact')}
                style={styles.supportLink}
              >
                <Text style={styles.supportText}>محتاج مساعدة؟ كلمنا</Text>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={18}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
              </Pressable>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          publicHasMore || publicFetching ? (
            <View style={styles.footer}>
              {publicFetching ? (
                <LoadingState
                  compact
                  label={
                    hasFilters ? 'بندور في باقي الخدمات…' : 'بنحمّل خدمات أكتر…'
                  }
                />
              ) : (
                <ProviderAction
                  secondary
                  title={
                    publicError ? 'جرّب تحميل باقي الخدمات' : 'تحميل خدمات أكتر'
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

      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.backdrop}>
          <BackdropPressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق النافذة"
            onPress={() => setFiltersOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.filterSheet}>
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
                    setFiltersOpen(false);
                  }}
                  style={[
                    styles.option,
                    selectedGroup === item.id && styles.selectedChip,
                  ]}
                >
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
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
      borderRadius: 18,
      backgroundColor: c.surfaceContainer,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    activeGroupText: { ...typography.caption, color: c.primaryDark },
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
    emptyCard: {
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 28,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceContainer,
      marginBottom: 4,
    },
    emptyTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    footer: { marginTop: 18, gap: 12 },
    emptyMessage: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    supportLink: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    supportText: {
      ...typography.body,
      color: c.primaryDark,
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
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: c.surface,
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
    filterLabel: { ...typography.body, color: c.textPrimary },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      minHeight: 44,
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
