import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '../../theme/typography';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useProviderState } from '../../features/provider/ProviderContext';

export const unstable_settings = { initialRouteName: 'index' };

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { userId } = useProviderState();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom, 12);
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: typography.caption,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height:
            68 +
            bottomPadding +
            Math.max(0, fontScale - 1) * typography.caption.lineHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.divider,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="home-outline"
              color={typeof color === 'string' ? color : colors.primary}
              size={size}
            />
          ),
          tabBarAccessibilityLabel: 'الرئيسية',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'استكشف',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="compass-outline"
              color={typeof color === 'string' ? color : colors.primary}
              size={size}
            />
          ),
          tabBarAccessibilityLabel: 'استكشف',
        }}
      />
      <Tabs.Screen
        name="my-services"
        options={{
          title: 'خدماتي',
          href: userId ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="briefcase-outline"
              color={typeof color === 'string' ? color : colors.primary}
              size={size}
            />
          ),
          tabBarAccessibilityLabel: 'خدماتي',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'المزيد',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="dots-horizontal"
              color={typeof color === 'string' ? color : colors.primary}
              size={size}
            />
          ),
          tabBarAccessibilityLabel: 'المزيد',
        }}
      />
    </Tabs>
  );
}
