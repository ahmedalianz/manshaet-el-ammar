import { LoadingState } from '../../components/ui/LoadingState';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { authErrorMessage } from '../../features/auth/errors';
import { FormField } from '../../features/provider/FormField';
import {
  ProviderPage,
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { signInDestination } from '../../features/provider/signInDestination';

export default function ProviderSignInScreen() {
  const s = useProviderStyles();
  const {
    next,
    providerId,
    mode: initialMode,
  } = useLocalSearchParams<{
    next?: string;
    providerId?: string;
    mode?: string;
  }>();
  const {
    user,
    initializing,
    configured,
    error: configurationError,
    isAdmin,
    signIn,
    register,
    signInGoogle,
  } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'register'>(
    initialMode === 'register' ? 'register' : 'sign-in',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [canNavigate, setCanNavigate] = useState(true);
  const submitting = useRef(false);
  useEffect(() => {
    if (user && !initializing && canNavigate && !busy)
      router.replace(signInDestination(next, isAdmin, providerId));
  }, [user, initializing, canNavigate, busy, next, isAdmin, providerId]);
  const submit = async () => {
    if (submitting.current || !configured || initializing) return;
    setError('');
    if (!email.trim() || !password || (mode === 'register' && !name.trim())) {
      setError('كمّل البيانات المطلوبة.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError(
        'اختار كلمة مرور من ٦ أحرف على الأقل عشان تحافظ على أمان حسابك.',
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setCanNavigate(false);
    try {
      if (mode === 'register') await register(name, email, password);
      else await signIn(email, password);
      setPassword('');
      setCanNavigate(true);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const submitGoogle = async () => {
    if (submitting.current || !configured || initializing) return;
    submitting.current = true;
    setBusy(true);
    setCanNavigate(false);
    setError('');
    try {
      if (await signInGoogle()) setCanNavigate(true);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const disabled = busy || initializing || !configured;
  if (initializing)
    return (
      <ProviderPage title="تسجيل الدخول">
        <LoadingState label="بنتأكد من حسابك…" />
      </ProviderPage>
    );
  return (
    <ProviderPage title={mode === 'register' ? 'إنشاء حساب' : 'تسجيل الدخول'}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.card}>
          <Text style={s.heading}>
            {mode === 'register'
              ? 'خلّي أهل البلد يوصلوا لخدمتك'
              : 'أهلًا بيك من جديد'}
          </Text>
          <Text style={s.body}>
            تقدر تتصفح خدمات البلد من غير حساب. سجّل دخولك لو عايز تضيف خدمتك
            وتتابع طلباتك.
          </Text>
          {!configured ? (
            <Text accessibilityRole="alert" style={s.notice}>
              {configurationError}
            </Text>
          ) : null}
          {mode === 'register' ? (
            <FormField
              label="الاسم"
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoComplete="name"
              editable={!busy}
            />
          ) : null}
          <FormField
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            phone
            editable={!busy}
          />
          <FormField
            label="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            phone
            editable={!busy}
            onSubmitEditing={submit}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={s.notice}
            >
              {error}
            </Text>
          ) : null}
          {busy || initializing ? (
            <LoadingState compact label="بنتأكد من حسابك…" />
          ) : null}
          <View
            pointerEvents={disabled ? 'none' : 'auto'}
            accessibilityState={{ disabled }}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <ProviderAction
              title={
                busy
                  ? 'بنكمل...'
                  : mode === 'register'
                    ? 'إنشاء حساب'
                    : 'تسجيل الدخول'
              }
              onPress={() => void submit()}
            />
          </View>
          <View
            pointerEvents={disabled ? 'none' : 'auto'}
            accessibilityState={{ disabled }}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <ProviderAction
              secondary
              title="المتابعة باستخدام Google"
              onPress={() => void submitGoogle()}
            />
          </View>
          {!busy ? (
            <ProviderAction
              secondary
              title={mode === 'register' ? 'عندي حساب' : 'إنشاء حساب جديد'}
              onPress={() => {
                setMode(mode === 'register' ? 'sign-in' : 'register');
                setError('');
                setPassword('');
              }}
            />
          ) : null}
          {!busy && mode === 'sign-in' ? (
            <ProviderAction
              secondary
              title="نسيت كلمة المرور؟"
              onPress={() => router.push('/provider/forgot-password')}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <ProviderAction
        secondary
        title="استكشف خدمات البلد"
        onPress={() => router.replace('/(tabs)/explore')}
      />
    </ProviderPage>
  );
}
