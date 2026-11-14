import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { formatTime } from './format';

function pickerDate(value: string) {
  const date = new Date(2000, 0, 15, 9, 0, 0);
  const valid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  date.setHours(
    valid ? Number(value.slice(0, 2)) : 9,
    valid ? Number(value.slice(3)) : 0,
    0,
    0,
  );
  return date;
}
const clockValue = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { colors, resolved } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => pickerDate(value));
  const launch = () => {
    if (disabled) return;
    const date = pickerDate(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        display: 'clock',
        is24Hour: false,
        positiveButton: { label: 'اختيار' },
        negativeButton: { label: 'إلغاء' },
        onValueChange: (_event, selected) => onChange(clockValue(selected)),
      });
    } else {
      setDraft(date);
      setOpen(true);
    }
  };
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label.split(' — ').at(-1)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: formatTime(value) }}
        accessibilityHint="افتح الساعة لاختيار الوقت"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={launch}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="clock-outline"
          size={21}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
        <Text style={[styles.time, { color: colors.primaryDark }]}>
          {formatTime(value)}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={18}
          color={colors.muted}
          accessibilityElementsHidden
        />
      </Pressable>
      <Modal
        visible={open && !disabled}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إلغاء اختيار الوقت"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['bottom']}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: colors.surface }]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {label}
            </Text>
            <DateTimePicker
              testID="time-picker"
              value={draft}
              mode="time"
              display="spinner"
              locale="ar-EG"
              themeVariant={resolved}
              textColor={colors.textPrimary}
              onValueChange={(_event, selected) => setDraft(selected)}
              style={styles.picker}
            />
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(clockValue(draft));
                  setOpen(false);
                }}
                style={[
                  styles.action,
                  { backgroundColor: colors.actionBackground },
                ]}
              >
                <Text style={[styles.actionText, { color: colors.onPrimary }]}>
                  اختيار الوقت
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={[
                  styles.action,
                  { backgroundColor: colors.secondaryAction },
                ]}
              >
                <Text
                  style={[styles.actionText, { color: colors.primaryDark }]}
                >
                  إلغاء
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { flexGrow: 1, flexBasis: 130, minWidth: 0, gap: 6 },
  label: { ...typography.caption, writingDirection: 'rtl', textAlign: 'auto' },
  trigger: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    ...typography.label,
    flex: 1,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  title: {
    ...typography.sectionTitle,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  picker: { width: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { ...typography.button, textAlign: 'center' },
});
