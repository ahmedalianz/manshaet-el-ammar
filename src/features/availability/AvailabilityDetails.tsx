import { typography } from '../../theme/typography';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View, Pressable } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';
import type { Availability } from './types';
import { formatAvailabilityField } from './format';
import { modeNames } from './AvailabilityFields';
export function AvailabilityDetails({ value }: { value: Availability }) {
  const { colors } = useAppTheme();
  const lines = [
    value.serviceMode ? modeNames[value.serviceMode] : '',
    value.coverageAreas
      ?.map((area) => (area === 'all' ? 'كل منشأة العمار' : area))
      .join('، ') ?? '',
  ].filter(Boolean);
  const [expanded, setExpanded] = useState(false);
  const hours = formatAvailabilityField('weeklyHours', value);
  const hasHours = hours !== 'غير محدد';
  if (!lines.length && !hasHours) return null;
  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, index) => (
        <Text
          key={index}
          style={{
            ...typography.body,
            color: colors.textSecondary,
            writingDirection: 'rtl',
          }}
        >
          {line}
        </Text>
      ))}
      {hasHours ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="مواعيد العمل"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 56,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.inputBackground,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textPrimary }}>
              مواعيد العمل
            </Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.primaryDark}
            />
          </Pressable>
          {expanded ? (
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                writingDirection: 'rtl',
              }}
            >
              {hours}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
