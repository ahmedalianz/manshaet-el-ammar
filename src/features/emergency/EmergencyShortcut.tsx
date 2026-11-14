import { useId, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { emergencyNumbers } from './numbers';

export function EmergencyShortcut() {
  const gradientId = useId();
  const { resolved } = useAppTheme();
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
    <View style={styles.card}>
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
            <LinearGradient id={gradientId} x1="0" y1="0" x2=".8" y2="1">
              <Stop offset="0" stopColor={isDark ? '#4C1720' : '#741E28'} />
              <Stop offset=".6" stopColor={isDark ? '#64212C' : '#96313A'} />
              <Stop offset="1" stopColor={isDark ? '#421923' : '#76232E'} />
            </LinearGradient>
          </Defs>
          <Rect width="400" height="200" fill={`url(#${gradientId})`} />
          <Path
            d="M0 68Q60 12 148 0H0ZM218 200Q303 130 400 155V200Z"
            fill="#FFFFFF"
            opacity=".07"
          />
        </Svg>
      </View>
      <View style={styles.heading}>
        <MaterialCommunityIcons
          name="alarm-light-outline"
          size={32}
          color="#FFE1D7"
          accessibilityElementsHidden
        />
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            أرقام الطوارئ في مصر
          </Text>
          <Text style={styles.subtitle}>للحالات العاجلة على مدار الساعة</Text>
        </View>
      </View>
      <View style={[styles.numbers, stacked && styles.stacked]}>
        {emergencyNumbers.map((item) => (
          <Pressable
            key={item.number}
            accessibilityRole="button"
            accessibilityLabel={`اتصل ب${item.label} على ${item.number}`}
            accessibilityHint="بيفتح تطبيق الاتصال بالرقم ده"
            disabled={busy}
            onPress={() => void open(item.number)}
            style={[styles.numberButton, stacked && styles.stackedButton]}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={25}
              color="#BA1A1A"
              accessibilityElementsHidden
            />
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.callLabel}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={15}
                color="#BA1A1A"
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
    </View>
  );
}
const createStyles = () =>
  StyleSheet.create({
    card: {
      padding: 14,
      gap: 14,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: '#741E28',
    },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headingCopy: { flex: 1, gap: 2 },
    subtitle: {
      ...typography.caption,
      color: '#FFF2EE',
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    title: {
      ...typography.sectionTitle,
      color: '#FFFFFF',
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    numbers: { flexDirection: 'row', gap: 8 },
    stacked: { flexDirection: 'column' },
    stackedButton: { flex: 0, width: '100%' },
    numberButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 110,
      padding: 8,
      gap: 2,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFF9F7',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },
    label: {
      ...typography.label,
      fontSize: 14,
      color: '#BA1A1A',
      textAlign: 'center',
    },
    number: {
      ...typography.sectionTitle,
      fontSize: 26,
      color: '#183545',
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
      color: '#FFFFFF',
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
  });
