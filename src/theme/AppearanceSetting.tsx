import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../components/ui/Motion';
import { spacing } from './spacing';
import { typography } from './typography';
import type { ThemeColors } from './colors';
import {
  useAppTheme,
  useThemedStyles,
  type ThemePreference,
} from './ThemeProvider';
const options: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'حسب إعدادات الجهاز' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
];
export function AppearanceSetting() {
  const { preference, setPreference, persistenceError } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        المظهر
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="مظهر التطبيق"
        style={styles.options}
      >
        {options.map((option) => (
          <MotionPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: preference === option.value }}
            onPress={() => setPreference(option.value)}
            style={[
              styles.option,
              option.value === 'system' && styles.system,
              preference === option.value && styles.selected,
            ]}
          >
            <Text
              style={[
                styles.label,
                preference === option.value && styles.selectedLabel,
              ]}
            >
              {option.label}
            </Text>
          </MotionPressable>
        ))}
      </View>
      {persistenceError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {persistenceError}
        </Text>
      ) : null}
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: 18,
    },
    title: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    options: { flexDirection: 'row', gap: spacing.sm },
    option: {
      flex: 1,
      minHeight: 48,
      padding: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.secondaryAction,
    },
    system: { flex: 2 },
    selected: { backgroundColor: colors.actionBackground },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    selectedLabel: { color: colors.onPrimary },
    error: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
  });
