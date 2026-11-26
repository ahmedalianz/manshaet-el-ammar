import { SharedHoursEditor, needsAdvancedHours } from './SharedHoursEditor';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { TimeField } from './TimeField';
import { useAppTheme } from '../../theme/ThemeProvider';
import type { Availability, DayHours } from './types';
import { dayKeys } from './validation';
export const dayNames = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];
export const modeNames = {
  fixed: 'في مكان ثابت',
  mobile: 'بروح للعميل',
  both: 'مكان ثابت وبروح للعميل',
};
export const statusNames = {
  unspecified: 'غير محدد',
  closed: 'مغلق',
  appointment: 'بموعد مسبق',
  allDay: 'طوال اليوم',
  open: 'فترات محددة',
};
export function AvailabilityFields({
  value,
  onChange,
  disabled,
  errors,
  section = 'all',
  onPendingHoursChange,
}: {
  value: Availability;
  section?: 'all' | 'service' | 'hours';
  onPendingHoursChange?: (pending: boolean) => void;
  onChange: (value: Availability) => void;
  disabled: boolean;
  errors: Partial<Record<keyof Availability, string>>;
}) {
  const { colors } = useAppTheme();
  const [hoursExpanded, setHoursExpanded] = useState(
    Boolean(value.weeklyHours),
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [advanced, setAdvanced] = useState(() =>
    needsAdvancedHours(value.weeklyHours),
  );
  const showHours = hoursExpanded || Boolean(errors.weeklyHours);
  const button = (
    label: string,
    selected: boolean,
    onPress: () => void,
    accessibilityLabel = label,
  ) => (
    <Pressable
      key={label}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      style={{
        padding: 12,
        minHeight: 48,
        borderWidth: 1,
        borderColor: selected ? colors.primaryDark : colors.border,
        backgroundColor: selected ? colors.actionBackground : colors.surface,
        borderRadius: 14,
      }}
    >
      <Text
        style={{
          ...typography.body,
          color: selected ? colors.onPrimary : colors.textPrimary,
          writingDirection: 'rtl',
        }}
      >
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      {section !== 'hours' ? (
        <>
          <Text style={{ ...typography.body, color: colors.textPrimary }}>
            طريقة تقديم الخدمة *
          </Text>
          <View style={styles.row}>
            {Object.entries(modeNames).map(([mode, label]) => (
              <Pressable
                key={mode}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{
                  selected: value.serviceMode === mode,
                  disabled,
                }}
                onPress={() =>
                  onChange({
                    ...value,
                    serviceMode: mode as Availability['serviceMode'],
                  })
                }
                style={{
                  flexGrow: 1,
                  flexBasis: 100,
                  minHeight: 96,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor:
                    value.serviceMode === mode ? colors.primary : colors.border,
                  borderRadius: 18,
                  backgroundColor:
                    value.serviceMode === mode
                      ? colors.surfaceContainer
                      : colors.surface,
                }}
              >
                <MaterialCommunityIcons
                  name={
                    mode === 'fixed'
                      ? 'storefront-outline'
                      : mode === 'mobile'
                        ? 'truck-delivery-outline'
                        : 'home-switch-outline'
                  }
                  size={30}
                  color={colors.primaryDark}
                />
                <Text
                  style={{
                    ...typography.label,
                    color: colors.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {mode === 'both' ? 'الاتنين' : label}
                </Text>
                <MaterialCommunityIcons
                  name={
                    value.serviceMode === mode
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={20}
                  color={colors.primaryDark}
                />
              </Pressable>
            ))}
          </View>
          {errors.serviceMode ? (
            <Text style={{ ...typography.body, color: colors.error }}>
              {errors.serviceMode}
            </Text>
          ) : null}
        </>
      ) : null}
      {section !== 'service' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="مواعيد العمل (اختياري)"
            accessibilityState={{ expanded: showHours, disabled }}
            disabled={disabled}
            onPress={() => setHoursExpanded(!hoursExpanded)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              minHeight: 56,
              borderRadius: 16,
              backgroundColor: colors.inputBackground,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textPrimary }}>
              مواعيد العمل (اختياري)
            </Text>
            <MaterialCommunityIcons
              name={showHours ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.primaryDark}
            />
          </Pressable>
          <View style={{ gap: 12, display: showHours ? 'flex' : 'none' }}>
            <View style={styles.row}>
              {button('مواعيد مشتركة', !advanced, () => setAdvanced(false))}
              {button('إعدادات متقدمة لكل يوم', advanced, () => {
                setAdvanced(true);
                onPendingHoursChange?.(false);
              })}
            </View>
            {!advanced ? (
              <SharedHoursEditor
                onPendingChange={onPendingHoursChange}
                value={value}
                onChange={onChange}
                disabled={disabled}
              />
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      ...typography.sectionTitle,
                      color: colors.primaryDark,
                    }}
                  >
                    اختار أيام شغلك
                  </Text>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                    }}
                  >
                    ضيف الأيام اللي بتشتغل فيها، وبعدها حدّد مواعيد كل يوم.
                  </Text>
                  <View style={styles.row}>
                    {dayKeys.map((key, index) =>
                      button(
                        dayNames[index],
                        Boolean(
                          value.weeklyHours?.[key] &&
                          value.weeklyHours[key]?.status !== 'unspecified',
                        ),
                        () => {
                          const selected =
                            value.weeklyHours?.[key]?.status &&
                            value.weeklyHours[key]?.status !== 'unspecified';
                          onChange({
                            ...value,
                            weeklyHours: {
                              ...value.weeklyHours,
                              [key]: selected
                                ? { status: 'unspecified' }
                                : {
                                    status: 'open',
                                    periods: [
                                      {
                                        start: '09:00',
                                        end: '17:00',
                                        overnight: false,
                                      },
                                    ],
                                  },
                            },
                          });
                        },
                        `اختيار ${dayNames[index]}`,
                      ),
                    )}
                  </View>
                </View>
                {dayKeys.map((key, index) => {
                  const day = value.weeklyHours?.[key];
                  if (!day || day.status === 'unspecified') return null;
                  const setDay = (updated: DayHours) =>
                    onChange({
                      ...value,
                      weeklyHours: { ...value.weeklyHours, [key]: updated },
                    });
                  return (
                    <View
                      key={key}
                      style={{
                        gap: 12,
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceLow,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.sectionTitle,
                          color: colors.primaryDark,
                        }}
                      >
                        {dayNames[index]}
                      </Text>
                      <View style={styles.row}>
                        {Object.entries(statusNames)
                          .filter(([status]) => status !== 'unspecified')
                          .map(([status, label]) =>
                            button(
                              label,
                              day.status === status,
                              () =>
                                setDay(
                                  status === 'open'
                                    ? {
                                        status: 'open',
                                        periods: [
                                          {
                                            start: '09:00',
                                            end: '17:00',
                                            overnight: false,
                                          },
                                        ],
                                      }
                                    : { status: status as DayHours['status'] },
                                ),
                              `${dayNames[index]} — ${label}`,
                            ),
                          )}
                      </View>
                      {day.status === 'open' ? (
                        <>
                          {day.periods?.map((period, i) => (
                            <View key={i} style={{ gap: 10 }}>
                              <Text
                                style={{
                                  ...typography.label,
                                  color: colors.textSecondary,
                                }}
                              >
                                الفترة {(i + 1).toLocaleString('ar-EG')}
                              </Text>
                              <View style={styles.row}>
                                <TimeField
                                  label={`${dayNames[index]} — الفترة ${i + 1} — من`}
                                  value={period.start}
                                  disabled={disabled}
                                  onChange={(start) =>
                                    setDay({
                                      ...day,
                                      periods: day.periods?.map((p, j) =>
                                        i === j ? { ...p, start } : p,
                                      ),
                                    })
                                  }
                                />
                                <TimeField
                                  label={`${dayNames[index]} — الفترة ${i + 1} — إلى`}
                                  value={period.end}
                                  disabled={disabled}
                                  onChange={(end) =>
                                    setDay({
                                      ...day,
                                      periods: day.periods?.map((p, j) =>
                                        i === j ? { ...p, end } : p,
                                      ),
                                    })
                                  }
                                />
                              </View>
                              {button(
                                'تنتهي في اليوم التالي',
                                period.overnight,
                                () =>
                                  setDay({
                                    ...day,
                                    periods: day.periods?.map((p, j) =>
                                      i === j
                                        ? { ...p, overnight: !p.overnight }
                                        : p,
                                    ),
                                  }),
                              )}
                              {day.periods?.length === 2
                                ? button('حذف الفترة', false, () =>
                                    setDay({
                                      ...day,
                                      periods: day.periods?.filter(
                                        (_, j) => i !== j,
                                      ),
                                    }),
                                  )
                                : null}
                            </View>
                          ))}
                          {day.periods?.length === 1
                            ? button('إضافة فترة ثانية', false, () =>
                                setDay({
                                  ...day,
                                  periods: [
                                    ...day.periods!,
                                    {
                                      start: '18:00',
                                      end: '21:00',
                                      overnight: false,
                                    },
                                  ],
                                }),
                              )
                            : null}
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
          {showHours && advanced && value.weeklyHours ? (
            <View style={{ gap: 8 }}>
              {button('مسح مواعيد العمل', false, () => setConfirmClear(true))}
              {confirmClear ? (
                <View
                  style={{
                    gap: 8,
                    padding: 12,
                    backgroundColor: colors.surfaceContainer,
                    borderRadius: 14,
                  }}
                >
                  <Text
                    accessibilityRole="alert"
                    style={{ ...typography.body, color: colors.textPrimary }}
                  >
                    مسح المواعيد الحالية؟
                  </Text>
                  {button('تأكيد مسح المواعيد', false, () => {
                    onChange({ ...value, weeklyHours: undefined });
                    setConfirmClear(false);
                    setAdvanced(false);
                  })}
                  {button('الاحتفاظ بالمواعيد الحالية', false, () =>
                    setConfirmClear(false),
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          {errors.weeklyHours ? (
            <Text style={{ ...typography.body, color: colors.error }}>
              {errors.weeklyHours}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
