import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { useMyClaims } from './useServiceClaims';

export function MyServiceClaimsBanner() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { claims } = useMyClaims();
  const activeClaims = claims.filter((claim) => claim.status !== 'approved');

  if (!activeClaims.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          name="account-switch-outline"
          size={20}
          color={colors.primaryDark}
          accessibilityElementsHidden
        />
        <Text accessibilityRole="header" style={styles.heading}>
          طلبات نقل ملكية الخدمات ({activeClaims.length.toLocaleString('ar-EG')}
          )
        </Text>
      </View>
      {activeClaims.map((claim) => (
        <Pressable
          key={claim.id}
          accessibilityRole="button"
          accessibilityLabel={`متابعة طلب نقل ${claim.serviceName}`}
          onPress={() =>
            router.push({
              pathname: '/provider/[id]',
              params: { id: claim.providerId },
            })
          }
          style={styles.card}
        >
          <View style={styles.cardTop}>
            <Text style={styles.serviceName}>{claim.serviceName}</Text>
            <Text
              style={[
                styles.badge,
                claim.status === 'rejected'
                  ? styles.rejectedBadge
                  : styles.pendingBadge,
              ]}
            >
              {claim.status === 'rejected' ? 'تم الرفض' : 'قيد المراجعة'}
            </Text>
          </View>
          <Text style={styles.serviceTitle}>{claim.serviceTitle}</Text>
          {claim.status === 'rejected' && claim.rejectionReason ? (
            <Text style={styles.reason}>السبب: {claim.rejectionReason}</Text>
          ) : null}
          <Text style={styles.link}>عرض تفاصيل الخدمة ←</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    heading: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    card: {
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    serviceName: {
      ...typography.label,
      flex: 1,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    badge: {
      ...typography.caption,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      writingDirection: 'rtl',
    },
    pendingBadge: {
      color: colors.warning,
      backgroundColor: colors.pendingBackground,
    },
    rejectedBadge: {
      color: colors.error,
      backgroundColor: colors.surfaceLow,
    },
    serviceTitle: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    reason: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    link: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
  });
