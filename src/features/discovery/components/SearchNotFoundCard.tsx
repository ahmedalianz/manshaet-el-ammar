import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CommunityArtwork } from '../../../components/brand/CommunityArtwork';
import { SearchEmptyArtwork } from '../../../components/brand/SearchEmptyArtwork';
import { MotionPressable as Pressable } from '../../../components/ui/Motion';
import type { ThemeColors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { typography } from '../../../theme/typography';
import { ProviderAction } from '../../provider/ProviderPage';
import type { ServiceCategory } from '../types';

export const categoryShortLabels: Record<string, string> = {
  electricity: 'كهرباء',
  plumbing: 'سباكة',
  pharmacies: 'صيدليات',
  clinics: 'أطباء',
  carpentry: 'نجارة',
  shops: 'محلات',
  transport: 'نقل',
  education: 'تعليم',
};

export function SearchNotFoundCard({
  title,
  message,
  variant = 'search',
  query,
  filterLabel,
  otherCategoriesMatchCount,
  onSearchAllCategories,
  suggestions,
  onSelectSuggestion,
  primaryActionLabel,
  onPrimaryAction,
  onContactSupport,
}: {
  title: string;
  message: string;
  variant?: 'search' | 'directory-empty';
  query?: string;
  filterLabel?: string;
  otherCategoriesMatchCount?: number;
  onSearchAllCategories?: () => void;
  suggestions?: ServiceCategory[];
  onSelectSuggestion?: (category: ServiceCategory) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onContactSupport?: () => void;
}) {
  const { colors, resolved } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const dark = resolved === 'dark';
  const trimmedQuery = query?.trim();
  const contextParts = [
    trimmedQuery ? `«\u2068${trimmedQuery}\u2069»` : null,
    filterLabel ?? null,
  ].filter(Boolean);
  const suggestionSurfaces = [
    colors.categoryBlue,
    colors.categoryTeal,
    colors.categoryLavender,
  ];
  const visibleSuggestions = suggestions?.slice(0, 3) ?? [];

  return (
    <View style={styles.card}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.waveBackdrop}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 76"
          preserveAspectRatio="none"
          accessible={false}
        >
          <Path
            d="M0 0H400V46Q295 72 195 44T0 58Z"
            fill={dark ? '#213B4D' : '#E6F1F9'}
            opacity={0.9}
          />
        </Svg>
      </View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={
          variant === 'directory-empty' ? styles.directoryArt : styles.searchArt
        }
      >
        {variant === 'directory-empty' ? (
          <CommunityArtwork shop dark={dark} />
        ) : (
          <SearchEmptyArtwork />
        )}
      </View>

      {contextParts.length > 0 ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.contextPill}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={15}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
          <Text style={styles.contextPillText}>{contextParts.join(' · ')}</Text>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>

      {(otherCategoriesMatchCount ?? 0) > 0 && onSearchAllCategories ? (
        <View style={styles.crossCategoryBox}>
          <Text style={styles.crossCategoryText}>
            {`لقينا ${otherCategoriesMatchCount!.toLocaleString('ar-EG')} خدمة مطابقة في أقسام تانية`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ابحث في كل الأقسام"
            onPress={onSearchAllCategories}
            style={styles.crossCategoryButton}
          >
            <MaterialCommunityIcons
              name="layers-search-outline"
              size={18}
              color={colors.onPrimary}
              accessibilityElementsHidden
            />
            <Text style={styles.crossCategoryButtonText}>
              ابحث في كل الأقسام
            </Text>
          </Pressable>
        </View>
      ) : null}

      {visibleSuggestions.length > 0 && onSelectSuggestion ? (
        <View style={styles.suggestionsWrap}>
          <View style={styles.suggestionsRow}>
            {visibleSuggestions.map((category, index) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`ابحث عن ${category.name}`}
                onPress={() => onSelectSuggestion(category)}
                style={styles.suggestionTile}
              >
                <View
                  style={[
                    styles.suggestionIcon,
                    {
                      backgroundColor:
                        suggestionSurfaces[index % suggestionSurfaces.length],
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={22}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </View>
                <Text style={styles.suggestionLabel}>
                  {categoryShortLabels[category.id] ?? category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {primaryActionLabel && onPrimaryAction ? (
        <View style={styles.primaryWrap}>
          <ProviderAction
            title={primaryActionLabel}
            onPress={onPrimaryAction}
          />
        </View>
      ) : null}

      {onContactSupport ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تواصل مع مشرفي الدليل"
          onPress={onContactSupport}
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
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      overflow: 'hidden',
    },
    waveBackdrop: {
      position: 'absolute',
      top: 0,
      start: 0,
      end: 0,
      height: 76,
    },
    searchArt: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryArt: {
      width: 120,
      height: 104,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contextPill: {
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.surfaceContainer,
      borderWidth: 1,
      borderColor: c.border,
    },
    contextPillText: {
      ...typography.caption,
      color: c.primaryDark,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    title: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    message: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    crossCategoryBox: {
      width: '100%',
      borderRadius: 16,
      padding: 12,
      backgroundColor: c.surfaceContainer,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.xs,
    },
    crossCategoryText: {
      ...typography.label,
      color: c.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    crossCategoryButton: {
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.actionBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    crossCategoryButtonText: {
      ...typography.button,
      color: c.onPrimary,
      writingDirection: 'rtl',
    },
    suggestionsWrap: {
      width: '100%',
      marginTop: spacing.xs,
    },
    suggestionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    suggestionTile: {
      minWidth: 88,
      minHeight: 84,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    suggestionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionLabel: {
      ...typography.label,
      color: c.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    primaryWrap: {
      alignSelf: 'stretch',
      marginTop: 4,
    },
    supportLink: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
    },
    supportText: {
      ...typography.body,
      color: c.primaryDark,
      writingDirection: 'rtl',
    },
  });
