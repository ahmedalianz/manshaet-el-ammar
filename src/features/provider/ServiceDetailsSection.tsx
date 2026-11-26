import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import type { IconName } from '../discovery/types';

export function ServiceDetailsSection({
  title,
  icon,
  initiallyExpanded = false,
  subtitle,
  badge,
  accessibilityHint,
  children,
}: {
  title: string;
  icon: IconName;
  initiallyExpanded?: boolean;
  subtitle?: string;
  badge?: ReactNode;
  accessibilityHint?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.heading}
      >
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {badge}
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
      </MotionPressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceContainer,
      shadowColor: colors.primaryDark,
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    heading: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 60,
    },
    headingCopy: { flex: 1, gap: 0 },
    subtitle: {
      ...typography.caption,
      fontSize: 11,
      lineHeight: 19,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    title: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    body: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  });
