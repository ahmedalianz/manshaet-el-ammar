import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import {
  I18nManager,
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

export const HEADER_COLLAPSE_DISTANCE = 60;

export function communityHeaderExpandedHeight(fontScale = 1) {
  return Math.max(124, Math.ceil(57 + 58 * fontScale));
}

export function CommunityHeader({
  signedIn,
  onAccount,
  disabled = false,
  pageTitle,
  compact = false,
  scrollY,
  overlay = false,
}: {
  signedIn: boolean;
  onAccount: () => void;
  disabled?: boolean;
  pageTitle?: string;
  compact?: boolean;
  scrollY?: SharedValue<number>;
  overlay?: boolean;
}) {
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const borderColor = isDark ? '#2B4B57' : '#C9DCE8';
  const reduced = useReducedMotion();
  const progress = useSharedValue(compact ? 1 : 0);
  const { fontScale } = useWindowDimensions();
  const [subtitleHeight, setSubtitleHeight] = useState(24 * fontScale);
  useEffect(() => {
    cancelAnimation(progress);
    if (reduced !== false || scrollY) {
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
  }, [compact, reduced, progress, scrollY]);
  const headerStyle = useAnimatedStyle(() => {
    const p =
      scrollY && reduced === false
        ? Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE))
        : progress.value;
    return {
      minHeight: 124 - 60 * p,
      paddingTop: 10 - 2 * p,
      paddingBottom: 46 - 38 * p,
      borderBottomWidth: p > 0.85 ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: borderColor,
    };
  });
  const artworkStyle = useAnimatedStyle(() => {
    const p =
      scrollY && reduced === false
        ? Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE))
        : progress.value;
    return {
      opacity: 1 - p,
    };
  });
  const logoStyle = useAnimatedStyle(() => {
    const p =
      scrollY && reduced === false
        ? Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE))
        : progress.value;
    return {
      transform: [{ scale: 1 - (10 / 54) * p }],
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    const p =
      scrollY && reduced === false
        ? Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE))
        : progress.value;
    return {
      transform: [{ scale: 1 - (4 / 22) * p }],
    };
  });
  const subtitleStyle = useAnimatedStyle(() => {
    const p =
      scrollY && reduced === false
        ? Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE))
        : progress.value;
    return {
      height: subtitleHeight * (1 - p),
      opacity: Math.max(0, 1 - p * 1.4),
    };
  });
  return (
    <Animated.View
      style={[
        styles.header,
        overlay && styles.overlayHeader,
        headerStyle,
        { backgroundColor: isDark ? '#122E38' : '#E6F2FA' },
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
            {
              backgroundColor: '#FFFFFF',
              borderColor: isDark ? '#6C9DA7' : '#B4CEDB',
            },
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
            style={[
              styles.name,
              titleStyle,
              { color: isDark ? '#E0F3F4' : colors.primaryDark },
            ]}
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
              style={[
                styles.subtitle,
                !pageTitle && styles.measuredSubtitle,
                { color: isDark ? '#B0CDD3' : colors.textSecondary },
              ]}
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
              backgroundColor: isDark ? '#244651' : colors.actionBackground,
              borderColor: isDark ? '#6C9DA7' : colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={25}
            color={isDark ? '#D1EFF1' : colors.onPrimary}
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
  overlayHeader: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 10,
  },
  // Keep the SVG viewport stable; only its opacity changes as the header resizes.
  artwork: { position: 'absolute', start: 0, end: 0, top: 0, height: 124 },
  subtitleClip: { overflow: 'hidden' },
  // Measure intrinsic text height independently of the collapsing clip.
  measuredSubtitle: { position: 'absolute', top: 0, start: 0, end: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 5,
    borderWidth: 2,
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: {
    alignSelf: 'flex-start',
    transformOrigin: I18nManager.isRTL ? 'right center' : 'left center',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
