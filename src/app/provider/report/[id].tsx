import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { returnToRoute } from '../../../features/navigation/returnToRoute';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedSuccessCheck } from '../../../components/ui/AnimatedSuccessCheck';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../../../features/auth/AuthProvider';
import { firebaseMessage } from '../../../features/auth/errors';
import { usePublicProvider } from '../../../features/discovery/firebaseQueries';
import { FormField } from '../../../features/provider/FormField';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import { submitServiceReport } from '../../../features/reports/firebaseReports';
import { db } from '../../../lib/firebase/firestore';

export default function ReportServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  return (
    <ReportForm
      key={`${id}:${auth.user?.uid ?? 'guest'}`}
      id={id}
      auth={auth}
    />
  );
}
function ReportForm({
  id,
  auth,
}: {
  id: string;
  auth: ReturnType<typeof useAuth>;
}) {
  const styles = useProviderStyles();
  const validId = typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
  const provider = usePublicProvider(validId ? id : undefined);
  const { user, initializing, configured } = auth;
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState('');
  const lock = useRef(false);
  const backToService = () =>
    returnToRoute({ pathname: '/provider/[id]', params: { id } });
  const send = async () => {
    if (lock.current || reportId) return;
    if (!reason.trim()) {
      setError('اكتب سبب البلاغ عشان المشرف يقدر يراجعه.');
      return;
    }
    if (reason.trim().length > 1000) {
      setError('سبب البلاغ لازم يكون ١٠٠٠ حرف أو أقل.');
      return;
    }
    if (!user || !db || !validId || initializing) {
      setError('سجّل دخولك قبل إرسال البلاغ.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const savedId = await submitServiceReport(db, user.uid, id, reason);
      setReportId(savedId);
      void client.invalidateQueries({
        queryKey: ['private', user.uid, 'moderation'],
      });
    } catch (cause) {
      setError(firebaseMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  let content;
  if (!validId || !configured)
    content = (
      <Text accessibilityRole="alert" style={styles.notice}>
        الخدمة أو الاتصال بالدليل مش متاح دلوقتي.
      </Text>
    );
  else if (initializing || provider.isPending)
    content = <LoadingState label="جارٍ تحميل بيانات الخدمة…" />;
  else if (reportId)
    content = (
      <View style={styles.card}>
        <View style={{ alignItems: 'center' }}>
          <AnimatedSuccessCheck />
        </View>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.heading}
        >
          تم إرسال البلاغ
        </Text>
        <Text style={styles.body}>
          بلاغك وصل للمشرف وهيراجع بيانات الخدمة. إرسال البلاغ مش بيخفي الخدمة
          تلقائيًا.
        </Text>
        <Text selectable style={styles.body}>
          رقم البلاغ: {reportId}
        </Text>
        <Text selectable style={styles.body}>
          معرّف الخدمة: {id}
        </Text>
        <ProviderAction title="العودة للخدمة" onPress={backToService} />
      </View>
    );
  else if (provider.isError && !provider.data)
    content = (
      <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.notice}>
          {firebaseMessage(provider.error)}
        </Text>
        <ProviderAction
          title="إعادة المحاولة"
          onPress={() => {
            void provider.refetch();
          }}
        />
      </View>
    );
  else if (!provider.data)
    content = (
      <View style={styles.card}>
        <Text style={styles.heading}>الخدمة مبقتش متاحة</Text>
        <Text style={styles.body}>
          الخدمة اتشالت أو أُلغي نشرها. ارجع واستكشف الخدمات المتاحة.
        </Text>
        <ProviderAction
          title="استكشف الخدمات"
          onPress={() => router.replace('/(tabs)/explore')}
        />
      </View>
    );
  else
    content = (
      <>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            {provider.data.name}
          </Text>
          <Text style={styles.body}>{provider.data.serviceTitle}</Text>
          <Text selectable style={styles.body}>
            معرّف الخدمة: {id}
          </Text>
        </View>
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              سجّل دخولك عشان تبعت بلاغ للمشرف. تقدر تتصفح الخدمات من غير حساب.
            </Text>
            <ProviderAction
              title="تسجيل الدخول لإرسال بلاغ"
              onPress={() =>
                router.push({
                  pathname: '/provider/sign-in',
                  params: { next: 'report', providerId: id },
                })
              }
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              وضّح المشكلة، زي رقم مش صحيح أو عنوان مختلف. البلاغ ظاهر للمشرف
              فقط، ومش بيظهر لصاحب الخدمة أو للناس.
            </Text>
            <FormField
              label="سبب البلاغ"
              value={reason}
              multiline
              maxLength={1000}
              editable={!busy}
              placeholder="مثال: رقم الموبايل المكتوب مش خاص بمقدم الخدمة"
              error={error}
              onChangeText={(value) => {
                setReason(value);
                setError('');
              }}
            />
            <Text style={styles.body}>
              {reason.length.toLocaleString('ar-EG')} / ١٠٠٠ حرف
            </Text>
            {busy ? <LoadingState compact label="جارٍ إرسال البلاغ…" /> : null}
            <ProviderAction
              title={busy ? 'جارٍ الإرسال…' : 'إرسال البلاغ للمشرف'}
              disabled={busy}
              onPress={() => void send()}
            />
            <ProviderAction
              secondary
              title="إلغاء"
              disabled={busy}
              onPress={backToService}
            />
          </View>
        )}
      </>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProviderPage title="الإبلاغ عن خدمة">{content}</ProviderPage>
    </KeyboardAvoidingView>
  );
}
