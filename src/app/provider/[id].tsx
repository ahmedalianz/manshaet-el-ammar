import { ServiceDetailsPhoto } from '../../features/provider/ServiceDetailsPhoto';
import { categoryImages } from '../../features/discovery/data/categoryImages';
import { ServiceWorkingHours } from '../../features/availability/ServiceWorkingHours';
import { ServiceDetailsSection } from '../../features/provider/ServiceDetailsSection';
import { FavoriteButton } from '../../features/local/FavoriteButton';
import { useEffect, useRef, useState } from 'react';
import { LoadingState } from '../../components/ui/LoadingState';
import { usePublicProvider } from '../../features/discovery/firebaseQueries';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import {
  MotionPressable as Pressable,
  useReducedMotion,
} from '../../components/ui/Motion';
import { providerContactNumber } from '../../features/discovery/contact';
import { useProviderContactActions } from '../../features/discovery/useProviderContactActions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { serviceConfirmationDue } from '../../features/provider/confirmation';
import { ProviderClaimSection } from '../../features/claims/ProviderClaimSection';

export default function ProviderDetailsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const reduced = useReducedMotion();
  const [bottomBarVisible, setBottomBarVisible] = useState(false);
  const [barProgress] = useState(() => new Animated.Value(0));
  const layoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const evaluateBottomBar = () => {
    const scrollableDistance =
      contentHeightRef.current - layoutHeightRef.current;
    if (scrollableDistance <= 24 || layoutHeightRef.current <= 0) {
      setBottomBarVisible(false);
      return;
    }
    const distanceFromEnd =
      contentHeightRef.current -
      (scrollOffsetRef.current + layoutHeightRef.current);
    setBottomBarVisible((current) =>
      current
        ? distanceFromEnd <= 84
        : scrollOffsetRef.current > 24 && distanceFromEnd <= 48,
    );
  };
  useEffect(() => {
    barProgress.stopAnimation();
    if (reduced !== false) {
      barProgress.setValue(bottomBarVisible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(barProgress, {
      toValue: bottomBarVisible ? 1 : 0,
      duration: bottomBarVisible ? 240 : 180,
      easing: bottomBarVisible
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [bottomBarVisible, reduced, barProgress]);
  const {
    categories,
    configured,
    publicLoading,
    publicError,
    categoriesLoading,
    role,
    userId,
    initializing,
  } = useProviderState();
  const statusStyles = useProviderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = usePublicProvider(id);
  const provider = detail.data;
  const description = provider?.description
    ?.split('\n')
    .filter(
      (line) =>
        !(
          provider?.weeklyHours &&
          /^(كل يوم من|مواعيد العمل[:：]|أوقات العمل[:：]|ساعات العمل[:：])/.test(
            line.trim(),
          )
        ),
    )
    .join('\n')
    .trim();
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
            style={[styles.headerAction, styles.backAction]}
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={colors.primaryDark}
            />
          </Pressable>
          <Text
            pointerEvents="none"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
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
          <View style={styles.headerAction}>
            <FavoriteButton provider={provider} iconOnly />
          </View>
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
        <View style={styles.bodyWrap}>
          <ScrollView
            testID="provider-details-scroll"
            scrollEventThrottle={16}
            onLayout={(event) => {
              layoutHeightRef.current = event.nativeEvent.layout.height;
              evaluateBottomBar();
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              evaluateBottomBar();
            }}
            onScroll={(event) => {
              const { contentOffset, layoutMeasurement, contentSize } =
                event.nativeEvent;
              if (layoutMeasurement?.height)
                layoutHeightRef.current = layoutMeasurement.height;
              if (contentSize?.height)
                contentHeightRef.current = contentSize.height;
              scrollOffsetRef.current = contentOffset.y;
              evaluateBottomBar();
            }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.identityCard}>
              {provider.placePhoto || categoryImages[provider.categoryId] ? (
                <ServiceDetailsPhoto
                  key={provider.placePhoto?.detailUrl ?? provider.categoryId}
                  photo={provider.placePhoto}
                  fallback={categoryImages[provider.categoryId]}
                />
              ) : null}
              <View style={styles.heroIdentity}>
                <View style={styles.identityHeading}>
                  <View style={styles.avatarWrap}>
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={30}
                      color={colors.primaryDark}
                    />
                  </View>
                  <Text accessibilityRole="header" style={styles.providerName}>
                    {provider.name}
                  </Text>
                </View>
                <View style={styles.serviceBadge}>
                  <Text style={styles.serviceTitle}>
                    {provider.serviceTitle}
                  </Text>
                </View>
                {provider.serviceMode ? (
                  <View style={styles.serviceModeRow}>
                    <MaterialCommunityIcons
                      name={
                        provider.serviceMode === 'mobile'
                          ? 'truck-delivery-outline'
                          : 'storefront-outline'
                      }
                      size={18}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.serviceModeText}>
                      {
                        {
                          fixed: 'الخدمة في مقر ثابت',
                          mobile: 'خدمة متنقلة · تصل إليك',
                          both: 'في المقر أو عند العميل',
                        }[provider.serviceMode]
                      }
                    </Text>
                  </View>
                ) : null}
                {provider.address?.trim() &&
                !['متحرك', 'متنقل', 'خدمة متنقلة', 'بروح للعميل'].includes(
                  provider.address.trim(),
                ) ? (
                  <View style={styles.heroLocation}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={18}
                      color={colors.muted}
                    />
                    <Text style={styles.heroLocationText}>
                      {provider.address}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.identityBody}>
                <View style={styles.heroContacts}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      phoneAvailable
                        ? 'اتصال بمقدم الخدمة'
                        : 'رقم الموبايل مش متاح دلوقتي'
                    }
                    accessibilityState={{
                      disabled: !phoneAvailable || busy,
                      busy,
                    }}
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
                      size={24}
                      color={colors.onPrimary}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.heroCallText}>اتصال</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      phoneAvailable ? 'نسخ رقم التواصل' : 'نسخ الرقم غير متاح'
                    }
                    accessibilityState={{
                      disabled: !phoneAvailable || busy,
                      busy,
                    }}
                    disabled={!phoneAvailable || busy}
                    onPress={() => void performContact('copy')}
                    style={[
                      styles.heroContact,
                      styles.heroWhatsapp,
                      (!phoneAvailable || busy) && styles.disabled,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={24}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.heroWhatsappText}>نسخ الرقم</Text>
                  </Pressable>
                  {provider.whatsapp ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        whatsappAvailable
                          ? 'فتح واتساب مقدم الخدمة'
                          : 'رقم واتساب مش متاح دلوقتي'
                      }
                      accessibilityState={{
                        disabled: !whatsappAvailable || busy,
                        busy,
                      }}
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
                        size={24}
                        color={colors.success}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.heroWhatsappText}>واتساب</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.heroMetaRow}>
                  <View style={styles.heroPhonePill}>
                    <MaterialCommunityIcons
                      name="phone-outline"
                      size={16}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.heroPhoneText}>
                      {'\u2066'}
                      {provider.phone}
                      {'\u2069'}
                    </Text>
                  </View>
                  {provider.whatsapp &&
                  (!phoneAvailable ||
                    providerContactNumber(provider, 'whatsapp') !==
                      providerContactNumber(provider)) ? (
                    <View style={[styles.heroPhonePill, styles.separatePhone]}>
                      <MaterialCommunityIcons
                        name="whatsapp"
                        size={16}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.heroPhoneText}>
                        {'\u2066'}
                        {provider.whatsapp}
                        {'\u2069'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.contactSummary]}>
                <MaterialCommunityIcons
                  name="video-outline"
                  size={26}
                  color={colors.primaryDark}
                />
                <View style={styles.summaryCopy}>
                  <Text style={styles.contactLabel}>التواصل</Text>
                  <Text style={styles.summaryValue}>مباشر مع مقدم الخدمة</Text>
                </View>
              </View>
              <View style={[styles.summaryCard, styles.specialtySummary]}>
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

            <ServiceWorkingHours key={provider.id} value={provider} />
            {description ? (
              <ServiceDetailsSection
                title="عن الخدمة"
                icon="information-outline"
                initiallyExpanded
              >
                <Text style={styles.aboutDescription}>{description}</Text>
                {provider.serviceTitle.trim() &&
                provider.serviceTitle.trim().length <= 48 ? (
                  <View style={styles.aboutChips}>
                    <View style={styles.aboutChip}>
                      <MaterialCommunityIcons
                        name={category.icon}
                        size={19}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.aboutChipText}>
                        {provider.serviceTitle.trim()}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </ServiceDetailsSection>
            ) : null}
            <ServiceDetailsSection
              title="خلّي بالك قبل ما تتواصل"
              icon="shield-check-outline"
              initiallyExpanded
            >
              <View style={styles.safetyRow}>
                {(
                  [
                    {
                      icon: 'chat-processing-outline',
                      text: 'تواصل مباشرة مع مقدم الخدمة',
                      tint: colors.categoryLavender,
                      color: colors.primaryDark,
                    },
                    {
                      icon: 'account-outline',
                      text: 'تأكد من هوية مقدم الخدمة',
                      tint: colors.categorySand,
                      color: colors.warning,
                    },
                    {
                      icon: 'credit-card-outline',
                      text: 'لا تدفع مقدماً إلا بعد التأكد',
                      tint: colors.errorContainer,
                      color: colors.error,
                    },
                  ] as const
                ).map((tip) => (
                  <View key={tip.icon} style={styles.safetyTip}>
                    <View
                      style={[styles.safetyIcon, { backgroundColor: tip.tint }]}
                    >
                      <MaterialCommunityIcons
                        name={tip.icon}
                        size={24}
                        color={tip.color}
                        accessibilityElementsHidden
                      />
                    </View>
                    <Text style={styles.safetyText}>{tip.text}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.contactLabel}>
                التواصل مباشر مع مقدم الخدمة. التطبيق مش بيدير حجز أو دفع،
                ومراجعة البيانات مش ضمان لهويته أو جودة شغله.
              </Text>
              {!isPublished ? (
                <Text style={styles.contactLabel}>
                  أرقام النسخة التجريبية غير مفعلة.
                </Text>
              ) : null}
            </ServiceDetailsSection>
            <View style={styles.freshness}>
              {provider.cachedAt ? (
                <Text style={styles.bodyText}>
                  بيانات محفوظة — آخر حفظ{' '}
                  {new Date(provider.cachedAt).toLocaleDateString('ar-EG')}.
                  ممكن تكون اتغيّرت.
                </Text>
              ) : null}
              {!provider.lastConfirmedAt ? (
                provider.updatedAt && !serviceConfirmationDue(provider) ? (
                  <Text style={styles.contactLabel}>
                    آخر تحديث منشور:{' '}
                    {new Date(provider.updatedAt).toLocaleDateString('ar-EG')}
                  </Text>
                ) : (
                  <Text style={styles.contactLabel}>
                    لسه مفيش تأكيد حديث من صاحب الخدمة.
                  </Text>
                )
              ) : (
                <Text style={styles.contactLabel}>
                  آخر تأكيد من صاحب الخدمة:{' '}
                  {new Date(provider.lastConfirmedAt).toLocaleDateString(
                    'ar-EG',
                  )}
                </Text>
              )}
              {!isPublished ? (
                <Text style={styles.demoBadgeText}>بيانات تجريبية</Text>
              ) : null}
            </View>

            {role === 'admin' &&
            Boolean(userId) &&
            !initializing &&
            isPublished ? (
              <ProviderAction
                secondary
                title="تعديل بيانات الخدمة"
                onPress={() =>
                  router.push({
                    pathname: '/provider/edit/[id]',
                    params: { id: provider.id, from: 'provider' },
                  })
                }
              />
            ) : null}

            <ProviderClaimSection provider={provider} />

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

          <Animated.View
            testID="provider-bottom-bar"
            pointerEvents={bottomBarVisible ? 'auto' : 'none'}
            accessibilityElementsHidden={!bottomBarVisible}
            importantForAccessibility={
              bottomBarVisible ? 'auto' : 'no-hide-descendants'
            }
            style={[
              styles.bottomBarWrap,
              {
                opacity: barProgress,
                transform: [
                  {
                    translateY: barProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [88, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
              <Pressable
                disabled={!phoneAvailable || busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: !phoneAvailable || busy, busy }}
                accessibilityLabel={
                  phoneAvailable
                    ? 'اتصال سريع بمقدم الخدمة'
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
                  accessibilityElementsHidden
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
                      ? 'مراسلة مقدم الخدمة على واتساب'
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
                    color={
                      whatsappAvailable ? colors.primaryDark : colors.muted
                    }
                    accessibilityElementsHidden
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
          </Animated.View>
        </View>
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
    bodyWrap: {
      flex: 1,
      position: 'relative',
    },
    detailHeader: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 20,
    },
    headerAction: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backAction: { marginEnd: 'auto' },
    headerTitle: {
      position: 'absolute',
      left: 70,
      right: 70,
      alignSelf: 'center',
      ...typography.title,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: {
      direction: 'rtl',
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 112,
      gap: 10,
    },
    identityCard: {
      overflow: 'hidden',
      borderRadius: 26,
      backgroundColor: colors.surface,
      shadowColor: colors.primaryDark,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    heroIdentity: {
      width: '100%',
      alignSelf: 'flex-start',
      alignItems: 'flex-start',
      padding: 18,
      gap: 8,
    },
    identityHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    avatarWrap: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    providerName: {
      flex: 1,
      ...typography.hero,
      fontSize: 24,
      lineHeight: 36,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    serviceBadge: { alignSelf: 'stretch' },
    serviceTitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    heroLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    heroLocationText: {
      ...typography.caption,
      color: colors.muted,
      flexShrink: 1,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    identityBody: { paddingHorizontal: 12, paddingBottom: 14, gap: 10 },
    heroContacts: { flexDirection: 'row', gap: 8, width: '100%' },
    heroContact: {
      flex: 1,
      minHeight: 64,
      paddingHorizontal: 6,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    heroCallText: { ...typography.button, color: colors.onPrimary },
    heroWhatsapp: { backgroundColor: colors.surfaceLow },
    heroWhatsappText: {
      ...typography.button,
      fontSize: 14,
      color: colors.primaryDark,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 24,
      backgroundColor: colors.surfaceContainer,
    },
    heroPhonePill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 10,
      minHeight: 34,
    },
    separatePhone: {
      borderStartWidth: StyleSheet.hairlineWidth,
      borderStartColor: colors.accent,
    },
    heroPhoneText: {
      ...typography.label,
      fontSize: 14,
      color: colors.primaryDark,
      writingDirection: 'ltr',
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 10,
    },
    summaryCard: {
      flex: 1,
      minWidth: 140,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 18,
    },
    contactSummary: { backgroundColor: colors.publishedBackground },
    specialtySummary: { backgroundColor: colors.surfaceContainer },
    summaryCopy: { flex: 1, gap: 0 },
    summaryValue: {
      ...typography.label,
      fontSize: 13,
      lineHeight: 22,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    freshness: { paddingHorizontal: 12, paddingTop: 4, gap: 4 },
    serviceModeText: {
      ...typography.label,
      fontSize: 13,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    serviceModeRow: {
      alignSelf: 'flex-start',
      borderRadius: 12,
      backgroundColor: colors.surfaceContainer,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    aboutDescription: {
      ...typography.body,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
      lineHeight: 25,
    },
    aboutChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    aboutChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 22,
      backgroundColor: colors.surfaceLow,
      maxWidth: '100%',
    },
    aboutChipText: {
      ...typography.caption,
      fontSize: 12,
      color: colors.primaryDark,
      flexShrink: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    bodyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    contactLabel: {
      ...typography.caption,
      fontSize: 12,
      lineHeight: 21,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    demoBadgeText: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    safetyRow: { flexDirection: 'row', paddingTop: 4 },
    safetyTip: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 6 },
    safetyIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    safetyText: {
      ...typography.label,
      fontSize: 13,
      lineHeight: 22,
      color: colors.textPrimary,
      textAlign: 'center',
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
    bottomBarWrap: {
      position: 'absolute',
      start: 0,
      end: 0,
      bottom: 0,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
      elevation: 8,
    },
    bottomBar: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
