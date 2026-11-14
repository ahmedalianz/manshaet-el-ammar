import { CommunityArtwork } from '../../components/brand/CommunityArtwork';
import { AnimatedSuccessCheck } from '../../components/ui/AnimatedSuccessCheck';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable, useReducedMotion } from '../../components/ui/Motion';
import { BackHeader } from '../../features/discovery/components/DiscoveryUi';
import { useProviderState } from '../../features/provider/ProviderContext';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// One short entrance per mount; unrelated theme/state renders never replay it.
function useEntrance(enabled: boolean) {
  const reduced = useReducedMotion();
  const entered = useRef(false);
  const [values] = useState(() =>
    Array.from({ length: 3 }, () => new Animated.Value(1)),
  );
  useEffect(() => {
    if (reduced === null || !enabled) return;
    if (reduced || entered.current) {
      values.forEach((value) => {
        value.stopAnimation();
        value.setValue(1);
      });
      entered.current = true;
      return;
    }
    entered.current = true;
    values.forEach((value) => value.setValue(0));
    const durations = [250, 250, 280];
    const delays = [70, 110, 150];
    const animation = Animated.parallel(
      values.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: durations[index],
          delay: delays[index],
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ),
    );
    animation.start();
    return () => {
      animation.stop();
      values.forEach((value) => value.setValue(1));
    };
  }, [reduced, values, enabled]);
  return values;
}
function entrance(value: Animated.Value, rise = 0, scale = 1) {
  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [rise, 0],
        }),
      },
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [scale, 1],
        }),
      },
    ],
  };
}
export default function SubmissionSuccessScreen() {
  const { colors } = useAppTheme();
  const s = useThemedStyles(createStyles);
  const { userId, requests, configured } = useProviderState();
  const { providerId } = useLocalSearchParams<{ providerId?: string }>();
  const submittedRequest =
    configured && userId && providerId
      ? requests?.find(
          (request) =>
            request.providerId === providerId &&
            request.ownerId === userId &&
            request.status === 'pending',
        )
      : undefined;
  const hasSubmission = Boolean(submittedRequest);
  const motion = useEntrance(hasSubmission);
  const announced = useRef(false);
  useEffect(() => {
    if (!hasSubmission || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(
      'طلبك وصلنا وهو دلوقتي مستني المراجعة.',
    );
  }, [hasSubmission]);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
      <BackHeader title="طلبك وصلنا" />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.hero}>
          {hasSubmission ? (
            <View
              style={{
                width: '100%',
                height: 150,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0.4,
                }}
                pointerEvents="none"
                accessibilityElementsHidden
              >
                <CommunityArtwork />
              </View>
              <AnimatedSuccessCheck />
            </View>
          ) : null}
          <Animated.View style={entrance(motion[0])}>
            <Text accessibilityRole="header" style={s.headline}>
              {hasSubmission ? 'طلبك وصلنا!' : 'مفيش طلب مسجل في الجلسة دي'}
            </Text>
          </Animated.View>
          <Animated.View style={entrance(motion[1])}>
            <Text style={s.description}>
              {hasSubmission
                ? 'طلبك وصلنا وهنراجعه. بعد الموافقة هتظهر خدمتك لأهل البلد.'
                : 'ارجع لخدماتك علشان تضيف طلب وتتابع حالته.'}
            </Text>
          </Animated.View>
        </View>
        {hasSubmission ? (
          <Animated.View style={[s.card, entrance(motion[2], 8)]}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>حالة الطلب الحالية</Text>
              <View style={s.badge}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={18}
                  color={colors.warning}
                  accessibilityElementsHidden
                />
                <Text style={s.badgeText}>قيد المراجعة</Text>
              </View>
            </View>
            <View style={s.divider} />
            <View style={s.step}>
              <View style={s.track}>
                <View style={s.completed}>
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={colors.onPrimary}
                    accessibilityElementsHidden
                  />
                </View>
                <View style={s.connector} />
              </View>
              <View style={s.stepCopy}>
                <Text style={s.stepTitle}>
                  {submittedRequest?.type === 'update'
                    ? 'طلب التعديل وصلنا'
                    : 'طلب الإضافة وصلنا'}
                </Text>
                <Text style={s.stepDescription}>تفاصيل خدمتك اتحفظت</Text>
              </View>
            </View>
            <View style={s.step}>
              <View style={s.pending}>
                <View style={s.pendingDot} />
              </View>
              <View style={s.stepCopy}>
                <Text style={s.stepTitle}>مراجعة البيانات ونشر الخدمة</Text>
                <Text style={s.stepDescription}>
                  التأكد من صحة بيانات التواصل والعنوان
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}
        <View style={s.notice}>
          <MaterialCommunityIcons
            name="information-outline"
            size={22}
            color={colors.warning}
            accessibilityElementsHidden
          />
          <Text style={s.noticeText}>
            {hasSubmission
              ? 'طلبك قيد المراجعة، ومش هيظهر في الدليل قبل الموافقة.'
              : 'افتح خدماتك عشان تشوف طلبك وصل لفين.'}
          </Text>
        </View>
      </ScrollView>
      <View style={s.actions}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="عرض خدماتي"
          onPress={() => router.replace('/(tabs)/my-services')}
          style={s.primary}
        >
          <Text style={s.primaryText}>عرض خدماتي</Text>
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.onPrimary}
            accessibilityElementsHidden
          />
        </MotionPressable>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="ارجع للرئيسية"
          onPress={() => router.replace('/(tabs)')}
          style={s.secondary}
        >
          <MaterialCommunityIcons
            name="home-outline"
            size={22}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
          <Text style={s.secondaryText}>ارجع للرئيسية</Text>
        </MotionPressable>
        <Text style={s.footer}>منشأة العمار — بلدنا أقرب</Text>
      </View>
    </SafeAreaView>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    scroll: { flex: 1 },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.lg,
    },
    hero: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headline: {
      ...typography.hero,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    description: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: spacing.md,
      gap: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
    },
    cardHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardTitle: {
      ...typography.label,
      color: c.textPrimary,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 20,
      backgroundColor: c.pendingBackground,
    },
    badgeText: {
      ...typography.caption,
      color: c.warning,
      writingDirection: 'rtl',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.divider },
    step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    track: { alignItems: 'center', alignSelf: 'stretch', width: 32 },
    completed: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.actionBackground,
    },
    connector: {
      flex: 1,
      minHeight: 24,
      width: 2,
      backgroundColor: c.border,
      marginTop: spacing.xs,
    },
    pending: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: c.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.warning,
    },
    stepCopy: { flex: 1, gap: spacing.xs, paddingBottom: spacing.sm },
    stepTitle: {
      ...typography.title,
      color: c.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    stepDescription: {
      ...typography.caption,
      color: c.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: c.secondary,
    },
    noticeText: {
      ...typography.caption,
      color: c.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
      flex: 1,
    },
    actions: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    primary: {
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: c.actionBackground,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    secondary: {
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: c.surfaceLow,
      borderWidth: 1,
      borderColor: c.divider,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primaryText: {
      ...typography.button,
      color: c.onPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    secondaryText: {
      ...typography.button,
      color: c.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    footer: {
      ...typography.caption,
      color: c.muted,
      textAlign: 'center',
      writingDirection: 'rtl',
      paddingTop: spacing.sm,
    },
  });
