import { memo, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from './Motion';

const Outline = Animated.createAnimatedComponent(Circle);
const Check = Animated.createAnimatedComponent(Path);
const circumference = 2 * Math.PI * 60;
const checkLength = Math.hypot(13, 13) + Math.hypot(26, 27);

/** Mount only for confirmed success. Each mount plays once; unknown motion preference is static. */
export const AnimatedSuccessCheck = memo(function AnimatedSuccessCheck() {
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const played = useRef(false);
  const circle = useSharedValue(0);
  const check = useSharedValue(0);
  const scale = useSharedValue(1);
  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circle.value,
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: check.value,
  }));
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  useEffect(() => {
    if (reduced === null) return;
    if (reduced || played.current) {
      circle.set(0);
      check.set(0);
      scale.set(1);
      played.current = true;
      return;
    }
    played.current = true;
    circle.set(circumference);
    check.set(checkLength);
    circle.set(
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );
    check.set(
      withDelay(
        400,
        withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) }),
      ),
    );
    scale.set(
      withDelay(
        650,
        withSequence(
          withTiming(1.035, { duration: 80 }),
          withSpring(1, {
            duration: 150,
            dampingRatio: 0.9,
            overshootClamping: true,
          }),
        ),
      ),
    );
    return () => {
      cancelAnimation(circle);
      cancelAnimation(check);
      cancelAnimation(scale);
      circle.set(0);
      check.set(0);
      scale.set(1);
    };
  }, [reduced, circle, check, scale]);
  return (
    <Animated.View
      testID="animated-success-check"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, animatedStyle]}
    >
      <Svg width={148} height={148} viewBox="0 0 148 148">
        <Circle cx={74} cy={74} r={73} fill={colors.surfaceContainer} />
        <Circle cx={74} cy={74} r={60} fill={colors.surfaceLow} />
        <Outline
          cx={74}
          cy={74}
          r={60}
          fill="none"
          stroke={colors.success}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={[circumference, circumference]}
          animatedProps={circleProps}
          rotation={-90}
          origin="74, 74"
        />
        <Circle
          testID="success-fill"
          cx={74}
          cy={74}
          r={43}
          fill={colors.success}
        />
        <Check
          testID="success-check-stroke"
          d="M55 74 L68 87 L94 60"
          fill="none"
          stroke={colors.onPrimary}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[checkLength, checkLength]}
          animatedProps={checkProps}
        />
      </Svg>
    </Animated.View>
  );
});
const styles = StyleSheet.create({
  container: { width: 148, height: 148, marginBottom: 8 },
});
