import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatAvailabilityField } from '../availability/format';
import { modeNames } from '../availability/AvailabilityFields';
import { CategoryIcon } from '../discovery/components/DiscoveryUi';
import { categoryImages } from '../discovery/data/categoryImages';
import type { IconName } from '../discovery/types';
import type { PhotoDraft } from '../photos/api';
import { AddServiceArtwork } from './AddServiceArtwork';
import type { ServiceValues } from './types';
import { normalizeMobile } from './validation';

export function ServiceReview({
  values,
  categoryName,
  categoryIcon,
  photoDraft,
  hasApprovedPhoto = false,
  approvedPhotoUrl,
  onEdit,
}: {
  values: ServiceValues;
  categoryName?: string;
  categoryIcon?: IconName;
  photoDraft?: PhotoDraft;
  hasApprovedPhoto?: boolean;
  approvedPhotoUrl?: string;
  onEdit: (step: 1 | 2) => void;
}) {
  const s = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 280;

  const photoLabel =
    photoDraft?.action === 'replace'
      ? 'صورة جديدة قيد المراجعة بعد الإرسال'
      : photoDraft?.action === 'remove'
        ? 'طلب إزالة الصورة المنشورة'
        : hasApprovedPhoto
          ? 'الاحتفاظ بالصورة المنشورة'
          : undefined;

  const coverSource: ImageSourcePropType | undefined =
    photoDraft?.action === 'replace' && photoDraft.localUri
      ? { uri: photoDraft.localUri }
      : photoDraft?.action !== 'remove' && approvedPhotoUrl
        ? { uri: approvedPhotoUrl }
        : categoryImages[values.categoryId];

  const sections = [
    {
      title: 'بيانات الخدمة',
      icon: 'storefront-outline' as const,
      step: 1 as const,
      rows: [
        ['اسم مقدم الخدمة', values.name],
        ['القسم', categoryName],
        ['التخصص', values.serviceTitle],
        ['الوصف', values.description],
        ['صورة المكان', photoLabel],
      ],
    },
    {
      title: 'التواصل والمكان',
      icon: 'map-marker-radius-outline' as const,
      step: 2 as const,
      rows: [
        ['رقم التواصل', normalizeMobile(values.phone)],
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
      <View
        style={[
          s.heroCard,
          { backgroundColor: isDark ? '#203D50' : '#E4F0F8' },
        ]}
      >
        <View style={[s.heroRow, stacked && s.heroStacked]}>
          <View style={s.heroCopy}>
            <View style={s.heroTitleRow}>
              {categoryIcon ? (
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <CategoryIcon icon={categoryIcon} size={22} />
                </View>
              ) : null}
              <Text style={s.heroTitle}>خطوة أخيرة قبل النشر</Text>
            </View>
            <Text style={s.hint}>
              راجع بيانات خدمتك قبل الإرسال. تقدر تعدّل أي جزء.
            </Text>
          </View>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={s.heroMedia}
          >
            {coverSource ? (
              <View style={s.coverFrame}>
                <Image
                  source={coverSource}
                  accessible={false}
                  style={s.coverImage}
                  resizeMode="cover"
                />
                <View style={s.coverBadge}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={colors.success}
                    accessibilityElementsHidden
                  />
                </View>
              </View>
            ) : (
              <AddServiceArtwork variant="review" />
            )}
          </View>
        </View>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={s.card}>
          <View style={s.heading}>
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={s.sectionIconBox}
            >
              <MaterialCommunityIcons
                name={section.icon}
                size={20}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
            </View>
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
                size={18}
                color={colors.primaryDark}
                accessibilityElementsHidden
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
    heroCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      overflow: 'hidden',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    heroCopy: { flex: 1, minWidth: 0, gap: 8 },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    heroTitle: {
      ...typography.title,
      color: c.primaryDark,
      flexShrink: 1,
      writingDirection: 'rtl',
    },
    heroMedia: {
      alignSelf: 'center',
      flexShrink: 0,
    },
    coverFrame: {
      width: 92,
      height: 92,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: c.surface,
      backgroundColor: c.surface,
      position: 'relative',
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverBadge: {
      position: 'absolute',
      bottom: 6,
      end: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    sectionIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.surfaceContainer,
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
