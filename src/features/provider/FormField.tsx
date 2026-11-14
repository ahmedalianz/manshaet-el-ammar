import { useState, type Ref, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type LayoutChangeEvent,
} from 'react-native';
import { spacing } from '../../theme/spacing';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

type Props = TextInputProps & {
  label: string;
  error?: string;
  phone?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  onFieldLayout?: (event: LayoutChangeEvent) => void;
};
export function FormField({
  label,
  error,
  phone,
  inputRef,
  onFieldLayout,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const styles = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  return (
    <View style={styles.field} onLayout={onFieldLayout}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        keyboardAppearance={resolved}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          focused && { borderColor: colors.primary },
          error && { borderColor: colors.error },
          props.editable === false && {
            backgroundColor: colors.disabledBackground,
            color: colors.disabledText,
          },
          props.multiline && styles.multiline,
          phone && styles.phone,
        ]}
        textAlign={props.textAlign ?? (phone ? 'left' : 'right')}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    field: { gap: spacing.sm },
    label: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    input: {
      textAlign: 'right',
      ...typography.body,
      minHeight: 56,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    phone: { writingDirection: 'ltr' },
    error: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
    },
  });
