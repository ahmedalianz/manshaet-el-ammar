import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from 'expo-router';
import { db } from '../../lib/firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { AdminGuard } from '../admin/AdminUi';
import { useFeedback } from '../../components/ui/Feedback';
import { FormField } from '../provider/FormField';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../provider/ProviderPage';
import {
  allocateSupportId,
  fetchSupportRequest,
  fetchSupportRequests,
  nextStatuses,
  reviewSupportRequest,
  statusLabels,
  submitSupportRequest,
  type SupportRequest,
} from './requests';
function SignedIn({
  children,
  deletion = false,
}: {
  children: ReactNode;
  deletion?: boolean;
}) {
  const { user, initializing } = useAuth();
  const s = useProviderStyles();
  if (initializing)
    return (
      <ProviderPage title="الدعم">
        <Text style={s.body}>بنحمّل حسابك…</Text>
      </ProviderPage>
    );
  if (!user)
    return (
      <ProviderPage title="الدعم">
        <Text style={s.body}>سجّل دخولك لإرسال طلب خاص ومتابعته.</Text>
        <ProviderAction
          title="تسجيل الدخول"
          onPress={() =>
            router.push({
              pathname: '/provider/sign-in',
              params: { next: deletion ? 'deletion' : 'support' },
            })
          }
        />
      </ProviderPage>
    );
  return children;
}
export function SupportNewScreen() {
  const auth = useAuth();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return (
    <SignedIn deletion={kind === 'deletion'}>
      <NewForm key={auth.user?.uid ?? 'guest'} deletion={kind === 'deletion'} />
    </SignedIn>
  );
}
function NewForm({ deletion }: { deletion: boolean }) {
  const { user } = useAuth();
  const s = useProviderStyles();
  const feedback = useFeedback();
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const id = useRef<string | null>(null);
  const disablePrevention = usePreventRemove(
    (!!message || consent) && !done,
    ({ repeat }) => {
      if (pending.current) return;
      feedback.show('إلغاء الطلب؟', 'البيانات اللي كتبتها مش هتتحفظ.', [
        { text: 'كمّل الكتابة', style: 'cancel' },
        { text: 'إلغاء الطلب', style: 'destructive', onPress: repeat },
      ]);
    },
  );
  async function send() {
    if (pending.current || !user || !db) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      id.current ??= allocateSupportId(db);
      await submitSupportRequest(
        db,
        id.current,
        user.uid,
        deletion ? 'deletion' : 'support',
        message,
        consent,
      );
      setDone(true);
      disablePrevention();
      router.replace({ pathname: '/support/[id]', params: { id: id.current } });
    } catch (cause) {
      setError(
        cause instanceof Error && /حرف|توافق|مستخدم/.test(cause.message)
          ? cause.message
          : 'لسه متأكدناش إن الطلب وصل. اتأكد من الاتصال واضغط إرسال تاني بنفس البيانات.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProviderPage title={deletion ? 'طلب حذف الحساب' : 'طلب دعم جديد'}>
        <Text style={s.notice}>
          {deletion
            ? 'ده طلب مراجعة يدوي، مش حذف فوري. الدعم هيتحقق من ملكية الحساب ويراجع بيانات الحساب والخدمات والطلبات. جاهز للحذف معناها إن التنفيذ اليدوي لسه مطلوب. بعد التنفيذ الدعم هيؤكد بالبريد يدويًا؛ مفيش رسائل آلية.'
            : 'اكتب المشكلة أو الاقتراح. متكتبش كلمة المرور أو بيانات حساسة. الرد وآخر حالة بيظهروا هنا.'}
        </Text>
        <FormField
          label="تفاصيل الطلب"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          editable={!busy}
        />
        {deletion ? (
          <View style={s.card}>
            <Text style={s.body}>
              موافق أطلب مراجعة حذف حسابي والبيانات المرتبطة بيه، وفاهم إن الدعم
              هيتحقق من ملكيتي قبل التنفيذ وإن الحذف بعد تنفيذه قد لا يمكن
              التراجع عنه.
            </Text>
            <Switch
              accessibilityLabel="الموافقة على طلب مراجعة حذف الحساب"
              value={consent}
              onValueChange={setConsent}
              disabled={busy}
            />
          </View>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={s.notice}>
            {error}
          </Text>
        ) : null}
        {!db ? (
          <Text style={s.notice}>
            الدعم غير متاح حاليًا. استخدم البريد في صفحة التواصل.
          </Text>
        ) : null}
        <ProviderAction
          title={busy ? 'بنرسل الطلب…' : 'إرسال الطلب'}
          onPress={() => void send()}
          disabled={busy || !db || !message.trim() || (deletion && !consent)}
        />
        <Text style={s.body}>
          الطلب مش بيتحفظ للإرسال لاحقًا بدون اتصال. احتفظ بالصفحة مفتوحة عند
          إعادة المحاولة. تأكيد الاستلام بيظهر بعد حفظه على النظام.
        </Text>
      </ProviderPage>
    </KeyboardAvoidingView>
  );
}
export function SupportListScreen({ admin = false }: { admin?: boolean }) {
  return admin ? (
    <AdminGuard>
      <RequestList admin />
    </AdminGuard>
  ) : (
    <SignedIn>
      <RequestList />
    </SignedIn>
  );
}
function RequestList({ admin = false }: { admin?: boolean }) {
  const { user, isAdmin } = useAuth();
  const s = useProviderStyles();
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh;
      setRows([]);
      setLoading(true);
      setError('');
      if (!user || !db || (admin && !isAdmin)) {
        setLoading(false);
        return;
      }
      void fetchSupportRequests(db, admin ? undefined : user.uid)
        .then((result) => {
          if (active) setRows(result);
        })
        .catch(() => {
          if (active)
            setError('مش قادرين نحمّل الطلبات. تأكد من الاتصال وحاول تاني.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user, isAdmin, admin, refresh]),
  );
  return (
    <ProviderPage title={admin ? 'إدارة طلبات الدعم' : 'طلباتي للدعم'}>
      {!admin ? (
        <ProviderAction
          title="طلب دعم جديد"
          onPress={() => router.push('/support/new')}
        />
      ) : null}
      <ProviderAction
        title="تحديث الطلبات"
        secondary
        onPress={() => setRefresh((value) => value + 1)}
      />
      {loading ? (
        <Text style={s.body}>بنحمّل الطلبات…</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={s.notice}>
          {error}
        </Text>
      ) : !rows.length ? (
        <Text style={s.body}>مفيش طلبات حاليًا.</Text>
      ) : null}
      {admin ? (
        <View style={s.card}>
          <Text style={s.label}>نوع الطلب</Text>
          {['all', 'support', 'deletion'].map((kind) => (
            <ProviderAction
              key={kind}
              secondary
              title={
                (kind === 'all'
                  ? 'كل الطلبات'
                  : kind === 'support'
                    ? 'الدعم'
                    : 'حذف الحساب') + (kindFilter === kind ? ' ✓' : '')
              }
              onPress={() => setKindFilter(kind)}
            />
          ))}
          <Text style={s.label}>حالة الطلب</Text>
          {['all', ...Object.keys(statusLabels)].map((status) => (
            <ProviderAction
              key={status}
              secondary
              title={
                (status === 'all'
                  ? 'كل الحالات'
                  : statusLabels[status as keyof typeof statusLabels]) +
                (statusFilter === status ? ' ✓' : '')
              }
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </View>
      ) : null}
      {rows
        .filter(
          (item) =>
            ((admin && isAdmin) || item.ownerId === user?.uid) &&
            (kindFilter === 'all' || item.kind === kindFilter) &&
            (statusFilter === 'all' || item.status === statusFilter),
        )
        .map((item) => (
          <View key={item.id} style={s.card}>
            <Text style={s.label}>
              {item.kind === 'deletion' ? 'طلب حذف حساب' : 'طلب دعم'} —{' '}
              {statusLabels[item.status]}
            </Text>
            <Text numberOfLines={2} style={s.body}>
              {item.message}
            </Text>
            <ProviderAction
              title="تفاصيل الطلب"
              secondary
              onPress={() =>
                router.push({
                  pathname: admin ? '/admin/support/[id]' : '/support/[id]',
                  params: { id: item.id },
                })
              }
            />
          </View>
        ))}
      <Text style={s.body}>
        بنعرض آخر ٥٠ طلب. احتفظ برقم الطلب عشان تفتحه مباشرة.
      </Text>
    </ProviderPage>
  );
}
export function SupportDetailScreen({ admin = false }: { admin?: boolean }) {
  return admin ? (
    <AdminGuard>
      <RequestDetail admin />
    </AdminGuard>
  ) : (
    <SignedIn>
      <RequestDetail />
    </SignedIn>
  );
}
function RequestDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const s = useProviderStyles();
  const [record, setRequest] = useState<SupportRequest | null>(null);
  const request =
    record && ((admin && isAdmin) || record.ownerId === user?.uid)
      ? record
      : null;
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const pending = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh;
      setRequest(null);
      setError('');
      if (db && user && (!admin || isAdmin))
        void fetchSupportRequest(db, id)
          .then((result) => {
            if (active) setRequest(result);
          })
          .catch(() => {
            if (active) setError('الطلب غير متاح أو الاتصال غير متوفر.');
          });
      return () => {
        active = false;
      };
    }, [id, user, isAdmin, admin, refresh]),
  );
  async function review(status: Parameters<typeof reviewSupportRequest>[2]) {
    if (!db || !isAdmin || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await reviewSupportRequest(db, id, status, note);
      setNote('');
      setRefresh((value) => value + 1);
    } catch {
      setError(
        'المراجعة متحفظتش. اكتب سبب الرفض لو اخترت الرفض، وتأكد من الاتصال وحدّث الحالة قبل المحاولة.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <ProviderPage title="تفاصيل طلب الدعم">
      {error ? (
        <Text accessibilityRole="alert" style={s.notice}>
          {error}
        </Text>
      ) : null}
      <ProviderAction
        title="تحديث الحالة"
        secondary
        disabled={busy}
        onPress={() => setRefresh((value) => value + 1)}
      />
      {request ? (
        <>
          <Text selectable style={s.body}>
            رقم الطلب: {request.id}
          </Text>
          <Text style={s.heading}>{statusLabels[request.status]}</Text>
          <Text style={s.body}>
            اتسلم: {new Date(request.createdAt).toLocaleString('ar-EG')} — آخر
            تحديث: {new Date(request.updatedAt).toLocaleString('ar-EG')}
          </Text>
          <Text selectable style={s.body}>
            {request.message}
          </Text>
          {request.staffNote ? (
            <Text style={s.notice}>آخر رد من الدعم: {request.staffNote}</Text>
          ) : null}
          {request.kind === 'deletion' ? (
            <Text style={s.notice}>
              حالة الطلب مش تأكيد حذف الحساب. الدعم بيتحقق وينفذ الحذف يدويًا
              بأدوات موثوقة خارج التطبيق، وبعد التنفيذ بيأكد بالبريد. تقدر تتابع
              الطلب لحد الحذف الفعلي.
            </Text>
          ) : null}
          {admin && nextStatuses(request.kind, request.status).length ? (
            <>
              <FormField
                label="ملاحظة للمستخدم (مطلوبة للرفض)"
                value={note}
                onChangeText={setNote}
                maxLength={2000}
                multiline
                editable={!busy}
              />
              {nextStatuses(request.kind, request.status).map((status) => (
                <ProviderAction
                  key={status}
                  title={statusLabels[status]}
                  disabled={busy || (status === 'rejected' && !note.trim())}
                  onPress={() => void review(status)}
                />
              ))}
            </>
          ) : null}
        </>
      ) : !error ? (
        <Text style={s.body}>بنحمّل الطلب…</Text>
      ) : null}
    </ProviderPage>
  );
}
