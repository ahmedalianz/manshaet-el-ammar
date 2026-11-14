import { MotionPressable as Pressable } from '../../components/ui/Motion';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../discovery/components/DiscoveryUi';
import { spacing } from '../../theme/spacing';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export function ProviderPage({
  title,
  children,
  backgroundColor,
}: {
  title: string;
  children: ReactNode;
  backgroundColor?: string;
}) {
  const { colors } = useAppTheme();
  const providerStyles = useProviderStyles();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: backgroundColor ?? colors.background }}
      edges={['top', 'bottom']}
    >
      <BackHeader title={title} />
      <ScrollView
        contentContainerStyle={[providerStyles.content, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function ProviderAction({
  title,
  onPress,
  secondary = false,
  disabled = false,
  destructive = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const { colors } = useAppTheme();
  const providerStyles = useProviderStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        providerStyles.action,
        secondary && providerStyles.secondaryAction,
        destructive && {
          backgroundColor: colors.errorContainer,
          borderWidth: 1,
          borderColor: colors.error,
        },
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text
        style={[
          providerStyles.actionText,
          secondary && { color: colors.primaryDark },
          destructive && { color: colors.error },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const createProviderStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    card: {
      padding: spacing.md,
      gap: spacing.md,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    heading: {
      ...typography.screenTitle,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    label: {
      ...typography.label,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    notice: {
      ...typography.caption,
      color: colors.textSecondary,
      backgroundColor: colors.secondary,
      borderRadius: 14,
      padding: spacing.md,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    action: {
      minHeight: 52,
      justifyContent: 'center',
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.actionBackground,
    },
    secondaryAction: { backgroundColor: colors.surfaceContainer },
    actionText: {
      ...typography.button,
      color: colors.onPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });

export function useProviderStyles() {
  return useThemedStyles(createProviderStyles);
}
