import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatAvailabilityField } from '../availability/format';
import { modeNames } from '../availability/AvailabilityFields';
import type { ServiceValues } from './types';
import { normalizeMobile } from './validation';

export function ServiceReview({
  values,
  categoryName,
  onEdit,
}: {
  values: ServiceValues;
  categoryName?: string;
  onEdit: (step: 1 | 2) => void;
}) {
  const s = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const sections = [
    {
      title: 'بيانات الخدمة',
      step: 1 as const,
      rows: [
        ['اسم مقدم الخدمة', values.name],
        ['القسم', categoryName],
        ['التخصص', values.serviceTitle],
        ['الوصف', values.description],
      ],
    },
    {
      title: 'التواصل والمكان',
      step: 2 as const,
      rows: [
        ['رقم الموبايل', normalizeMobile(values.phone)],
        [
          'واتساب',
          values.whatsapp ? normalizeMobile(values.whatsapp) : undefined,
        ],
        [
          'طريقة تقديم الخدمة',
          values.serviceMode ? modeNames[values.serviceMode] : undefined,
        ],
        ['العنوان', values.address],
        [
          'مواعيد العمل',
          Object.values(values.weeklyHours ?? {}).some(
            (day) => day.status !== 'unspecified',
          )
            ? formatAvailabilityField('weeklyHours', values)
            : undefined,
        ],
      ],
    },
  ];
  return (
    <View style={s.sections}>
      <Text style={s.hint}>
        راجع بيانات خدمتك قبل الإرسال. تقدر تعدّل أي جزء.
      </Text>
      {sections.map((section) => (
        <View key={section.title} style={s.card}>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.title}>
              {section.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`تعديل ${section.title}`}
              onPress={() => onEdit(section.step)}
              style={s.edit}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={20}
                color={colors.primaryDark}
              />
              <Text style={s.editText}>تعديل</Text>
            </Pressable>
          </View>
          {section.rows
            .filter(([, value]) => value?.trim())
            .map(([label, value]) => (
              <View key={label} style={s.row}>
                <Text style={s.label}>{label}</Text>
                <Text selectable style={s.value}>
                  {value}
                </Text>
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    sections: { gap: spacing.md },
    hint: {
      ...typography.body,
      color: c.textSecondary,
      writingDirection: 'rtl',
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: spacing.md,
      gap: spacing.sm,
    },
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    title: {
      ...typography.title,
      color: c.primaryDark,
      flex: 1,
      writingDirection: 'rtl',
    },
    edit: {
      minHeight: 44,
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    editText: { ...typography.caption, color: c.primaryDark },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    label: {
      flexBasis: 104,
      ...typography.caption,
      color: c.textSecondary,
      writingDirection: 'rtl',
    },
    value: {
      flex: 1,
      minWidth: 120,
      ...typography.body,
      color: c.textPrimary,
      writingDirection: 'rtl',
    },
  });
