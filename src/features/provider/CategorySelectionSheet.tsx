import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchInput } from '../discovery/components/DiscoveryUi';
import { normalizeArabic } from '../discovery/search';
import type { ServiceCategory } from '../discovery/types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
export function CategorySelectionSheet({
  visible,
  categories,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  categories: ServiceCategory[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const close = () => {
    setQuery('');
    onClose();
  };
  const matches = categories.filter((c) =>
    normalizeArabic([c.name, ...c.keywords].join(' ')).includes(
      normalizeArabic(query),
    ),
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق اختيار القسم"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            padding: 16,
            gap: 12,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ ...typography.title, color: colors.textPrimary }}
            >
              اختار القسم
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              onPress={close}
              style={{
                minHeight: 44,
                minWidth: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن قسم..."
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {matches.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityLabel={c.name}
                accessibilityState={{ checked: selected === c.id }}
                onPress={() => {
                  onSelect(c.id);
                  close();
                }}
                style={{
                  minHeight: 52,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor:
                    selected === c.id ? colors.primary : colors.border,
                  backgroundColor:
                    selected === c.id
                      ? colors.surfaceContainer
                      : colors.surface,
                }}
              >
                <MaterialCommunityIcons
                  name={c.icon}
                  size={24}
                  color={colors.primaryDark}
                />
                <Text
                  style={{
                    ...typography.body,
                    flex: 1,
                    color: colors.textPrimary,
                    writingDirection: 'rtl',
                  }}
                >
                  {c.name}
                </Text>
                {selected === c.id ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={colors.primaryDark}
                  />
                ) : null}
              </Pressable>
            ))}
            {!matches.length ? (
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                مفيش أقسام مطابقة للبحث
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
