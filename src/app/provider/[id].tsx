import Svg, { Path } from 'react-native-svg';
import { categoryImages } from '../../features/discovery/data/categoryImages';
import { AvailabilityDetails } from '../../features/availability/AvailabilityDetails';
import { FavoriteButton } from '../../features/local/FavoriteButton';
import { useState } from 'react';
import { LoadingState } from '../../components/ui/LoadingState';
import { usePublicProvider } from '../../features/discovery/firebaseQueries';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { providerContactNumber } from '../../features/discovery/contact';
import { useProviderContactActions } from '../../features/discovery/useProviderContactActions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  BackHeader,
  EmptyState,
} from '../../features/discovery/components/DiscoveryUi';
import { useProviderState } from '../../features/provider/ProviderContext';
import {
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { firebaseMessage } from '../../features/auth/errors';

export default function ProviderDetailsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const {
    categories,
    configured,
    publicLoading,
    publicError,
    categoriesLoading,
  } = useProviderState();
  const statusStyles = useProviderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = usePublicProvider(id);
  const provider = detail.data;
  const description = provider?.description?.trim();
  const isPublished = provider?.dataSource === 'firestore';
  const category =
    categories.find((item) => item.id === provider?.categoryId) ??
    (provider
      ? {
          id: provider.categoryId,
          name: 'خدمة',
          description: '',
          icon: 'briefcase-outline' as const,
          group: 'community' as const,
          keywords: [],
        }
      : undefined);

  const phoneAvailable = Boolean(providerContactNumber(provider));
  const whatsappAvailable = Boolean(
    providerContactNumber(provider, 'whatsapp'),
  );
  const { busy, performContact } = useProviderContactActions(async () => {
    const fresh = await detail.refetch();
    if (fresh.isError)
      throw (
        fresh.error ??
        Object.assign(new Error('Read failed'), { code: 'unavailable' })
      );
    return fresh.data;
  }, provider ?? undefined);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {provider ? (
        <View style={styles.detailHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => router.back()}
            style={styles.headerAction}
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={colors.primaryDark}
            />
          </Pressable>
          <Text accessibilityRole="header" style={styles.headerTitle}>
            تفاصيل الخدمة
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="مشاركة الخدمة على واتساب"
            onPress={() => void performContact('share')}
            disabled={busy}
            style={styles.headerAction}
          >
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={22}
              color={colors.primaryDark}
            />
          </Pressable>
          <FavoriteButton provider={provider} iconOnly />
        </View>
      ) : (
        <BackHeader title="تفاصيل الخدمة" />
      )}
      {!(categoriesLoading ?? publicLoading) &&
      (configured === false || (!category && publicError)) ? (
        <RemoteDataNotice />
      ) : null}
      {configured &&
      ((id && detail.isPending) || (categoriesLoading ?? publicLoading)) ? (
        <LoadingState label="بنحمّل تفاصيل الخدمة…" />
      ) : detail.isError && !detail.data ? (
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={statusStyles.body}>
            {firebaseMessage(detail.error)}
          </Text>
          <ProviderAction
            title="جرّب تاني"
            onPress={() => {
              void detail.refetch();
            }}
          />
        </View>
      ) : provider && category ? (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.villageBanner}>
              <MaterialCommunityIcons
                name="office-building-outline"
                size={22}
                color={colors.primaryDark}
              />
              <Text style={styles.bannerText}>منشأة العمار — بلدنا أقرب</Text>
              <Text style={styles.directoryLabel}>دليل الخدمات</Text>
            </View>
            <View style={styles.identityCard}>
              {categoryImages[provider.categoryId] ? (
                <View
                  style={styles.cover}
                  pointerEvents="none"
                  accessibilityElementsHidden
                >
                  <Image
                    source={categoryImages[provider.categoryId]}
                    resizeMode="cover"
                    style={styles.coverImage}
                    accessible={false}
                  />
                  <Svg
                    width="100%"
                    height={48}
                    viewBox="0 0 400 48"
                    preserveAspectRatio="none"
                    style={styles.coverWave}
                  >
                    <Path
                      d="M0 30 C85 -10 140 60 230 28 S345 4 400 20 V48 H0Z"
                      fill={colors.surfaceContainer}
                    />
                    <Path
                      d="M0 37 C85 -3 140 67 230 35 S345 11 400 27 V48 H0Z"
                      fill={colors.surface}
                    />
                  </Svg>
                </View>
              ) : null}
              <View style={styles.identityBody}>
                <View
                  style={[
                    styles.avatarWrap,
                    Boolean(categoryImages[provider.categoryId]) &&
                      styles.overlappingAvatar,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={32}
                    color={colors.onPrimary}
                  />
                </View>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.serviceTitle}>{provider.serviceTitle}</Text>
                {provider.address?.trim() ? (
                  <View style={styles.heroLocation}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={19}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.heroLocationText}>
                      {provider.address}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.heroContacts}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="اتصال"
                    disabled={!phoneAvailable || busy}
                    onPress={() => void performContact('call')}
                    style={[
                      styles.heroContact,
                      styles.callEnabled,
                      (!phoneAvailable || busy) && styles.disabled,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="phone-outline"
                      size={21}
                      color={colors.onPrimary}
                    />
                    <Text style={styles.heroCallText}>اتصال</Text>
                  </Pressable>
                  {provider.whatsapp ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="واتساب"
                      disabled={!whatsappAvailable || busy}
                      onPress={() => void performContact('whatsapp')}
                      style={[
                        styles.heroContact,
                        styles.heroWhatsapp,
                        (!whatsappAvailable || busy) && styles.disabled,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="whatsapp"
                        size={21}
                        color={colors.primaryDark}
                      />
                      <Text style={styles.heroWhatsappText}>واتساب</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={26}
                  color={colors.primaryDark}
                />
                <View style={styles.summaryCopy}>
                  <Text style={styles.contactLabel}>التواصل</Text>
                  <Text style={styles.summaryValue}>مباشر مع مقدم الخدمة</Text>
                </View>
              </View>
              <View style={styles.summaryCard}>
                <MaterialCommunityIcons
                  name="tools"
                  size={26}
                  color={colors.primaryDark}
                />
                <View style={styles.summaryCopy}>
                  <Text style={styles.contactLabel}>التخصص</Text>
                  <Text style={styles.summaryValue}>{category.name}</Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionCard}>
              {provider.cachedAt ? (
                <Text style={styles.bodyText}>
                  بيانات محفوظة — آخر حفظ{' '}
                  {new Date(provider.cachedAt).toLocaleDateString('ar-EG')}.
                  ممكن تكون اتغيّرت.
                </Text>
              ) : null}
              <AvailabilityDetails value={provider} />
              {!provider.lastConfirmedAt ? (
                <Text style={styles.contactLabel}>
                  لسه مفيش تأكيد حديث من صاحب الخدمة.
                </Text>
              ) : null}
              {provider.lastConfirmedAt ? (
                <Text style={styles.contactLabel}>
                  آخر تأكيد من صاحب الخدمة:{' '}
                  {new Date(provider.lastConfirmedAt).toLocaleDateString(
                    'ar-EG',
                  )}
                </Text>
              ) : null}
              {!isPublished ? (
                <Text style={styles.demoBadgeText}>بيانات تجريبية</Text>
              ) : null}
            </View>
            {description ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeading}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={22}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.sectionTitle}>عن الخدمة</Text>
                </View>
                <Text style={styles.bodyText}>{description}</Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <MaterialCommunityIcons
                  name="card-account-phone-outline"
                  size={22}
                  color={colors.primaryDark}
                />
                <Text style={styles.sectionTitle}>بيانات التواصل والعنوان</Text>
              </View>
              <View style={styles.contactRow}>
                <View style={styles.contactIcon}>
                  <MaterialCommunityIcons
                    name="phone-outline"
                    size={22}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactLabel}>
                    {phoneAvailable
                      ? 'رقم الموبايل'
                      : 'رقم الموبايل مش متاح دلوقتي'}
                  </Text>
                  <Text style={styles.phone}>
                    {'\u2066'}
                    {provider.phone}
                    {'\u2069'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    phoneAvailable ? 'نسخ رقم الموبايل' : 'نسخ الرقم غير متاح'
                  }
                  hitSlop={{ top: 4, bottom: 4 }}
                  disabled={!phoneAvailable || busy}
                  accessibilityState={{
                    disabled: !phoneAvailable || busy,
                    busy,
                  }}
                  onPress={() => void performContact('copy')}
                  style={({ pressed }) => [
                    styles.copyButton,
                    (!phoneAvailable || busy) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={18}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.copyButtonText}>نسخ</Text>
                </Pressable>
              </View>
              {provider.whatsapp &&
              (!phoneAvailable ||
                providerContactNumber(provider, 'whatsapp') !==
                  providerContactNumber(provider)) ? (
                <View style={styles.contactRow}>
                  <View style={styles.contactIcon}>
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={22}
                      color={colors.primaryDark}
                    />
                  </View>
                  <View style={styles.contactCopy}>
                    <Text style={styles.contactLabel}>واتساب</Text>
                    <Text style={styles.phone}>
                      {'\u2066'}
                      {provider.whatsapp}
                      {'\u2069'}
                    </Text>
                  </View>
                  {!whatsappAvailable ? (
                    <Text style={styles.availableLabel}>غير متاح</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: tipsExpanded }}
                onPress={() => setTipsExpanded((value) => !value)}
                style={styles.sectionHeading}
              >
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={24}
                  color={colors.primaryDark}
                />
                <Text style={styles.sectionTitle}>قبل ما تتفق على الشغل</Text>
                <MaterialCommunityIcons
                  name={tipsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={colors.textSecondary}
                />
              </Pressable>
              {tipsExpanded ? (
                <Text style={styles.bodyText}>
                  وضّح الشغل المطلوب واتفق على السعر والميعاد قبل ما تبدأ. اتأكد
                  من الرقم والعنوان، ومتشاركش بياناتك الحساسة أو تحوّل مقدم قبل
                  ما تتأكد من صاحب الخدمة.
                </Text>
              ) : null}
            </View>
            <View style={[styles.sectionCard, styles.noticeCard]}>
              <View style={styles.sectionHeading}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={24}
                  color={colors.primaryDark}
                />
                <Text style={styles.sectionTitle}>خلّي بالك قبل ما تتواصل</Text>
              </View>
              <Text style={styles.contactLabel}>عن بيانات الخدمة</Text>
              <Text style={styles.bodyText}>
                صاحب الخدمة هو اللي بيضيف بياناته. مراجعتها قبل النشر مش ضمان
                لهويته أو جودة شغله.
              </Text>
              <Text style={styles.bodyText}>
                التواصل مباشر مع مقدم الخدمة. التطبيق مش بيدير حجز أو دفع، ووجود
                رقم واتساب مش معناه أكيد إن عليه حساب.
              </Text>
              {!isPublished ? (
                <Text style={styles.bodyText}>
                  أرقام النسخة التجريبية غير مفعلة.
                </Text>
              ) : null}
              <Text style={styles.bodyText}>
                لو لقيت بيانات مش صحيحة، ابعت بلاغ للمشرف من الزر اللي تحت.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/provider/report/[id]',
                  params: { id: provider.id },
                })
              }
              style={({ pressed }) => [
                styles.reportButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name="flag-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.reportText}>بلّغنا لو البيانات مش صحيحة</Text>
            </Pressable>
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <Pressable
              disabled={!phoneAvailable || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !phoneAvailable || busy, busy }}
              accessibilityLabel={
                phoneAvailable
                  ? 'اتصال بمقدم الخدمة'
                  : 'رقم الموبايل مش متاح دلوقتي'
              }
              onPress={() => void performContact('call')}
              style={[
                styles.bottomActionDisabled,
                phoneAvailable && styles.callEnabled,
              ]}
            >
              <MaterialCommunityIcons
                name="phone-outline"
                size={20}
                color={phoneAvailable ? colors.onPrimary : colors.muted}
              />
              <Text
                style={[
                  styles.bottomActionText,
                  phoneAvailable && { color: colors.onPrimary },
                ]}
              >
                اتصال
              </Text>
            </Pressable>
            {provider.whatsapp ? (
              <Pressable
                disabled={!whatsappAvailable || busy}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !whatsappAvailable || busy,
                  busy,
                }}
                accessibilityLabel={
                  whatsappAvailable
                    ? 'فتح واتساب مقدم الخدمة'
                    : 'رقم واتساب مش متاح دلوقتي'
                }
                onPress={() => void performContact('whatsapp')}
                style={[
                  styles.bottomActionDisabled,
                  whatsappAvailable && styles.whatsappEnabled,
                ]}
              >
                <MaterialCommunityIcons
                  name="whatsapp"
                  size={20}
                  color={whatsappAvailable ? colors.primaryDark : colors.muted}
                />
                <Text
                  style={[
                    styles.whatsappText,
                    whatsappAvailable && { color: colors.primaryDark },
                  ]}
                >
                  مراسلة واتساب
                </Text>
              </Pressable>
            ) : null}
          </SafeAreaView>
        </>
      ) : !configured ||
        (categoriesLoading ?? publicLoading) ||
        publicError ? null : (
        <View style={styles.invalidProvider}>
          <EmptyState
            actionLabel="استكشف الخدمات"
            onAction={() => router.replace('/(tabs)/explore')}
            title="الخدمة غير موجودة"
            message="ارجع واستكشف الخدمات المتاحة"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    headerAction: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.title,
      color: colors.primaryDark,
      flex: 1,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    cover: { width: '100%', aspectRatio: 2, position: 'relative' },
    coverImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    coverWave: { position: 'absolute', bottom: -1, left: 0 },
    identityBody: {
      width: '100%',
      padding: spacing.md,
      paddingTop: 0,
      gap: spacing.sm,
      alignItems: 'center',
    },
    overlappingAvatar: { marginTop: -48 },
    heroLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    heroLocationText: {
      ...typography.body,
      color: colors.textSecondary,
      flexShrink: 1,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    heroContacts: {
      flexDirection: 'row',
      gap: spacing.sm,
      width: '100%',
      marginTop: spacing.sm,
    },
    heroContact: {
      flex: 1,
      minHeight: 48,
      padding: spacing.sm,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    heroCallText: { ...typography.button, color: colors.onPrimary },
    heroWhatsapp: { backgroundColor: colors.surfaceContainer },
    heroWhatsappText: { ...typography.button, color: colors.primaryDark },
    safeArea: { flex: 1, backgroundColor: colors.background },
    villageBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 24,
      backgroundColor: colors.surfaceLow,
    },
    bannerText: {
      ...typography.caption,
      flex: 1,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    directoryLabel: { ...typography.caption, color: colors.textSecondary },
    heroDecoration: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      top: -65,
      end: -55,
      backgroundColor: colors.surfaceLow,
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      minWidth: 130,
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    summaryCopy: { gap: spacing.xs, alignItems: 'center' },
    summaryValue: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    noticeCard: {
      backgroundColor: colors.surfaceLow,
      borderStartWidth: 5,
      borderStartColor: colors.primary,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    identityCard: {
      padding: 0,
      overflow: 'hidden',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    avatarWrap: {
      width: 68,
      height: 68,
      borderWidth: 4,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 34,
      backgroundColor: colors.primary,
    },
    providerName: {
      ...typography.hero,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    serviceTitle: {
      ...typography.body,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    addressLine: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 24,
      backgroundColor: colors.surfaceLow,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    address: {
      ...typography.body,
      flexShrink: 1,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    demoBadgeText: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    sectionCard: {
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceContainer,
      gap: spacing.md,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      flex: 1,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    bodyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    contactRow: {
      flexWrap: 'wrap',
      minHeight: 80,
      padding: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
    },
    contactIcon: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: colors.surface,
    },
    contactCopy: { flex: 1, minWidth: 160, gap: 2, alignItems: 'stretch' },
    contactLabel: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    phone: {
      ...typography.title,
      color: colors.textPrimary,
      letterSpacing: 1,
      writingDirection: 'ltr',
    },
    copyButton: {
      minHeight: 48,
      minWidth: 48,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    copyButtonText: { ...typography.caption, color: colors.primaryDark },
    availableLabel: {
      ...typography.caption,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      color: colors.muted,
      borderRadius: 12,
      backgroundColor: colors.surface,
      writingDirection: 'rtl',
    },
    addressCard: {
      minHeight: 76,
      padding: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
    },
    addressTitle: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    reportButton: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    reportText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    bottomBar: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceContainer,
    },
    bottomActionDisabled: {
      minHeight: 56,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
    },
    callEnabled: { backgroundColor: colors.actionBackground },
    whatsappEnabled: { backgroundColor: colors.surfaceContainer },
    bottomActionText: {
      ...typography.body,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    whatsappText: {
      ...typography.body,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    invalidProvider: { flex: 1, padding: spacing.md, justifyContent: 'center' },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  });
