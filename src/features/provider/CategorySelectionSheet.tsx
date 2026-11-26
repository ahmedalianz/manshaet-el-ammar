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
import { SearchEmptyArtwork } from '../../components/brand/SearchEmptyArtwork';
import { CategoryIcon, SearchInput } from '../discovery/components/DiscoveryUi';
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
  const otherCategory = categories.find((c) => c.id === 'other');
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
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق اختيار القسم"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.grabber, { backgroundColor: colors.border }]}
          />
          <View style={styles.sheetHeader}>
            <Text
              accessibilityRole="header"
              style={[styles.sheetTitle, { color: colors.textPrimary }]}
            >
              اختار القسم
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              onPress={close}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.primaryDark}
                accessibilityElementsHidden
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
            contentContainerStyle={styles.listContent}
          >
            {matches.map((c) => {
              const isSelected = selected === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityLabel={c.name}
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => {
                    onSelect(c.id);
                    close();
                  }}
                  style={[
                    styles.row,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? colors.surfaceContainer
                        : colors.surface,
                    },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <CategoryIcon icon={c.icon} size={24} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text
                      style={[styles.rowTitle, { color: colors.textPrimary }]}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={[styles.rowDesc, { color: colors.textSecondary }]}
                    >
                      {c.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                  ) : null}
                </Pressable>
              );
            })}
            {!matches.length ? (
              <View style={styles.empty}>
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <SearchEmptyArtwork />
                </View>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  مفيش أقسام مطابقة للبحث
                </Text>
                {otherCategory ? (
                  <View style={styles.otherFallback}>
                    <Text
                      style={[
                        styles.otherHint,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {`لو قسم خدمتك مش موجود، تقدر تختار «${otherCategory.name}»`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`اختيار ${otherCategory.name}`}
                      onPress={() => {
                        onSelect(otherCategory.id);
                        close();
                      }}
                      style={[
                        styles.row,
                        styles.otherButton,
                        {
                          borderColor:
                            selected === otherCategory.id
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            selected === otherCategory.id
                              ? colors.surfaceContainer
                              : colors.surfaceLow,
                        },
                      ]}
                    >
                      <View
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <CategoryIcon icon={otherCategory.icon} size={24} />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text
                          style={[
                            styles.rowTitle,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {otherCategory.name}
                        </Text>
                        <Text
                          style={[
                            styles.rowDesc,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {otherCategory.description}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    padding: 16,
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    ...typography.title,
    writingDirection: 'rtl',
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    minHeight: 68,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...typography.label,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  rowDesc: {
    ...typography.caption,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  otherFallback: {
    alignSelf: 'stretch',
    marginTop: 8,
    gap: 8,
  },
  otherHint: {
    ...typography.caption,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  otherButton: {
    alignSelf: 'stretch',
  },
});
