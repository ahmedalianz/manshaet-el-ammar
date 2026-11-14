import Svg, { Path } from 'react-native-svg';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../../components/ui/Motion';
import { CommunityArtwork } from '../../../components/brand/CommunityArtwork';
import { useAppTheme } from '../../../theme/ThemeProvider';
import { typography } from '../../../theme/typography';

export function AddServiceCard({ onPress }: { onPress: () => void }) {
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const largeText = width / fontScale < 270;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#203D50' : '#E1F0FA',
          borderColor: colors.border,
        },
      ]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 160"
          preserveAspectRatio="none"
          accessible={false}
        >
          <Path
            d="M0 115Q85 103 192 136T400 117V160H0Z"
            fill={isDark ? '#335B73' : '#B9D8EC'}
            opacity=".75"
          />
        </Svg>
      </View>
      <View style={[styles.row, largeText && styles.stackedRow]}>
        <View style={[styles.copy, largeText && styles.stackedCopy]}>
          <Text style={[styles.title, { color: colors.primaryDark }]}>
            عندك خدمة أو محل في البلد؟
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            ضيف خدمتك مجانًا عشان أهالي البلد يقدروا يتواصلوا معاك.
          </Text>
        </View>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.art}
        >
          <CommunityArtwork shop dark={isDark} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ضيف خدمتك"
        onPress={onPress}
        style={[
          styles.button,
          {
            backgroundColor: colors.actionBackground,
            borderColor: colors.surface,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="plus-circle-outline"
          size={20}
          color={colors.onPrimary}
          accessibilityElementsHidden
        />
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
          ضيف خدمتك
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    minHeight: 160,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stackedRow: { flexDirection: 'column', alignItems: 'stretch' },
  art: { width: 96, height: 104, alignSelf: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  stackedCopy: { flex: 0 },
  title: {
    ...typography.sectionTitle,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  body: { ...typography.body, writingDirection: 'rtl', textAlign: 'auto' },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttonText: {
    ...typography.label,
    flexShrink: 1,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});
