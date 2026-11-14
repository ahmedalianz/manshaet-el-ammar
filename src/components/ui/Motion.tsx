import { motion } from '../../theme/motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewProps,
} from 'react-native';

// Unknown preference is treated conservatively: content stays visible and still.
export function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let changed = false;
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        changed = true;
        if (active) setReduced(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {
        if (active && !changed) setReduced(true);
      });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduced;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function MotionPressable({
  style,
  disabled: disabledProp,
  accessibilityState,
  onPressIn,
  onPressOut,
  onPress,
  onHoverIn,
  onHoverOut,
  ...props
}: PressableProps) {
  const reduced = useReducedMotion();
  const disabled = Boolean(disabledProp || accessibilityState?.disabled);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const selected = accessibilityState?.selected ?? accessibilityState?.checked;
  const previousSelected = useRef(selected);
  useEffect(() => {
    if (disabled || reduced !== false) {
      scale.stopAnimation();
      scale.setValue(1);
      opacity.stopAnimation();
      opacity.setValue(1);
    }
  }, [disabled, reduced, scale, opacity]);
  useEffect(() => {
    const changed = previousSelected.current !== selected;
    previousSelected.current = selected;
    if (!changed || !selected || disabled || reduced !== false) return;
    opacity.stopAnimation();
    opacity.setValue(0.85);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.duration.selection,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => {
      animation.stop();
      opacity.setValue(1);
    };
  }, [selected, disabled, reduced, opacity]);
  useEffect(
    () => () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    },
    [scale, opacity],
  );
  const animatePress = (down: boolean) => {
    if (disabled) return;
    setPressed(down);
    if (reduced !== false) return;
    scale.stopAnimation();
    const animation = down
      ? Animated.timing(scale, {
          toValue: motion.scale.pressed,
          duration: motion.duration.press,
          useNativeDriver: true,
          isInteraction: false,
        })
      : Animated.spring(scale, {
          toValue: 1,
          speed: 40,
          bounciness: 0,
          useNativeDriver: true,
          isInteraction: false,
        });
    animation.start();
  };
  const baseStyle = StyleSheet.flatten(
    typeof style === 'function'
      ? style({ pressed: !disabled && pressed, hovered: !disabled && hovered })
      : style,
  );
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onPress={disabled ? undefined : onPress}
      onPressIn={(event) => {
        if (!disabled) {
          animatePress(true);
          onPressIn?.(event);
        }
      }}
      onPressOut={(event) => {
        if (!disabled) {
          animatePress(false);
          onPressOut?.(event);
        }
      }}
      style={{
        ...baseStyle,
        transform:
          typeof baseStyle?.transform === 'string'
            ? baseStyle.transform
            : [...(baseStyle?.transform ?? []), { scale }],
        opacity: Animated.multiply(opacity, baseStyle?.opacity ?? 1),
      }}
    />
  );
}

export function MotionReveal({
  children,
  changeKey,
  animateOnMount = false,
  slide = 0,
  duration = motion.duration.reveal,
  style,
  ...props
}: ViewProps & {
  children: ReactNode;
  changeKey?: string | number;
  animateOnMount?: boolean;
  slide?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  const previous = useRef(changeKey);
  const entered = useRef(false);
  useEffect(() => {
    if (reduced === null) return;
    const changed = previous.current !== changeKey;
    previous.current = changeKey;
    const enter = !entered.current && animateOnMount;
    entered.current = true;
    if (reduced || (!changed && !enter)) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    progress.stopAnimation();
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(1);
    };
  }, [changeKey, animateOnMount, reduced, progress, slide, duration]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [slide, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
