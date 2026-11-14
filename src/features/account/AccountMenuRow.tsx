import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../discovery/types';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export function AccountMenuRow({
  title,
  icon,
  subtitle,
  onPress,
  destructive = false,
  badge,
  badgeLabel,
  grouped = false,
  disabled = false,
}: {
  title: string;
  icon: IconName;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  badge?: number;
  badgeLabel?: string;
  grouped?: boolean;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        badge !== undefined
          ? `${title}، ${badgeLabel ?? `${badge} طلبات جديدة`}`
          : title
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        grouped && styles.groupedRow,
        pressed && styles.pressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      <View
        style={[
          styles.icon,
          grouped && styles.groupedIcon,
          destructive && styles.destructiveIcon,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={23}
          color={destructive ? colors.error : colors.primaryDark}
          accessibilityElementsHidden
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && styles.destructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {badge !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge.toLocaleString('ar-EG')}</Text>
        </View>
      ) : null}
      {!disabled ? (
        <MaterialCommunityIcons
          name="chevron-left"
          size={22}
          color={colors.muted}
          accessibilityElementsHidden
        />
      ) : null}
    </Pressable>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    groupedRow: { borderRadius: 0, minHeight: 76 },
    groupedIcon: { width: 44, height: 44, borderRadius: 14 },
    destructiveIcon: { backgroundColor: colors.errorContainer },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      ...typography.label,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    subtitle: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    destructive: { color: colors.error },
    badge: {
      minWidth: 26,
      minHeight: 26,
      paddingHorizontal: spacing.sm,
      borderRadius: 13,
      backgroundColor: colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: { ...typography.caption, color: colors.primaryDark },
    pressed: { opacity: 0.75 },
  });
