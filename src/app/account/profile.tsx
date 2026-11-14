import { useFeedback } from '../../components/ui/Feedback';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { FormField } from '../../features/provider/FormField';
import {
  ProviderAction,
  ProviderPage,
} from '../../features/provider/ProviderPage';
import { useProviderState } from '../../features/provider/ProviderContext';
import { RemoteDataNotice } from '../../features/provider/RemoteDataNotice';
import { firebaseMessage } from '../../features/auth/errors';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function ProfileScreen() {
  const { account } = useProviderState();
  return <ProfileContent key={account?.id ?? 'guest'} />;
}
function ProfileContent() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const {
    account,
    initializing,
    privateLoading,
    privateError,
    configured,
    updateAccountName,
  } = useProviderState();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const save = async () => {
    if (submitting.current || !account || initializing) return;
    const nextName = name.trim();
    if (!nextName || nextName.length > 100) {
      setError('اكتب اسمك، بحد أقصى ١٠٠ حرف.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      await updateAccountName(nextName);
      if (!active.current) return;
      setEditing(false);
      setError('');
      feedback.show('تم الحفظ', 'اسم حسابك اتحدّث.');
    } catch (error) {
      if (active.current) setError(firebaseMessage(error));
    } finally {
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  };
  return (
    <ProviderPage
      title="الملف الشخصي"
      backgroundColor={colors.accountBackground}
    >
      {initializing || privateLoading || privateError || !configured ? (
        <RemoteDataNotice privateData />
      ) : account ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <View style={styles.notice}>
            <MaterialCommunityIcons
              name="shield-outline"
              size={25}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
            <Text style={styles.noticeText}>
              بيانات حسابك خاصة بيك. لو غيّرت اسمك هنا، أسماء خدماتك المنشورة
              هتفضل زي ما هي.
            </Text>
          </View>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>
                {account.name
                  .trim()
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>
            <Text style={styles.title}>{account.name}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>
                {account.role === 'admin'
                  ? 'مشرف الدليل'
                  : 'مزود خدمة / حساب شخصي'}
              </Text>
            </View>
          </View>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              {editing ? (
                <View style={styles.form}>
                  <FormField
                    label="الاسم"
                    value={name}
                    onChangeText={(value) => {
                      setName(value);
                      setError('');
                    }}
                    error={error}
                    autoFocus
                    maxLength={100}
                    editable={!saving}
                    returnKeyType="done"
                    onSubmitEditing={save}
                  />
                  <View
                    pointerEvents={saving ? 'none' : 'auto'}
                    accessibilityState={{ disabled: saving }}
                    style={{ opacity: saving ? 0.5 : 1 }}
                  >
                    <ProviderAction
                      title={saving ? 'بنحفظ التعديلات...' : 'حفظ التعديلات'}
                      onPress={() => void save()}
                    />
                  </View>
                  <ProviderAction
                    title="إلغاء"
                    secondary
                    onPress={() => {
                      if (saving) return;
                      setEditing(false);
                      setError('');
                    }}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.rowHeader}>
                    <Text style={styles.caption}>اسمك في الحساب</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="اسمك في الحساب — تعديل الاسم"
                      onPress={() => {
                        setName(account.name);
                        setEditing(true);
                      }}
                      style={styles.textAction}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={20}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.actionText}>تعديل الاسم</Text>
                    </Pressable>
                  </View>
                  <View style={styles.valueRow}>
                    <MaterialCommunityIcons
                      name="card-account-details-outline"
                      size={24}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.accountName}>{account.name}</Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <View style={styles.rowHeader}>
                <Text style={styles.caption}>
                  البريد الإلكتروني (لتسجيل الدخول)
                </Text>
                <View style={styles.readonlyPill}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={14}
                    color={colors.muted}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.caption}>للقراءة فقط</Text>
                </View>
              </View>
              <View style={styles.valueRow}>
                <MaterialCommunityIcons
                  name="at"
                  size={24}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
                <Text style={styles.email}>{account.email}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.caption}>كلمة المرور</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إعادة تعيين كلمة المرور"
                style={styles.textAction}
                onPress={() => router.push('/provider/forgot-password')}
              >
                <MaterialCommunityIcons
                  name="key-outline"
                  size={22}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
                <Text style={styles.actionText}>إعادة تعيين كلمة المرور</Text>
              </Pressable>
              <Text style={styles.caption}>
                هنبعتلك رابط على بريدك عشان تختار كلمة مرور جديدة
              </Text>
            </View>
          </View>
          <View style={styles.deletionSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="حذف الحساب"
              style={styles.deleteButton}
              onPress={() => router.push('/info/deletion')}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={22}
                color={colors.error}
                accessibilityElementsHidden
              />
              <Text style={styles.deleteText}>حذف الحساب</Text>
            </Pressable>
            <Text style={[styles.caption, styles.centered]}>
              اقرأ تفاصيل حذف حسابك وبياناتك قبل ما تكمّل.
            </Text>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.content}>
          <Text style={styles.body}>سجّل دخولك علشان تعرض ملفك الشخصي.</Text>
          <ProviderAction
            title="تسجيل الدخول"
            onPress={() =>
              router.replace({
                pathname: '/provider/sign-in',
                params: { next: 'more' },
              })
            }
          />
        </View>
      )}
    </ProviderPage>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { gap: spacing.lg },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
    },
    noticeText: {
      ...typography.body,
      flex: 1,
      color: colors.textSecondary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    identity: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    avatar: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    initial: { ...typography.hero, color: colors.primaryDark },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    rolePill: {
      borderRadius: 24,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surfaceContainer,
    },
    roleText: {
      ...typography.caption,
      color: colors.primaryDark,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    detailsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    detailRow: { padding: spacing.md, gap: spacing.sm },
    rowHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: spacing.sm,
      rowGap: spacing.xs,
    },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    accountName: {
      ...typography.title,
      flex: 1,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    email: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    readonlyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 18,
      backgroundColor: colors.surfaceLow,
    },
    caption: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
      flexShrink: 1,
    },
    textAction: {
      minHeight: 48,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
    },
    actionText: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
      flexShrink: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    form: { gap: spacing.sm },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    deletionSection: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    deleteButton: {
      minHeight: 48,
      padding: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    deleteText: {
      ...typography.button,
      color: colors.error,
      writingDirection: 'rtl',
    },
    centered: { textAlign: 'center' },
  });
