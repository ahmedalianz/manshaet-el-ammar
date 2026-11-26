import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { useReducedMotion } from './Motion';

export function LoadingState({
  label = 'بنحمّل البيانات…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    pulse.setValue(0);
    if (reduced !== false) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);
  const size = compact ? 48 : 88;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.container, compact && styles.compact]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            backgroundColor: colors.surfaceContainer,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.5],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.16],
                  }),
                },
              ],
            },
          ]}
        />
        <View
          style={[styles.emblem, { width: size * 0.76, height: size * 0.76 }]}
        >
          <Image
            source={require('../../../assets/images/brand-emblem.png')}
            resizeMode="contain"
            style={styles.image}
          />
        </View>
      </View>
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
    gap: 18,
  },
  compact: { flex: 0, padding: 12, gap: 10 },
  badge: { borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#E9AD32',
  },
  emblem: {
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    padding: 6,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  label: { ...typography.body, textAlign: 'center', writingDirection: 'rtl' },
});
