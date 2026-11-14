import { router } from 'expo-router';
import { EmptyState } from '../../features/discovery/components/DiscoveryUi';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';

type PlaceholderScreenProps = {
  title: string;
  message: string;
};

export function PlaceholderScreen({ title, message }: PlaceholderScreenProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.content}>
        <EmptyState
          title={title}
          message={message}
          actionLabel="ارجع للرئيسية"
          onAction={() => router.replace('/(tabs)')}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
  });
