import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PhotoViewportProvider,
  usePhotoScroll,
} from '../features/photos/PhotoViewport';
import { MotionPressable as Pressable } from '../components/ui/Motion';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackHeader } from '../features/discovery/components/DiscoveryUi';
import { ProviderCard } from '../features/discovery/components/ProviderCard';
import { useLocalDirectory } from '../features/local/LocalDirectory';
import { fetchProvider } from '../features/provider/firebaseRepository';
import { db } from '../lib/firebase/firestore';
import { ProviderAction } from '../features/provider/ProviderPage';
import { useFeedback } from '../components/ui/Feedback';
import { useAppTheme, useThemedStyles } from '../theme/ThemeProvider';
export default function FavoritesScreen() {
  return (
    <PhotoViewportProvider>
      <FavoritesScreenContent />
    </PhotoViewportProvider>
  );
}
function FavoritesScreenContent() {
  const photoScroll = usePhotoScroll();
  const local = useLocalDirectory();
  const feedback = useFeedback();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const ids = local.favoriteIds.join('\n');
  useEffect(() => {
    let active = true;
    if (!db || !local.hydrated) return;
    void Promise.all(local.favoriteIds.map((id) => fetchProvider(db!, id)))
      .then((items) => {
        if (active)
          setRefreshError(items.some((item) => Boolean(item?.cachedAt)));
      })
      .catch(() => {
        if (active) setRefreshError(true);
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
    // Refresh individually: absence from a paginated directory never removes a favorite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, local.hydrated, refreshVersion]);
  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <BackHeader title="المفضلة" />
      <ScrollView
        onScroll={photoScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 16 + insets.bottom,
          gap: 16,
        }}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <MaterialCommunityIcons
              name="bookmark-multiple-outline"
              size={28}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
          </View>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.heading}>
              خدمات تحب ترجع لها
            </Text>
            <Text style={styles.description}>
              كل خدماتك المفضلة في مكان واحد، وقت ما تحتاجها.
            </Text>
          </View>
        </View>
        {local.storageError ? (
          <Text
            accessibilityRole="alert"
            style={{ ...typography.body, color: colors.error }}
          >
            {local.storageError}
          </Text>
        ) : null}
        {refreshError ? (
          <Text
            accessibilityRole="alert"
            style={{ ...typography.body, color: colors.textSecondary }}
          >
            مش قادرين نحدّث المفضلة. البيانات المحفوظة ممكن تكون اتغيّرت.
          </Text>
        ) : null}
        {local.favoriteIds.length ? (
          <View style={styles.toolbar}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              الخدمات المفضلة{' '}
              <Text style={styles.count}>
                ({local.favoriteIds.length.toLocaleString('ar-EG')})
              </Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                refreshing ? 'بنحدّث المفضلة...' : 'تحديث المفضلة'
              }
              accessibilityState={{ busy: refreshing }}
              disabled={!db || refreshing || !local.hydrated}
              style={styles.refresh}
              onPress={() => {
                setRefreshing(true);
                setRefreshVersion((value) => value + 1);
              }}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={21}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="bookmark-outline"
                size={44}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
            </View>
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              لسه مفيش خدمات في المفضلة
            </Text>
            <Text style={styles.emptyDescription}>
              اضغط على علامة القلب في أي خدمة تهمك، وهتلاقيها هنا على طول وقت ما
              تحتاج تتواصل مع صاحبها.
            </Text>
            <ProviderAction
              title="استكشف الخدمات"
              onPress={() => router.push('/(tabs)/explore')}
            />
          </View>
        )}
        {local.favoriteIds.map((id) => {
          const provider = local.getCachedProvider(id);
          return provider ? (
            <ProviderCard
              key={id}
              presentation="directory"
              provider={provider}
              category={local.categories.find(
                (category) => category.id === provider.categoryId,
              )}
              onPress={() =>
                router.push({ pathname: '/provider/[id]', params: { id } })
              }
            />
          ) : (
            <View key={id} style={styles.unavailable}>
              <Text style={{ ...typography.body, color: colors.textPrimary }}>
                {local.unavailableIds.includes(id)
                  ? 'الخدمة دي مش متاحة دلوقتي.'
                  : 'البيانات المحفوظة مش موجودة أو خلصت مدتها. اتأكد من الإنترنت وحدّث المفضلة.'}
              </Text>
              <ProviderAction
                title="شيلها من المفضلة"
                onPress={() => local.toggleFavorite(id)}
              />
            </View>
          );
        })}
        {local.favoriteIds.length ? (
          <ProviderAction
            secondary
            title="مسح المفضلة"
            onPress={() =>
              feedback.show(
                'تمسح المفضلة؟',
                'كل الخدمات اللي في المفضلة هتتمسح من الجهاز ده.',
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'مسح',
                    style: 'destructive',
                    onPress: local.clearFavorites,
                  },
                ],
              )
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    intro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 22,
      backgroundColor: c.surfaceContainer,
    },
    introIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0, gap: 4 },
    heading: {
      ...typography.title,
      color: c.textPrimary,
      writingDirection: 'rtl',
    },
    description: {
      ...typography.caption,
      color: c.textSecondary,
      writingDirection: 'rtl',
    },
    caption: {
      ...typography.caption,
      color: c.muted,
      flex: 1,
      writingDirection: 'rtl',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      flex: 1,
      writingDirection: 'rtl',
    },
    count: { color: c.primaryDark },
    refresh: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      padding: 24,
      gap: 16,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyIcon: {
      width: 88,
      height: 88,
      borderRadius: 30,
      backgroundColor: c.surfaceContainer,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 12,
    },
    emptyTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    emptyDescription: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    unavailable: {
      padding: 16,
      gap: 10,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
