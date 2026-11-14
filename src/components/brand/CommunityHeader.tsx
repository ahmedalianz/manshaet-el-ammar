import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable, useReducedMotion } from '../ui/Motion';
import { useAppTheme } from '../../theme/ThemeProvider';
import { fontFamily } from '../../theme/typography';
import { CommunityArtwork } from './CommunityArtwork';

export function CommunityHeader({
  signedIn,
  onAccount,
  disabled = false,
  pageTitle,
  compact = false,
}: {
  signedIn: boolean;
  onAccount: () => void;
  disabled?: boolean;
  pageTitle?: string;
  compact?: boolean;
}) {
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const reduced = useReducedMotion();
  const progress = useSharedValue(compact ? 1 : 0);
  const { fontScale } = useWindowDimensions();
  const [subtitleHeight, setSubtitleHeight] = useState(24 * fontScale);
  useEffect(() => {
    cancelAnimation(progress);
    if (reduced !== false) {
      progress.set(compact ? 1 : 0);
      return;
    }
    progress.set(
      withTiming(compact ? 1 : 0, {
        duration: compact ? 220 : 180,
        easing: Easing.out(Easing.cubic),
      }),
    );
    return () => cancelAnimation(progress);
  }, [compact, reduced, progress]);
  const headerStyle = useAnimatedStyle(() => ({
    minHeight: 124 - 60 * progress.value,
    paddingTop: 10 - 2 * progress.value,
    paddingBottom: 46 - 38 * progress.value,
  }));
  const artworkStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    width: 54 - 12 * progress.value,
    height: 54 - 12 * progress.value,
    padding: 5 - 2 * progress.value,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    fontSize: 22 - 4 * progress.value,
    lineHeight: 34 - 6 * progress.value,
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    height: subtitleHeight * (1 - progress.value),
    opacity: 1 - progress.value,
  }));
  return (
    <Animated.View
      style={[
        styles.header,
        headerStyle,
        { backgroundColor: isDark ? '#203746' : '#E6F2FA' },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.artwork, artworkStyle]}
      >
        <CommunityArtwork dark={isDark} />
      </Animated.View>
      <View style={styles.identity}>
        <Animated.View
          style={[
            styles.logoCircle,
            logoStyle,
            { backgroundColor: '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <Image
            source={require('../../../assets/images/brand-emblem.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="شعار منشأة العمار"
          />
        </Animated.View>
        <View style={styles.copy}>
          <Animated.Text
            style={[styles.name, titleStyle, { color: colors.primaryDark }]}
          >
            منشأة العمار
          </Animated.Text>
          <Animated.View
            accessibilityElementsHidden={compact && !pageTitle}
            importantForAccessibility={
              compact && !pageTitle ? 'no-hide-descendants' : 'auto'
            }
            style={
              !pageTitle ? [styles.subtitleClip, subtitleStyle] : undefined
            }
          >
            <Text
              onLayout={({ nativeEvent }) => {
                const height = nativeEvent.layout.height;
                if (height > 0 && Math.abs(height - subtitleHeight) > 0.5)
                  setSubtitleHeight(height);
              }}
              accessibilityRole={pageTitle ? 'header' : undefined}
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {pageTitle ?? 'بلدنا أقرب'}
            </Text>
          </Animated.View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={signedIn ? 'الملف الشخصي' : 'تسجيل الدخول'}
          disabled={disabled}
          onPress={onAccount}
          style={[
            styles.account,
            {
              backgroundColor: colors.actionBackground,
              borderColor: colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={25}
            color={colors.onPrimary}
            accessibilityElementsHidden
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 124,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 46,
  },
  // Keep the SVG viewport stable; only its opacity changes as the header resizes.
  artwork: { position: 'absolute', start: 0, end: 0, top: 0, height: 124 },
  subtitleClip: { overflow: 'hidden' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 5,
    borderWidth: 2,
  },
  logo: { width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 34,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 24,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  account: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
