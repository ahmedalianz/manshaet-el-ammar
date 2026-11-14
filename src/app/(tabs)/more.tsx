import { useCompactHeader } from '../../components/brand/useCompactHeader';
import { CommunityHeader } from '../../components/brand/CommunityHeader';
import { AppearanceSetting } from '../../theme/AppearanceSetting';
import { useFeedback } from '../../components/ui/Feedback';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountMenuRow } from '../../features/account/AccountMenuRow';
import { ProviderAction } from '../../features/provider/ProviderPage';
import { useProviderState } from '../../features/provider/ProviderContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function MoreScreen() {
  const { compact, ...headerScroll } = useCompactHeader();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const {
    userId,
    role,
    account,
    signOut,
    pendingRequests,
    moderationEnabled,
    listings,
  } = useProviderState();
  const signIn = () =>
    router.push({ pathname: '/provider/sign-in', params: { next: 'more' } });
  const profile = () => router.push('/account/profile');
  const confirmSignOut = () =>
    feedback.show('تسجيل الخروج', 'ترجع للتصفح كزائر؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            feedback.show(
              'مش قادرين نسجّل خروجك',
              'تأكد من الاتصال وحاول تاني.',
            );
          }
        },
      },
    ]);
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <CommunityHeader
        compact={compact}
        signedIn={Boolean(userId)}
        pageTitle="المزيد"
        onAccount={userId ? profile : signIn}
      />
      <ScrollView {...headerScroll} contentContainerStyle={styles.content}>
        {!userId ? (
          <View style={[styles.rolePill, { alignSelf: 'flex-start' }]}>
            <Text style={styles.roleText}>حساب زائر</Text>
          </View>
        ) : null}
        {userId ? (
          <View style={styles.accountCard}>
            <View style={styles.accountIdentity}>
              <View
                style={[styles.avatar, role === 'admin' && styles.adminAvatar]}
              >
                <Text
                  style={[
                    styles.initial,
                    role === 'admin' && { color: colors.onPrimary },
                  ]}
                >
                  {account?.name
                    .trim()
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
              <View style={styles.copy}>
                <View style={styles.nameLine}>
                  <Text style={styles.title}>{account?.name ?? 'حسابك'}</Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.roleText}>
                      {role === 'admin' ? 'مشرف الدليل' : 'مزود خدمة'}
                    </Text>
                  </View>
                </View>
                {account?.email ? (
                  <Text style={styles.email}>{account.email}</Text>
                ) : null}
              </View>
            </View>
            <AccountMenuRow
              grouped
              title="الملف الشخصي والبيانات"
              subtitle="عرض وتعديل الملف الشخصي"
              icon="account-outline"
              onPress={profile}
            />
          </View>
        ) : (
          <View style={styles.guestCard}>
            <View style={styles.guestAvatar}>
              <MaterialCommunityIcons
                name="account-outline"
                size={32}
                color={colors.primaryDark}
                accessibilityElementsHidden
              />
            </View>
            <Text style={[styles.title, styles.centered]}>
              أهلًا بيك في منشأة العمار
            </Text>
            <Text style={[styles.subtitle, styles.centered]}>
              تقدر تتصفح الخدمات من غير حساب. سجّل دخولك لو عايز تضيف خدمتك أو
              تديرها.
            </Text>
            <ProviderAction
              title="تسجيل الدخول / إنشاء حساب"
              onPress={signIn}
            />
          </View>
        )}
        {role === 'provider' && userId ? (
          <View style={styles.menuGroup}>
            <AccountMenuRow
              grouped
              title="خدماتي"
              subtitle="إدارة خدماتك المنشورة ومتابعة المراجعات"
              icon="handshake-outline"
              badge={listings?.length ?? 0}
              badgeLabel={`عدد الخدمات: ${(listings?.length ?? 0).toLocaleString('ar-EG')}`}
              onPress={() => router.push('/(tabs)/my-services')}
            />
          </View>
        ) : null}
        {role === 'admin' && moderationEnabled !== false ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.section}>الإدارة والمراجعة</Text>
            <View style={styles.menuGroup}>
              <AccountMenuRow
                grouped
                title="إدارة الخدمات"
                subtitle="مراجعة الطلبات والخدمات المنشورة والبلاغات"
                icon="clipboard-check-outline"
                badge={pendingRequests.length}
                onPress={() => router.push('/admin')}
              />
            </View>
          </View>
        ) : null}
        <View style={styles.sectionBlock}>
          {!userId ? (
            <Text style={styles.section}>عن المبادرة والدعم</Text>
          ) : role === 'admin' ? (
            <Text style={styles.section}>حول المنصة والتواصل</Text>
          ) : null}
          <View style={styles.menuGroup}>
            <AccountMenuRow
              grouped
              title="عن التطبيق والدليل"
              subtitle={
                role === 'admin'
                  ? undefined
                  : 'فكرة دليل أهل البلد ومبادرة منشأة العمار الرقمية'
              }
              icon="book-open-page-variant-outline"
              onPress={() => router.push('/info/about')}
            />
            <View style={styles.divider} />
            <AccountMenuRow
              grouped
              title="تواصل معنا"
              subtitle={
                role === 'admin' ? undefined : 'للملاحظات والاستفسارات المباشرة'
              }
              icon="message-text-outline"
              onPress={() => router.push('/info/contact')}
            />
            <View style={styles.divider} />
            <AccountMenuRow
              grouped
              title="سياسة الخصوصية والشروط"
              subtitle={
                role === 'admin' ? undefined : 'حماية البيانات وضوابط الاستخدام'
              }
              icon="shield-outline"
              onPress={() => router.push('/info/privacy')}
            />
            <View style={styles.divider} />
            <AccountMenuRow
              grouped
              title="حذف الحساب والبيانات"
              icon="delete-outline"
              destructive
              onPress={() => router.push('/info/deletion')}
            />
          </View>
        </View>
        <View style={styles.menuGroup}>
          <AccountMenuRow
            grouped
            title="المحفوظات"
            icon="bookmark-outline"
            onPress={() => router.push('/favorites')}
          />
          {userId ? (
            <AccountMenuRow
              grouped
              title="طلباتي للدعم"
              icon="message-text-outline"
              onPress={() => router.push('/support')}
            />
          ) : null}
          {role === 'admin' ? (
            <AccountMenuRow
              grouped
              title="إدارة طلبات الدعم"
              icon="clipboard-check-outline"
              onPress={() => router.push('/admin/support')}
            />
          ) : null}
        </View>
        {userId ? (
          <View style={styles.menuGroup}>
            <AccountMenuRow
              grouped
              title="مسودات الخدمات"
              icon="file-document-edit-outline"
              onPress={() => router.push('/provider/drafts')}
            />
          </View>
        ) : null}
        <AppearanceSetting />
        {userId ? (
          <View style={[styles.menuGroup, styles.logoutCard]}>
            <AccountMenuRow
              grouped
              title="تسجيل الخروج"
              subtitle="الخروج من حسابك على الجهاز ده"
              icon="logout"
              destructive
              onPress={confirmSignOut}
            />
          </View>
        ) : null}
        <View style={styles.footer}>
          <MaterialCommunityIcons
            name="sprout-outline"
            size={25}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
          <Text style={styles.footerTitle}>منشأة العمار — بلدنا أقرب</Text>
          <Text style={styles.footerText}>
            الإصدار {Constants.expoConfig?.version ?? 'غير متاح'} — دليل منشأة
            العمار
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.accountBackground },
    copy: { flex: 1, minWidth: 0, gap: spacing.xs },
    heading: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    accountCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
    },
    accountIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adminAvatar: { backgroundColor: colors.actionBackground },
    initial: { ...typography.screenTitle, color: colors.primaryDark },
    nameLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      flexShrink: 1,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    rolePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 20,
      backgroundColor: colors.surfaceContainer,
      flexShrink: 1,
      alignSelf: 'flex-start',
    },
    roleText: {
      ...typography.caption,
      color: colors.primaryDark,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    email: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    guestCard: {
      padding: spacing.lg,
      gap: spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    guestAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    centered: { textAlign: 'center' },
    sectionBlock: { gap: spacing.sm },
    section: {
      ...typography.label,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
      marginTop: spacing.xs,
    },
    menuGroup: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    logoutCard: { borderColor: colors.error },
    footer: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    footerTitle: {
      ...typography.label,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    footerText: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });
