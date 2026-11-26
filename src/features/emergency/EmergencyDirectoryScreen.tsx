import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { fontFamily, typography } from '../../theme/typography';
import { BackHeader } from '../discovery/components/DiscoveryUi';
import { emergencySections, type EmergencySectionId } from './numbers';

const sectionFilters: { id: 'all' | EmergencySectionId; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'urgent', label: 'طوارئ فورية' },
  { id: 'toukh', label: 'طوخ والقليوبية' },
  { id: 'utilities', label: 'المرافق' },
  { id: 'roads-support', label: 'الطرق والصحة' },
];

export function EmergencyDirectoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [selectedSection, setSelectedSection] = useState<
    'all' | EmergencySectionId
  >('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const dial = async (number: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      setError(`مش قادرين نفتح الاتصال. اطلب ${number} من تليفونك.`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const visibleSections = emergencySections.filter(
    (section) => selectedSection === 'all' || section.id === selectedSection,
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <BackHeader title="أرقام الطوارئ" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contextCard}>
          <View style={styles.contextIcon}>
            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={24}
              color={colors.warning}
              accessibilityElementsHidden
            />
          </View>
          <View style={styles.contextCopy}>
            <Text accessibilityRole="header" style={styles.contextTitle}>
              لأهالي منشأة العمار
            </Text>
            <Text style={styles.contextBody}>
              هنا تلاقي أرقام الطوارئ في مصر، وجهات قريبة منك في طوخ والقليوبية.
              اختار الجهة واضغط «اتصال» لفتح الرقم على موبايلك.
            </Text>
          </View>
        </View>

        <View style={styles.filters}>
          {sectionFilters.map((filter) => {
            const selected = selectedSection === filter.id;
            return (
              <Pressable
                key={filter.id}
                accessibilityRole="button"
                accessibilityLabel={filter.label}
                accessibilityState={{ selected }}
                onPress={() => setSelectedSection(filter.id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons
              name="phone-alert-outline"
              size={20}
              color={colors.error}
              accessibilityElementsHidden
            />
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              selectable
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {visibleSections.map((section) => {
          const warm = section.id === 'urgent' || section.id === 'toukh';
          return (
            <View key={section.id} style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {section.title}
                </Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <View style={styles.sectionItems}>
                {section.items.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemTop}>
                      <View
                        style={[
                          styles.itemIcon,
                          {
                            backgroundColor: warm
                              ? colors.pendingBackground
                              : colors.categoryBlue,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={item.icon}
                          size={22}
                          color={warm ? colors.warning : colors.primaryDark}
                          accessibilityElementsHidden
                        />
                      </View>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{item.label}</Text>
                        <Text style={styles.itemDescription}>
                          {item.description}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemFooter}>
                      <View style={styles.numberBadge}>
                        <Text selectable style={styles.numberText}>
                          {item.number}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`اتصل ب${item.label} على ${item.number}`}
                        accessibilityHint="بيفتح تطبيق الاتصال بالرقم ده"
                        disabled={busy}
                        onPress={() => void dial(item.number)}
                        style={styles.callButton}
                      >
                        <MaterialCommunityIcons
                          name="phone-outline"
                          size={18}
                          color={colors.onPrimary}
                          accessibilityElementsHidden
                        />
                        <Text style={styles.callButtonText}>اتصال</Text>
                      </Pressable>
                    </View>
                    {item.secondaryNumber ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`رقم بديل للتواصل مع ${item.label}: ${item.secondaryNumber}`}
                        accessibilityHint="بيفتح تطبيق الاتصال بالرقم البديل"
                        disabled={busy}
                        onPress={() => void dial(item.secondaryNumber!)}
                        style={styles.secondaryCallButton}
                      >
                        <MaterialCommunityIcons
                          name="phone-outline"
                          size={17}
                          color={colors.primaryDark}
                          accessibilityElementsHidden
                        />
                        <Text style={styles.secondaryCallText}>رقم بديل</Text>
                        <Text style={styles.secondaryNumber}>
                          {item.secondaryNumber}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={styles.footerNote}>
          تقدر ترجع للأرقام دي من غير إنترنت.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      maxWidth: 840,
      width: '100%',
      alignSelf: 'center',
    },
    contextCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: spacing.md,
      borderRadius: 20,
      backgroundColor: colors.pendingBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contextCopy: { flex: 1, minWidth: 0, gap: 4 },
    contextTitle: {
      ...typography.title,
      color: colors.warning,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    contextBody: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipSelected: {
      backgroundColor: colors.actionBackground,
      borderColor: colors.actionBackground,
    },
    chipText: {
      ...typography.caption,
      fontFamily: fontFamily.medium,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    chipTextSelected: { color: colors.onPrimary },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.errorContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: {
      ...typography.caption,
      flex: 1,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    section: { gap: 10 },
    sectionHeading: { gap: 2 },
    sectionTitle: {
      ...typography.sectionTitle,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    sectionSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    sectionItems: { gap: 10 },
    itemCard: {
      padding: 16,
      gap: 12,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    itemIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemCopy: { flex: 1, minWidth: 0, gap: 2 },
    itemTitle: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    itemDescription: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    itemFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    numberBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    numberText: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'ltr',
    },
    callButton: {
      minHeight: 44,
      minWidth: 104,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.actionBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    callButtonText: {
      ...typography.label,
      color: colors.onPrimary,
      writingDirection: 'rtl',
    },
    secondaryCallButton: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    secondaryNumber: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'ltr',
      textAlign: 'center',
    },
    secondaryCallText: {
      ...typography.caption,
      fontFamily: fontFamily.medium,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    footerNote: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'center',
      writingDirection: 'rtl',
      paddingTop: spacing.xs,
    },
  });
