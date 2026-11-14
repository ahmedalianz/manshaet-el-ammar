import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export function LoadingState({
  label = 'بنحمّل البيانات…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.container, compact && styles.compact]}
    >
      <ActivityIndicator
        size={compact ? 'small' : 'large'}
        color={colors.primary}
      />
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  compact: { flex: 0, padding: 12 },
  label: { ...typography.body, textAlign: 'center', writingDirection: 'rtl' },
});
