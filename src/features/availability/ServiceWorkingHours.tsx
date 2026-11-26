import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ServiceDetailsSection } from '../provider/ServiceDetailsSection';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import type { Availability } from './types';
import { dayKeys } from './validation';
import { formatTime } from './format';
import { currentHours } from './currentHours';

const dayNames = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];
const statusNames = {
  closed: 'مغلق',
  appointment: 'بموعد مسبق',
  allDay: 'طوال اليوم',
  unspecified: 'غير محدد',
};
const badgeNames = {
  open: 'مفتوح الآن',
  closed: 'مغلق الآن',
  appointment: 'بموعد مسبق',
  unknown: 'غير محدد',
};

export function ServiceWorkingHours({ value }: { value: Availability }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const { today, status } = currentHours(value.weeklyHours, now);
  const hasHours = dayKeys.some(
    (key) =>
      value.weeklyHours?.[key] &&
      value.weeklyHours[key]?.status !== 'unspecified',
  );
  const badgeColor =
    status === 'open'
      ? colors.success
      : status === 'closed'
        ? colors.error
        : colors.muted;
  return (
    <ServiceDetailsSection
      title="مواعيد العمل"
      icon="calendar-blank-outline"
      subtitle="أوقات تواجد مقدم الخدمة"
      initiallyExpanded={hasHours}
      accessibilityHint={`حسب المواعيد المسجلة: ${badgeNames[status]}`}
      badge={
        hasHours ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  status === 'open'
                    ? colors.publishedBackground
                    : status === 'closed'
                      ? colors.errorContainer
                      : colors.surfaceLow,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: badgeColor }]} />
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {badgeNames[status]}
            </Text>
          </View>
        ) : null
      }
    >
      {hasHours ? (
        <View style={styles.week}>
          {dayKeys.map((key, index) => {
            const raw = value.weeklyHours?.[key];
            const day =
              !raw || raw.status === 'unspecified'
                ? { status: 'closed' as const }
                : raw;
            const closed = day?.status === 'closed';
            const isToday = key === today;
            const scheduled =
              day?.status === 'open' || day?.status === 'allDay';
            const dotColor = isToday
              ? colors.primary
              : closed
                ? colors.error
                : scheduled
                  ? colors.success
                  : colors.muted;
            return (
              <View
                key={key}
                testID={`working-hours-${key}`}
                style={[
                  styles.row,
                  closed && styles.closedRow,
                  isToday && styles.todayRow,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
                <Text style={[styles.day, isToday && styles.todayText]}>
                  {dayNames[index]}
                  {isToday ? ' · اليوم' : ''}
                </Text>
                <View style={styles.times}>
                  {day?.status === 'open' && day.periods?.length ? (
                    day.periods.map((period, periodIndex) => (
                      <View key={periodIndex} style={styles.period}>
                        <Text style={styles.time}>
                          {formatTime(period.start)} – {formatTime(period.end)}
                        </Text>
                        {period.overnight ? (
                          <Text style={styles.overnight}>اليوم التالي</Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <View style={styles.status}>
                      {closed ? (
                        <MaterialCommunityIcons
                          name="calendar-remove-outline"
                          size={16}
                          color={colors.error}
                          accessibilityElementsHidden
                        />
                      ) : null}
                      <Text style={[styles.time, closed && styles.closedText]}>
                        {day && day.status !== 'open'
                          ? statusNames[day.status]
                          : 'غير محدد'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>
          المواعيد غير محددة — تواصل مع مقدم الخدمة للتأكيد.
        </Text>
      )}
    </ServiceDetailsSection>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
      flexShrink: 1,
    },
    badgeText: {
      ...typography.label,
      fontSize: 11,
      lineHeight: 20,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    dot: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
    week: { gap: 5 },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: colors.surfaceLow,
      minHeight: 34,
    },
    closedRow: { backgroundColor: colors.errorContainer },
    todayRow: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceContainer,
    },
    day: {
      ...typography.label,
      fontSize: 12,
      lineHeight: 22,
      color: colors.textPrimary,
      flex: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    todayText: {
      color: colors.primaryDark,
      ...typography.label,
      fontSize: 12,
      lineHeight: 22,
    },
    times: { flex: 1.3, gap: 5 },
    period: { alignItems: 'center' },
    time: {
      ...typography.body,
      fontSize: 12,
      lineHeight: 22,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    overnight: {
      ...typography.caption,
      fontSize: 10,
      lineHeight: 16,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    status: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closedText: { color: colors.error },
    note: {
      ...typography.caption,
      fontSize: 11,
      lineHeight: 20,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
      marginTop: 6,
    },
    empty: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
  });
