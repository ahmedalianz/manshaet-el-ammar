import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

type StatusVariant = 'published' | 'pending' | 'needs-edit' | 'unpublished';

export function ServiceStatusArtwork({ status }: { status: StatusVariant }) {
  const { colors, resolved } = useAppTheme();
  const dark = resolved === 'dark';

  const config = {
    published: {
      icon: 'storefront-outline' as const,
      color: colors.success,
      borderColor: dark ? 'rgba(131,221,186,0.25)' : 'rgba(0,81,68,0.14)',
      badgeIcon: 'check' as const,
      badgeSize: 11,
      badgeBg: colors.success,
      badgeRing: colors.publishedBackground,
      badgeColor: colors.onPrimary,
    },
    pending: {
      icon: 'clipboard-text-outline' as const,
      color: colors.warning,
      borderColor: dark ? 'rgba(232,200,137,0.25)' : 'rgba(109,75,22,0.16)',
      badgeIcon: 'timer-sand' as const,
      badgeSize: 10,
      badgeBg: colors.warning,
      badgeRing: colors.pendingBackground,
      badgeColor: colors.onPrimary,
    },
    'needs-edit': {
      icon: 'clipboard-edit-outline' as const,
      color: colors.error,
      borderColor: dark ? 'rgba(255,180,171,0.28)' : 'rgba(186,26,26,0.16)',
      badgeIcon: 'exclamation' as const,
      badgeSize: 12,
      badgeBg: colors.error,
      badgeRing: colors.errorContainer,
      badgeColor: colors.onPrimary,
    },
    unpublished: {
      icon: 'storefront-outline' as const,
      color: colors.muted,
      borderColor: colors.border,
      badgeIcon: 'eye-off-outline' as const,
      badgeSize: 10,
      badgeBg: colors.muted,
      badgeRing: colors.surfaceContainer,
      badgeColor: colors.surface,
    },
  }[status];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: config.borderColor,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={config.icon}
        size={22}
        color={config.color}
      />
      <View
        style={[
          styles.badge,
          {
            backgroundColor: config.badgeBg,
            borderColor: config.badgeRing,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={config.badgeIcon}
          size={config.badgeSize}
          color={config.badgeColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -3,
    end: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
