import { FavoriteButton } from '../../local/FavoriteButton';
import { MotionPressable as Pressable } from '../../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Image,
  I18nManager,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useId, type ReactNode } from 'react';
import { categoryImages } from '../data/categoryImages';

import type { ThemeColors } from '../../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import type { ServiceProvider, ServiceCategory } from '../types';
import { useProviderContactActions } from '../useProviderContactActions';
import { providerContactNumber } from '../contact';
import { fetchProvider } from '../../provider/firebaseRepository';
import { db } from '../../../lib/firebase/firestore';
import { CategoryIcon } from './DiscoveryUi';

export function ProviderCard({
  provider,
  onPress,
  category,
  presentation = 'default',
  managementActions,
}: {
  provider: ServiceProvider;
  category?: ServiceCategory;
  onPress: () => void;
  presentation?: 'default' | 'home' | 'directory' | 'illustrated';
  managementActions?: ReactNode;
}) {
  const gradientId = useId().replace(/:/g, '');
  const home = presentation === 'home';
  const photo =
    presentation === 'illustrated'
      ? categoryImages[provider.categoryId]
      : undefined;
  const { width, fontScale } = useWindowDimensions();
  const stackedPhoto = width < 360 || fontScale >= 1.4;
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const phoneAvailable = Boolean(providerContactNumber(provider));
  const whatsappAvailable = Boolean(
    providerContactNumber(provider, 'whatsapp'),
  );
  const { busy, performContact } = useProviderContactActions(async () => {
    if (!db) throw new Error('Database unavailable');
    return fetchProvider(db, provider.id);
  }, provider);

  const directory = presentation === 'directory';
  const location = provider.address?.trim();
  const displayLocation =
    provider.serviceMode === 'mobile' ? 'خدمة متنقلة' : location;
  const content = (
    <>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`تفاصيل ${provider.name}`}
          accessibilityHint={`${provider.serviceTitle}${displayLocation ? `، ${displayLocation}` : ''}. اضغط لعرض التفاصيل كاملة`}
          onPress={(event) => {
            event?.stopPropagation();
            onPress();
          }}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        >
          <View style={styles.topRow}>
            {!photo ? (
              <CategoryIcon icon={category?.icon ?? 'briefcase-outline'} />
            ) : null}
            <View style={styles.details}>
              <Text style={styles.name}>{provider.name}</Text>
              <Text numberOfLines={2} style={styles.serviceTitle}>
                {provider.serviceTitle}
              </Text>
              {displayLocation ? (
                <View style={styles.addressRow}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={14}
                    color={colors.muted}
                    accessibilityElementsHidden
                  />
                  <Text numberOfLines={1} style={styles.address}>
                    {displayLocation}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {provider.dataSource !== 'firestore' ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>بيانات تجريبية</Text>
            </View>
          ) : null}
        </Pressable>
        <FavoriteButton provider={provider} iconOnly />
      </View>
      {provider.cachedAt ? (
        <Text style={styles.address}>
          بيانات محفوظة —{' '}
          {new Date(provider.cachedAt).toLocaleDateString('ar-EG')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            phoneAvailable
              ? `اتصال بـ ${provider.name}`
              : 'رقم الموبايل مش متاح دلوقتي'
          }
          disabled={!phoneAvailable || busy}
          accessibilityState={{ disabled: !phoneAvailable || busy, busy }}
          onPress={(event) => {
            event?.stopPropagation();
            void performContact('call');
          }}
          style={[styles.actionDisabled, phoneAvailable && styles.callEnabled]}
        >
          <MaterialCommunityIcons
            name="phone-outline"
            size={17}
            color={phoneAvailable ? colors.onPrimary : colors.muted}
          />
          <Text
            style={[
              styles.actionDisabledText,
              phoneAvailable && { color: colors.onPrimary },
            ]}
          >
            {phoneAvailable ? 'اتصال' : 'اتصال غير متاح'}
          </Text>
        </Pressable>
        {whatsappAvailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`واتساب ${provider.name}`}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
            onPress={(event) => {
              event?.stopPropagation();
              void performContact('whatsapp');
            }}
            style={[styles.actionDisabled, styles.whatsappEnabled]}
          >
            <MaterialCommunityIcons
              name="whatsapp"
              size={17}
              color={colors.primaryDark}
            />
            <Text
              style={[styles.actionDisabledText, { color: colors.primaryDark }]}
            >
              واتساب
            </Text>
          </Pressable>
        ) : null}
      </View>
      {managementActions ? (
        <View style={styles.managementActions}>{managementActions}</View>
      ) : null}
    </>
  );
  if (photo) {
    return (
      <View style={[styles.card, styles.illustratedCard]}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.photoBackdrop, stackedPhoto && styles.quietBackdrop]}
        >
          <Image
            source={photo}
            resizeMode="cover"
            accessible={false}
            style={styles.photo}
          />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient
                id={gradientId}
                x1={I18nManager.isRTL ? '0' : '1'}
                y1="0"
                x2={I18nManager.isRTL ? '1' : '0'}
                y2="0"
              >
                <Stop
                  offset="0"
                  stopColor={colors.surface}
                  stopOpacity="0.05"
                />
                <Stop
                  offset="0.3"
                  stopColor={colors.surface}
                  stopOpacity="0.12"
                />
                <Stop
                  offset="0.7"
                  stopColor={colors.surface}
                  stopOpacity="0.88"
                />
                <Stop offset="1" stopColor={colors.surface} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </View>
        <View
          style={[
            styles.illustratedContent,
            stackedPhoto && styles.expandedContent,
          ]}
        >
          {content}
        </View>
      </View>
    );
  }
  return home ? (
    <Pressable
      testID="home-provider-card"
      accessible={false}
      onPress={onPress}
      style={[styles.card, styles.homeCard]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.card, directory && styles.directoryCard]}>
      {content}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 14,
      gap: spacing.sm,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceContainer,
    },
    directoryCard: {
      padding: 14,
      borderRadius: 18,
      gap: 8,
      borderColor: colors.divider,
    },
    homeCard: {
      gap: spacing.sm,
      padding: spacing.sm + spacing.xs,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    managementActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    illustratedCard: {
      padding: 0,
      minHeight: 156,
      overflow: 'hidden',
      borderColor: colors.border,
    },
    illustratedContent: {
      marginEnd: 76,
      padding: spacing.sm + spacing.xs,
      gap: spacing.sm,
      minWidth: 0,
    },
    expandedContent: { marginEnd: 0 },
    photoBackdrop: {
      position: 'absolute',
      end: 0,
      top: 0,
      bottom: 0,
      width: '43%',
    },
    quietBackdrop: { opacity: 0.12 },
    photo: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
    header: { flex: 1, minWidth: 0, gap: 6 },
    callEnabled: { backgroundColor: colors.actionBackground, opacity: 1 },
    whatsappEnabled: { backgroundColor: colors.surfaceContainer, opacity: 1 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    details: { flex: 1, minWidth: 0, gap: 0, alignItems: 'stretch' },
    name: {
      ...typography.title,
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    serviceTitle: {
      ...typography.body,
      lineHeight: 24,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    address: {
      ...typography.caption,
      flexShrink: 1,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    demoBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
    },
    demoBadgeText: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    actions: { flexDirection: 'row', gap: spacing.sm },
    actionDisabled: {
      minHeight: 48,
      paddingVertical: 6,
      paddingHorizontal: 8,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 12,
      backgroundColor: colors.surfaceLow,
      opacity: 0.8,
    },
    actionDisabledText: {
      flexShrink: 1,
      textAlign: 'center',
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    pressed: { opacity: 0.8 },
  });
