import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { authErrorMessage } from '../../features/auth/errors';
import { FormField } from '../../features/provider/FormField';
import {
  ProviderPage,
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
export default function ForgotPasswordScreen() {
  const s = useProviderStyles();
  const { resetPassword, configured, error: configurationError } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submit = async () => {
    if (pending.current || !configured) return;
    if (!email.trim()) {
      setMessage('اكتب البريد الإلكتروني اللي سجلت بيه حسابك.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await resetPassword(email);
      setMessage(
        'لو البريد ده مرتبط بحساب، هتوصلك رسالة تختار منها كلمة مرور جديدة. بص كمان في الرسائل غير المرغوب فيها (Spam).',
      );
    } catch (cause) {
      setMessage(authErrorMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <ProviderPage title="استعادة كلمة المرور">
      <View style={s.card}>
        <Text style={s.heading}>نسيت كلمة المرور؟</Text>
        <Text style={s.body}>
          اكتب بريدك الإلكتروني، وهنبعتلك رابط تختار منه كلمة مرور جديدة.
        </Text>
        {!configured ? (
          <Text style={s.notice}>{configurationError}</Text>
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
        {message ? (
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {message}
          </Text>
        ) : null}
        <View
          pointerEvents={!configured || busy ? 'none' : 'auto'}
          accessibilityState={{ disabled: !configured || busy }}
          style={{ opacity: !configured || busy ? 0.5 : 1 }}
        >
          <ProviderAction
            title={busy ? 'بنبعت الطلب...' : 'إرسال رابط إعادة التعيين'}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </ProviderPage>
  );
}
