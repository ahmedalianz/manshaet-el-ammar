import { useId, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { emergencyNumbers } from './numbers';

export function EmergencyShortcut() {
  const gradientId = useId();
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 270;
  const styles = useThemedStyles(createStyles);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const open = async (number: (typeof emergencyNumbers)[number]['number']) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      // These national short codes are separate from provider mobile numbers.
      // Open the phone app; never place a call automatically or use CALL_PHONE.
      await Linking.openURL(`tel:${number}`);
    } catch {
      setError(`مش قادرين نفتح الاتصال. اطلب ${number} من تليفونك.`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Pressable
      testID="emergency-shortcut-card"
      accessible={false}
      onPress={() => router.push('/emergency')}
      style={styles.card}
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
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          accessible={false}
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="80%" y2="1">
              <Stop offset="0" stopColor={isDark ? '#3E423B' : '#FFF0D9'} />
              <Stop offset="60%" stopColor={isDark ? '#253640' : '#FFF9EF'} />
              <Stop offset="1" stopColor={isDark ? '#1B2D36' : '#F7F0E5'} />
            </LinearGradient>
          </Defs>
          <Rect width="400" height="200" fill={`url(#${gradientId})`} />
          <Path
            d="M0 46Q94 35 211 0H0Z"
            fill={isDark ? '#F0C382' : '#D8A65F'}
            opacity=".12"
          />
          <Path
            d="M0 46Q94 35 211 0"
            stroke={colors.warning}
            strokeWidth="1"
            fill="none"
            opacity=".45"
          />
        </Svg>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="عرض كل أرقام الطوارئ في مصر ومركز طوخ"
        onPress={(event) => {
          event?.stopPropagation();
          router.push('/emergency');
        }}
        style={styles.heading}
      >
        <View style={styles.headingIcon}>
          <MaterialCommunityIcons
            name="alarm-light-outline"
            size={30}
            color={colors.warning}
            accessibilityElementsHidden
          />
        </View>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            أرقام الطوارئ في مصر
          </Text>
          <Text style={styles.subtitle}>أرقام سريعة للمساعدة وقت الحاجة</Text>
        </View>
        <View style={styles.arrowBadge} accessibilityElementsHidden>
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={colors.warning}
            accessibilityElementsHidden
          />
        </View>
      </Pressable>
      <View style={[styles.numbers, stacked && styles.stacked]}>
        {emergencyNumbers.map((item) => (
          <Pressable
            key={item.number}
            accessibilityRole="button"
            accessibilityLabel={`اتصل ب${item.label} على ${item.number}`}
            accessibilityHint="بيفتح تطبيق الاتصال بالرقم ده"
            disabled={busy}
            onPress={(event) => {
              event?.stopPropagation();
              void open(item.number);
            }}
            style={[styles.numberButton, stacked && styles.stackedButton]}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={25}
              color={colors.warning}
              accessibilityElementsHidden
            />
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.callLabel}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={15}
                color={colors.warning}
                accessibilityElementsHidden
              />
              <Text style={styles.number}>{item.number}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          selectable
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </Pressable>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 16,
      gap: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.warning,
      overflow: 'hidden',
      backgroundColor: colors.surfaceLow,
    },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headingIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.pendingBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headingCopy: { flex: 1, minWidth: 0, gap: 4 },
    arrowBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    title: {
      ...typography.sectionTitle,
      color: colors.warning,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    numbers: { flexDirection: 'row', gap: 10 },
    stacked: { flexDirection: 'column' },
    stackedButton: { flex: 0, width: '100%' },
    numberButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 116,
      paddingHorizontal: 6,
      paddingVertical: 12,
      gap: 4,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      ...typography.label,
      fontSize: 14,
      color: colors.warning,
      textAlign: 'center',
    },
    number: {
      ...typography.sectionTitle,
      fontSize: 26,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    callLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    error: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
  });
