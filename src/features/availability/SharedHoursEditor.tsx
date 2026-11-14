import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { TimeField } from './TimeField';
import { dayKeys, validateWeeklyHours } from './validation';
import type { Availability, DayKey, WeeklyHours } from './types';
const names = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];
export function needsAdvancedHours(hours: WeeklyHours | undefined) {
  const days = Object.values(hours ?? {}).filter(
    (day) => day.status !== 'unspecified',
  );
  return days.some(
    (day) =>
      day.status !== 'open' ||
      day.periods?.length !== 1 ||
      day.periods[0].overnight ||
      JSON.stringify(day) !== JSON.stringify(days[0]),
  );
}
export function SharedHoursEditor({
  value,
  onChange,
  disabled,
  onPendingChange,
}: {
  value: Availability;
  onChange: (value: Availability) => void;
  disabled: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const first = Object.values(value.weeklyHours ?? {}).find(
    (day) => day.status === 'open',
  )?.periods?.[0];
  const [start, setStart] = useState(first?.start ?? '09:00');
  const [end, setEnd] = useState(first?.end ?? '17:00');
  const [selected, setSelected] = useState<DayKey[]>(() =>
    value.weeklyHours
      ? dayKeys.filter((key) => value.weeklyHours?.[key]?.status === 'open')
      : [...dayKeys],
  );
  const [resetVersion, setResetVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const markDirty = () => {
    setDirty(true);
    onPendingChange?.(true);
  };
  const finish = () => {
    setDirty(false);
    onPendingChange?.(false);
  };
  const restore = () => {
    setStart(first?.start ?? '09:00');
    setEnd(first?.end ?? '17:00');
    setSelected(
      value.weeklyHours
        ? dayKeys.filter((key) => value.weeklyHours?.[key]?.status === 'open')
        : [...dayKeys],
    );
    setPending(null);
    setResetVersion((v) => v + 1);
    finish();
  };
  const [pending, setPending] = useState<'apply' | 'clear' | null>(null);
  const [error, setError] = useState('');
  const text = { ...typography.body, color: colors.textPrimary };
  const button = (label: string, action: () => void, checked = false) => (
    <Pressable
      key={label}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: checked, disabled }}
      onPress={action}
      style={{
        minHeight: 44,
        padding: 10,
        borderWidth: 1,
        borderColor: checked ? colors.primary : colors.border,
        borderRadius: 14,
        backgroundColor: checked ? colors.actionBackground : colors.surface,
      }}
    >
      <Text style={[text, checked && { color: colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
  const commit = (kind: 'apply' | 'clear') => {
    if (kind === 'clear') {
      onChange({ ...value, weeklyHours: undefined });
      setPending(null);
      setStart('09:00');
      setEnd('17:00');
      setSelected([...dayKeys]);
      setResetVersion((v) => v + 1);
      finish();
      return;
    }
    if (!selected.length) {
      setError('اختار يوم واحد على الأقل.');
      return;
    }
    const hours: WeeklyHours = Object.fromEntries(
      dayKeys.map((key) => [
        key,
        selected.includes(key)
          ? { status: 'open', periods: [{ start, end, overnight: false }] }
          : { status: 'unspecified' },
      ]),
    );
    const invalid = validateWeeklyHours(hours);
    if (invalid) {
      setError(invalid + ' للمواعيد الليلية استخدم الإعدادات المتقدمة.');
      return;
    }
    onChange({ ...value, weeklyHours: hours });
    setError('');
    setPending(null);
    finish();
  };
  const request = (kind: 'apply' | 'clear') => {
    if (
      Object.values(value.weeklyHours ?? {}).some(
        (day) => day.status !== 'unspecified',
      )
    )
      setPending(kind);
    else commit(kind);
  };
  return (
    <View
      style={{
        gap: 14,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceLow,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {button(
          'كل الأيام',
          () => {
            setSelected([...dayKeys]);
            markDirty();
          },
          selected.length === 7,
        )}
        {button(
          'أيام محددة',
          () => {
            setSelected([]);
            markDirty();
          },
          selected.length !== 7,
        )}
      </View>
      <Text style={{ ...typography.label, color: colors.primaryDark }}>
        {selected.length === 7
          ? 'نفس المواعيد طول الأسبوع'
          : 'اختار أيام شغلك الأول'}
      </Text>
      {selected.length !== 7 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {dayKeys.map((key, i) =>
            button(
              names[i],
              () => {
                markDirty();
                setSelected((days) =>
                  days.includes(key)
                    ? days.filter((day) => day !== key)
                    : [...days, key],
                );
              },
              selected.includes(key),
            ),
          )}
        </View>
      ) : null}
      {selected.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TimeField
            key={`start-${resetVersion}`}
            label="المواعيد المشتركة — من"
            value={start}
            onChange={(value) => {
              setStart(value);
              markDirty();
            }}
            disabled={disabled}
          />
          <TimeField
            key={`end-${resetVersion}`}
            label="المواعيد المشتركة — إلى"
            value={end}
            onChange={(value) => {
              setEnd(value);
              markDirty();
            }}
            disabled={disabled}
          />
        </View>
      ) : (
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          اختار يوم واحد أو أكتر عشان تضيف المواعيد.
        </Text>
      )}
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        اضغط تطبيق المواعيد لحفظ التغييرات. الأيام غير المختارة هتفضل من غير
        مواعيد محددة. استخدم الإعدادات المتقدمة للفترات المتعددة أو الليلية.
      </Text>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ ...typography.body, color: colors.error }}
        >
          {error}
        </Text>
      ) : null}
      {dirty ? (
        <Text style={{ ...typography.caption, color: colors.warning }}>
          المواعيد الجديدة لسه مش مطبقة.
        </Text>
      ) : null}
      {button('تطبيق المواعيد', () => request('apply'))}
      {dirty && !pending ? button('الاحتفاظ بالمواعيد الحالية', restore) : null}
      {value.weeklyHours
        ? button('مسح مواعيد العمل', () => request('clear'))
        : null}
      {pending ? (
        <View
          style={{
            padding: 12,
            gap: 8,
            borderRadius: 14,
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <Text accessibilityRole="alert" style={text}>
            {pending === 'clear'
              ? 'مسح المواعيد الحالية؟'
              : 'استبدال المواعيد الحالية بالمواعيد المشتركة؟'}
          </Text>
          {button('تأكيد تغيير المواعيد', () => commit(pending))}
          {button('الاحتفاظ بالمواعيد الحالية', restore)}
        </View>
      ) : null}
    </View>
  );
}
