import { CommunityArtwork } from '../../components/brand/CommunityArtwork';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, useAppTheme } from '../../theme/ThemeProvider';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useProviderState } from '../../features/provider/ProviderContext';
import {
  ProviderPage,
  ProviderAction,
} from '../../features/provider/ProviderPage';

export default function JoinProviderScreen() {
  const s = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { userId } = useProviderState();
  const begin = () =>
    userId
      ? router.push('/provider/add')
      : router.push({ pathname: '/provider/sign-in', params: { next: 'add' } });
  return (
    <ProviderPage title="ضيف خدمتك">
      <View style={s.hero}>
        <View style={s.art} pointerEvents="none" accessibilityElementsHidden>
          <CommunityArtwork />
        </View>
        <View style={s.heroIcon}>
          <MaterialCommunityIcons
            name="handshake-outline"
            size={46}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
        </View>
        <Text accessibilityRole="header" style={s.headline}>
          خلّي أهل بلدك يعرفوا شغلك
        </Text>
        <Text style={s.centered}>
          ضيف خدمتك مجانًا علشان الناس في منشأة العمار تقدر تلاقيك وتتواصل معاك
          مباشرة.
        </Text>
        <View style={s.badge}>
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={20}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
          <Text style={s.badgeText}>دليل خدمات منشأة العمار</Text>
        </View>
      </View>
      {(
        [
          [
            'message-text-outline',
            'تواصل مباشر وسريع',
            'أهل البلد يتواصلوا معاك مباشرة على تليفونك أو واتساب، من غير وسيط أو عمولة.',
          ],
          [
            'book-open-variant',
            'ظهور في دليل القرية',
            'ظهور منظم في دليل القرية وسهولة البحث عنك.',
          ],
        ] as const
      ).map(([icon, title, detail]) => (
        <View key={title} style={s.card}>
          <View style={s.icon}>
            <MaterialCommunityIcons
              name={icon}
              size={28}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
          </View>
          <View style={s.copy}>
            <Text style={s.title}>{title}</Text>
            <Text style={s.body}>{detail}</Text>
          </View>
        </View>
      ))}
      <View style={s.notice}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={28}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
        <View style={s.copy}>
          <Text style={s.title}>مبادرة أهلية مجانية</Text>
          <Text style={s.body}>
            الخدمة هتظهر في الدليل بعد مراجعة المشرف والموافقة على نشرها.
          </Text>
        </View>
      </View>
      <ProviderAction title="ابدأ إضافة خدمتك" onPress={begin} />
    </ProviderPage>
  );
}
const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    art: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: 100,
      opacity: 0.5,
    },
    hero: {
      padding: 16,
      overflow: 'hidden',
      gap: 12,
      alignItems: 'center',
      backgroundColor: c.surfaceContainer,
      borderRadius: 24,
    },
    heroIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 12,
      borderColor: c.surfaceLow,
    },
    headline: {
      ...typography.screenTitle,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    centered: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    badge: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: c.secondary,
    },
    badgeText: {
      flexShrink: 1,
      textAlign: 'center',
      ...typography.caption,
      color: c.primaryDark,
      writingDirection: 'rtl',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 20,
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0, gap: 6 },
    title: {
      ...typography.title,
      color: c.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    body: {
      ...typography.body,
      color: c.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    notice: {
      padding: 20,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: c.secondary,
    },
  });
