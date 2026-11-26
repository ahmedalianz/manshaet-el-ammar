import {
  MotionPressable as Pressable,
  MotionReveal,
} from '../../../components/ui/Motion';
import { SearchEmptyArtwork } from '../../../components/brand/SearchEmptyArtwork';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  View,
} from 'react-native';

import type { ThemeColors } from '../../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { IconName, ServiceCategory } from '../types';

type SearchInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onSubmit?: (text: string) => void;
};

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  accessory,
  containerStyle,
  textStyle,
  onSubmit,
}: SearchInputProps) {
  const styles = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.searchInput,
        containerStyle,
        focused && { borderColor: colors.primary },
      ]}
    >
      <MaterialCommunityIcons
        name="magnify"
        size={24}
        color={colors.primary}
        accessibilityElementsHidden
      />
      <TextInput
        keyboardAppearance={resolved}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        ref={input}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.searchText, textStyle]}
        textAlign="right"
        returnKeyType="search"
        onSubmitEditing={(event) => {
          if (onSubmit) onSubmit(event.nativeEvent.text);
          else Keyboard.dismiss();
        }}
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="مسح البحث"
          onPress={() => {
            onChangeText('');
            input.current?.focus();
          }}
          style={{
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons
            name="close"
            size={22}
            color={colors.primary}
            accessibilityElementsHidden
          />
        </Pressable>
      ) : null}
      {accessory}
    </View>
  );
}

export function CategoryIcon({
  icon,
  size = 24,
}: {
  icon: IconName;
  size?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={styles.categoryIcon}>
      <MaterialCommunityIcons
        name={icon}
        size={size}
        color={colors.primaryDark}
        accessibilityElementsHidden
      />
    </View>
  );
}

export function SectionTitle({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={[styles.actionLabel, { textAlign: 'right' }]}>
            {actionLabel.replaceAll(' ', '\u00a0')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScreenHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.screenHeading}>
      <Text accessibilityRole="header" style={styles.screenTitle}>
        {title}
      </Text>
      <Text style={styles.bodyText}>{subtitle}</Text>
    </View>
  );
}

export function CategoryCard({
  category,
  onPress,
  layout = 'row',
}: {
  category: ServiceCategory;
  onPress: () => void;
  layout?: 'row' | 'grid';
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const isGrid = layout === 'grid';
  const { width, fontScale } = useWindowDimensions();
  const readableWidth = width / fontScale;
  const gridWidth =
    readableWidth < 220 ? '100%' : readableWidth < 380 ? '48%' : '22%';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`استكشف ${category.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryCard,
        isGrid
          ? [styles.categoryGridCard, { width: gridWidth }]
          : styles.categoryRowCard,
        pressed && styles.pressed,
      ]}
    >
      {isGrid ? (
        <>
          <CategoryIcon icon={category.icon} />
          <Text style={styles.categoryGridName}>{category.name}</Text>
        </>
      ) : (
        <>
          <CategoryIcon icon={category.icon} />
          <View style={styles.categoryCopy}>
            <Text style={styles.cardTitle}>{category.name}</Text>
            <Text numberOfLines={1} style={styles.categoryDescription}>
              {category.description}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={colors.muted}
            accessibilityElementsHidden
          />
        </>
      )}
    </Pressable>
  );
}

export function DemoNotice({ text }: { text: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={styles.demoNotice}>
      <MaterialCommunityIcons
        name="information-outline"
        size={20}
        color={colors.bannerIcon}
        accessibilityElementsHidden
      />
      <Text style={styles.demoNoticeText}>{text}</Text>
    </View>
  );
}

export function EmptyState({
  title = 'مفيش نتائج مطابقة',
  message = 'جرّب تبحث بكلمة تانية',
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <MotionReveal
      animateOnMount
      changeKey={`${title}|${message}`}
      style={styles.emptyState}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <SearchEmptyArtwork />
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.emptyAction}
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </MotionReveal>
  );
}

export function BackHeader({ title }: { title: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={styles.backHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="رجوع"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons
          name="arrow-right"
          size={24}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
      </Pressable>
      <Text accessibilityRole="header" style={styles.backTitle}>
        {title}
      </Text>
      <View style={styles.headerSpacer} accessibilityElementsHidden />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    searchInput: {
      minHeight: 54,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchText: {
      flex: 1,
      minHeight: 52,
      color: colors.textPrimary,
      ...typography.label,
      writingDirection: 'rtl',
    },
    categoryIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLow,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    actionLabel: {
      ...typography.caption,
      color: colors.primaryDark,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    screenHeading: { gap: spacing.xs, alignItems: 'flex-start' },
    screenTitle: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    bodyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    categoryCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceContainer,
    },
    categoryRowCard: {
      minHeight: 82,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    categoryGridCard: {
      minHeight: 84,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    categoryGridName: {
      ...typography.caption,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    categoryCopy: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
    cardTitle: {
      ...typography.title,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    categoryDescription: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    demoNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.bannerBackground,
    },
    demoNoticeText: {
      ...typography.caption,
      flex: 1,
      color: colors.onBanner,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    emptyState: {
      minHeight: 180,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    emptyTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptyMessage: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptyAction: {
      minHeight: 48,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.actionBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyActionText: {
      ...typography.button,
      color: colors.onPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    backHeader: {
      minHeight: 72,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.header,
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLow,
    },
    headerSpacer: { width: 48, height: 48 },
    backTitle: {
      ...typography.sectionTitle,
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    pressed: { opacity: 0.78 },
  });
