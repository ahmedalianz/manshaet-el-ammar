import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFeedback } from '../../components/ui/Feedback';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../features/auth/AuthProvider';
import { authErrorMessage } from '../../features/auth/errors';
import { getPhotoApiUrl } from '../../features/photos/api';
import { FormField } from '../../features/provider/FormField';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export default function DeletionScreen() {
  const { user } = useAuth();
  return <DeletionContent key={user?.uid ?? 'guest'} />;
}

function DeletionContent() {
  const s = useProviderStyles();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const { user, initializing, isAdmin, deleteAccount } = useAuth();

  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const providers = user?.providerData ?? [];
  const hasGoogle = providers.some((p) => p.providerId === 'google.com');
  const hasPassword =
    providers.some((p) => p.providerId === 'password') ||
    (!hasGoogle && Boolean(user?.email));
  const deleteAvailable = Boolean(getPhotoApiUrl());

  const runDelete = async (method: 'password' | 'google') => {
    if (pending.current || !user || isAdmin) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await deleteAccount({ method, password });
      if (result.deleted) {
        if (active.current) setPassword('');
        feedback.show(
          'تم حذف حسابك',
          'تم حذف حسابك وجميع بياناتك وخدماتك نهائيًا.',
        );
        router.replace('/(tabs)/more');
      }
    } catch (cause) {
      if (active.current) {
        setError(authErrorMessage(cause));
      }
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
      }
    }
  };

  const confirmDelete = (method: 'password' | 'google') => {
    if (busy || !deleteAvailable || !confirmed) return;
    if (method === 'password' && !password) return;
    feedback.show(
      'تأكيد حذف الحساب نهائيًا',
      'هيتم حذف حسابك وجميع خدماتك وبياناتك فورًا وبشكل نهائي، ومش هتقدر تسترجعها. متأكد إنك عايز تكمّل؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، احذف حسابي نهائيًا',
          style: 'destructive',
          onPress: () => void runDelete(method),
        },
      ],
    );
  };

  return (
    <ProviderPage title="حذف الحساب والبيانات">
      <Text style={s.heading}>حذف الحساب نهائيًا</Text>
      <View style={styles.warningCard}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={24}
          color={colors.error}
          accessibilityElementsHidden
        />
        <Text style={styles.warningText}>
          حذف الحساب نهائي وفوري ومش ممكن التراجع عنه بعد تنفيذه.
        </Text>
      </View>
      <Text style={s.body}>
        عند تأكيد الحذف، هيتم مسح حسابك وملفك الشخصي فورًا، وكل خدماتك المنشورة
        أو المخفية في الأرشيف، وصور المكان المرتبطة بيها، وطلبات الإضافة
        والتعديل، وطلبات نقل الملكية، وبلاغاتك، وطلبات الدعم الخاصة بحسابك.
      </Text>
      <Text style={s.body}>
        النسخ اللي اتحمّلت مسبقًا من الصور أو البيانات العامة على أجهزة
        المستخدمين للتصفح بدون اتصال ممكن تاخد وقت لحد ما تتحدث أو تنتهي
        صلاحيتها على أجهزتهم.
      </Text>

      {initializing ? (
        <LoadingState label="بنحمّل حالة حسابك…" />
      ) : !user ? (
        <View style={s.card}>
          <Text style={s.body}>
            سجّل دخولك الأول بالحساب اللي عايز تحذفه علشان نتأكد من هويتك قبل
            الحذف الفوري.
          </Text>
          <ProviderAction
            title="تسجيل الدخول لحذف الحساب"
            onPress={() =>
              router.push({
                pathname: '/provider/sign-in',
                params: { next: 'deletion' },
              })
            }
          />
        </View>
      ) : isAdmin ? (
        <Text accessibilityRole="alert" style={s.notice}>
          مينفعش تحذف حساب المشرف من التطبيق مباشرة. اسحب صلاحية المشرف الأول
          لحماية إدارة الدليل.
        </Text>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formWrap}
        >
          {!deleteAvailable ? (
            <Text accessibilityRole="alert" style={s.notice}>
              حذف الحساب غير متاح حاليًا. جرّب تاني بعد شوية.
            </Text>
          ) : null}
          <View style={s.card}>
            {user.email ? (
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>الحساب الحالي</Text>
                <Text selectable style={styles.accountEmail}>
                  {user.email}
                </Text>
              </View>
            ) : null}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                فاهم إن حسابي وجميع خدماتي وبياناتي هتتحذف نهائيًا ومش هقدر
                أسترجعها.
              </Text>
              <Switch
                accessibilityLabel="أؤكد رغبتي في حذف حسابي وجميع بياناتي نهائيًا"
                value={confirmed}
                onValueChange={setConfirmed}
                disabled={busy || !deleteAvailable}
              />
            </View>
            {hasPassword ? (
              <>
                <FormField
                  label="كلمة المرور الحالية للتأكيد"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError('');
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  phone
                  editable={!busy && deleteAvailable}
                  onSubmitEditing={() => confirmDelete('password')}
                />
                <ProviderAction
                  title="حذف حسابي نهائيًا"
                  destructive
                  disabled={busy || !deleteAvailable || !confirmed || !password}
                  onPress={() => confirmDelete('password')}
                />
              </>
            ) : null}
            {hasGoogle ? (
              <ProviderAction
                title="تأكيد بحساب Google وحذف الحساب"
                destructive
                secondary={hasPassword}
                disabled={busy || !deleteAvailable || !confirmed}
                onPress={() => confirmDelete('google')}
              />
            ) : null}
            {busy ? (
              <LoadingState compact label="جاري حذف الحساب والبيانات…" />
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      )}
    </ProviderPage>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    warningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.errorContainer,
      borderWidth: 1,
      borderColor: colors.error,
    },
    warningText: {
      ...typography.label,
      flex: 1,
      color: colors.error,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    formWrap: {
      gap: spacing.md,
    },
    accountRow: {
      gap: spacing.xs,
      paddingBottom: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    accountLabel: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    accountEmail: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    switchLabel: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
      backgroundColor: colors.errorContainer,
      borderRadius: 14,
      padding: spacing.md,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
  });
