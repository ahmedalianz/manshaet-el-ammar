import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { MotionPressable, useReducedMotion } from '../../components/ui/Motion';
import { useFeedback } from '../../components/ui/Feedback';
import { useAppTheme } from '../../theme/ThemeProvider';
import type { ServiceProvider } from '../discovery/types';
import { useLocalDirectory } from './LocalDirectory';
export function FavoriteButton({
  provider,
  iconOnly = false,
}: {
  provider: ServiceProvider;
  iconOnly?: boolean;
}) {
  const local = useLocalDirectory();
  const feedback = useFeedback();
  const interacted = useRef(false);
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const saved = local.favoriteIds.includes(provider.id);
  const previousSaved = useRef(saved);
  const [heartScale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const justSaved = saved && !previousSaved.current;
    previousSaved.current = saved;
    heartScale.stopAnimation();
    heartScale.setValue(1);
    if (!justSaved || reduced !== false) return;
    const animation = Animated.sequence(
      [
        [1.3, 140],
        [0.92, 100],
        [1.15, 120],
        [1, 140],
      ].map(([toValue, duration]) =>
        Animated.timing(heartScale, {
          toValue,
          duration,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ),
    );
    animation.start();
    return () => {
      animation.stop();
      heartScale.setValue(1);
    };
  }, [saved, reduced, heartScale]);
  useEffect(() => {
    if (iconOnly && interacted.current && local.storageError) {
      interacted.current = false;
      feedback.show('الحفظ على الجهاز مش متاح', local.storageError);
    }
  }, [iconOnly, local.storageError, saved, feedback]);
  if (provider.dataSource !== 'firestore') return null;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved, disabled: !local.hydrated }}
      accessibilityLabel={
        iconOnly
          ? `${saved ? 'شيل' : 'حفظ'} ${provider.name} ${saved ? 'من' : 'في'} المفضلة`
          : saved
            ? 'شيل من المفضلة'
            : 'حفظ في المفضلة'
      }
      accessibilityHint={
        iconOnly
          ? (local.storageError ?? 'المفضلة على جهازك، من غير حساب')
          : undefined
      }
      disabled={!local.hydrated}
      onPress={(event) => {
        event?.stopPropagation();
        interacted.current = true;
        local.toggleFavorite(provider.id, provider);
        if (!saved)
          feedback.show('اتضافت للمفضلة', '', undefined, {
            tone: 'success',
          });
      }}
      style={{
        minHeight: 44,
        minWidth: 44,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: iconOnly ? 0 : 12,
      }}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 26,
          height: 26,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: heartScale }],
        }}
      >
        <MaterialCommunityIcons
          name={saved ? 'heart' : 'heart-outline'}
          size={22}
          color={saved ? colors.error : colors.primaryDark}
        />
      </Animated.View>
      {!iconOnly ? (
        <Text
          style={{
            ...typography.body,
            color: colors.primaryDark,
            flexShrink: 1,
          }}
        >
          {local.storageError
            ? 'مش قادرين نحفظ على الجهاز'
            : saved
              ? 'في المفضلة'
              : 'حفظ في المفضلة'}
        </Text>
      ) : null}
    </MotionPressable>
  );
}
