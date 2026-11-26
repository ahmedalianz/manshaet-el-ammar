import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable as BackdropPressable,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedback } from '../../components/ui/Feedback';
import { LoadingState } from '../../components/ui/LoadingState';
import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { db } from '../../lib/firebase/firestore';
import type { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { fontFamily, typography } from '../../theme/typography';
import { AdminGuard, AdminPage } from '../admin/AdminUi';
import { useAuth } from '../auth/AuthProvider';
import { BackHeader, EmptyState } from '../discovery/components/DiscoveryUi';
import { FormField } from '../provider/FormField';
import { fetchProfile } from '../provider/firebaseRepository';
import { useProviderState } from '../provider/ProviderContext';
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
  type RequestStatus,
  type SupportRequest,
} from './requests';

function getStatusTone(status: RequestStatus, colors: ThemeColors) {
  return {
    received: {
      bg: colors.categoryBlue,
      fg: colors.primaryDark,
      icon: 'inbox-arrow-down-outline' as const,
    },
    in_review: {
      bg: colors.pendingBackground,
      fg: colors.warning,
      icon: 'clock-outline' as const,
    },
    resolved: {
      bg: colors.publishedBackground,
      fg: colors.success,
      icon: 'check-circle-outline' as const,
    },
    rejected: {
      bg: colors.errorContainer,
      fg: colors.error,
      icon: 'close-circle-outline' as const,
    },
  }[status];
}

function formatTicketDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function SignedIn({ children }: { children: ReactNode }) {
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
              params: { next: 'support' },
            })
          }
        />
      </ProviderPage>
    );
  return children;
}
export function SupportNewScreen() {
  const auth = useAuth();
  return (
    <SignedIn>
      <NewForm key={auth.user?.uid ?? 'guest'} />
    </SignedIn>
  );
}
function NewForm() {
  const { user } = useAuth();
  const s = useProviderStyles();
  const feedback = useFeedback();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const id = useRef<string | null>(null);
  const disablePrevention = usePreventRemove(!!message && !done, ({ repeat }) => {
    if (pending.current) return;
    feedback.show('إلغاء الطلب؟', 'البيانات اللي كتبتها مش هتتحفظ.', [
      { text: 'كمّل الكتابة', style: 'cancel' },
      { text: 'إلغاء الطلب', style: 'destructive', onPress: repeat },
    ]);
  });
  async function send() {
    if (pending.current || !user || !db) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      id.current ??= allocateSupportId(db);
      await submitSupportRequest(db, id.current, user.uid, message);
      setDone(true);
      disablePrevention();
      router.replace({ pathname: '/support/[id]', params: { id: id.current } });
    } catch (cause) {
      setError(
        cause instanceof Error && /حرف|مستخدم/.test(cause.message)
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
      <ProviderPage title="طلب دعم جديد">
        <Text style={s.notice}>
          اكتب المشكلة أو الاقتراح. متكتبش كلمة المرور أو بيانات حساسة. الرد
          وآخر حالة بيظهروا هنا.
        </Text>
        <FormField
          label="تفاصيل الطلب"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          editable={!busy}
        />
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
          disabled={busy || !db || !message.trim()}
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
  const { services } = useProviderState();
  const allServices = services ?? [];
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string | null>>(
    {},
  );
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>(
    'all',
  );
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const scopeKey = `${admin}:${user?.uid ?? ''}`;
  const loadedScope = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh;
      setError('');
      if (!user || !db || (admin && !isAdmin)) {
        loadedScope.current = null;
        setRows([]);
        setOwnerNames({});
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (loadedScope.current !== scopeKey) {
        setRows([]);
        setOwnerNames({});
        setLoading(true);
        setRefreshing(false);
      } else {
        setRefreshing(true);
      }
      const database = db;
      void fetchSupportRequests(database, admin ? undefined : user.uid)
        .then((result) => {
          if (!active) return;
          loadedScope.current = scopeKey;
          setRows(result);
          if (admin && isAdmin && result.length > 0) {
            const uniqueOwnerIds = [
              ...new Set(result.map((item) => item.ownerId)),
            ];
            void Promise.all(
              uniqueOwnerIds.map(
                async (uid) =>
                  [
                    uid,
                    await fetchProfile(database, uid)
                      .then((profile) => profile?.name ?? null)
                      .catch(() => null),
                  ] as const,
              ),
            ).then((entries) => {
              if (active && loadedScope.current === scopeKey)
                setOwnerNames(Object.fromEntries(entries));
            });
          } else {
            setOwnerNames({});
          }
        })
        .catch(() => {
          if (active)
            setError('مش قادرين نحمّل الطلبات. تأكد من الاتصال وحاول تاني.');
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setRefreshing(false);
          }
        });
      return () => {
        active = false;
      };
    }, [user, isAdmin, admin, refresh, scopeKey]),
  );

  const scopedRows = rows.filter(
    (item) => (admin && isAdmin) || item.ownerId === user?.uid,
  );
  const visibleRows = scopedRows.filter(
    (item) => statusFilter === 'all' || item.status === statusFilter,
  );
  const triggerRefresh = () => setRefresh((value) => value + 1);
  const clearFilters = () => {
    setStatusFilter('all');
  };

  const pendingCount = scopedRows.filter(
    (item) => item.status === 'received' || item.status === 'in_review',
  ).length;
  const doneCount = scopedRows.filter(
    (item) => item.status === 'resolved' || item.status === 'rejected',
  ).length;

  const listBody =
    loading && scopedRows.length === 0 ? (
      <LoadingState label="بنحمّل طلبات الدعم…" />
    ) : (
      <>
        <FlatList
          data={visibleRows}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={triggerRefresh}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {!admin && scopedRows.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="طلب دعم جديد"
                  onPress={() => router.push('/support/new')}
                  style={styles.newRequestButton}
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={21}
                    color={colors.onPrimary}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.newRequestText}>طلب دعم جديد</Text>
                </Pressable>
              ) : null}
              {admin && scopedRows.length > 0 ? (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text
                      style={[
                        styles.summaryCount,
                        { color: colors.primaryDark },
                      ]}
                    >
                      {pendingCount.toLocaleString('ar-EG')}
                    </Text>
                    <Text style={styles.summaryLabel}>تحتاج متابعة</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text
                      style={[styles.summaryCount, { color: colors.success }]}
                    >
                      {doneCount.toLocaleString('ar-EG')}
                    </Text>
                    <Text style={styles.summaryLabel}>مكتملة / مغلقة</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.toolbar}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.resultsLabel}
                >
                  عرض {visibleRows.length.toLocaleString('ar-EG')} طلب
                </Text>
                <View style={styles.toolbarActions}>
                  {admin ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="تصفية حسب حالة الطلب"
                      accessibilityState={{
                        expanded: statusSheetOpen,
                        selected: statusFilter !== 'all',
                      }}
                      onPress={() => setStatusSheetOpen(true)}
                      style={[
                        styles.filterPill,
                        statusFilter !== 'all' && styles.filterPillActive,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="tune-variant"
                        size={18}
                        color={
                          statusFilter !== 'all'
                            ? colors.onPrimary
                            : colors.primaryDark
                        }
                        accessibilityElementsHidden
                      />
                      <Text
                        style={[
                          styles.filterPillText,
                          statusFilter !== 'all' && styles.filterPillTextActive,
                        ]}
                      >
                        {statusFilter === 'all'
                          ? 'كل الحالات'
                          : statusLabels[statusFilter]}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="تحديث الطلبات"
                    onPress={triggerRefresh}
                    style={styles.filterPill}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={18}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text style={styles.filterPillText}>تحديث</Text>
                  </Pressable>
                </View>
              </View>
              {error ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={20}
                    color={colors.error}
                    accessibilityElementsHidden
                  />
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const tone = getStatusTone(item.status, colors);
            const hasService =
              admin &&
              allServices.some((service) => service.ownerId === item.ownerId);
            const resolvedName =
              item.ownerId in ownerNames
                ? (ownerNames[item.ownerId] ?? 'اسم الحساب غير متاح')
                : 'بنحمّل الاسم…';
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`طلب دعم — ${statusLabels[item.status]} — تفاصيل الطلب`}
                onPress={() =>
                  router.push({
                    pathname: admin ? '/admin/support/[id]' : '/support/[id]',
                    params: { id: item.id },
                  })
                }
                style={styles.ticketCard}
              >
                <View style={styles.ticketHeader}>
                  <View style={styles.kindBadge}>
                    <View
                      style={[
                        styles.kindIconBox,
                        { backgroundColor: colors.categoryBlue },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="lifebuoy"
                        size={20}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <Text style={styles.kindTitle}>طلب دعم</Text>
                  </View>
                  <View
                    style={[styles.statusPill, { backgroundColor: tone.bg }]}
                  >
                    <MaterialCommunityIcons
                      name={tone.icon}
                      size={14}
                      color={tone.fg}
                      accessibilityElementsHidden
                    />
                    <Text style={[styles.statusPillText, { color: tone.fg }]}>
                      {statusLabels[item.status]}
                    </Text>
                  </View>
                </View>
                {admin ? (
                  <View style={styles.requesterRow}>
                    <View style={styles.requesterIdentity}>
                      <MaterialCommunityIcons
                        name="account-outline"
                        size={16}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.requesterLabel}>مقدم الطلب:</Text>
                      <Text style={styles.requesterName}>{resolvedName}</Text>
                    </View>
                    {hasService ? (
                      <View style={styles.providerChip}>
                        <Text style={styles.providerChipText}>مزود خدمة</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text numberOfLines={2} style={styles.ticketMessage}>
                  {item.message}
                </Text>
                {item.staffNote ? (
                  <View style={styles.replyPreview}>
                    <MaterialCommunityIcons
                      name="reply-outline"
                      size={15}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <Text numberOfLines={1} style={styles.replyPreviewText}>
                      آخر رد: {item.staffNote}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.ticketFooter}>
                  <View style={styles.ticketMeta}>
                    <View style={styles.idPill}>
                      <Text style={styles.idPillText}>
                        #{item.id.slice(0, 8)}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {formatTicketDate(item.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.ticketCta}>
                    <Text style={styles.ticketCtaText}>تفاصيل الطلب</Text>
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={18}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !error ? (
              scopedRows.length > 0 ? (
                <EmptyState
                  title="مفيش طلبات مطابقة للفلتر ده"
                  message="جرّب تغيّر نوع الطلب أو حالته أو اعرض كل الطلبات."
                  actionLabel="مسح الفلاتر"
                  onAction={clearFilters}
                />
              ) : (
                <EmptyState
                  title={
                    admin
                      ? 'مفيش طلبات دعم واردة حاليًا'
                      : 'معندكش طلبات دعم سابقة'
                  }
                  message={
                    admin
                      ? 'أي طلب دعم جديد هيظهر هنا.'
                      : 'لو محتاج مساعدة أو عندك استفسار، تقدر تبعت طلب دعم جديد.'
                  }
                  actionLabel={!admin ? 'طلب دعم جديد' : undefined}
                  onAction={
                    !admin ? () => router.push('/support/new') : undefined
                  }
                />
              )
            ) : undefined
          }
          ListFooterComponent={
            <Text style={styles.footerNote}>
              بنعرض آخر ٥٠ طلب. احتفظ برقم الطلب عشان تفتحه مباشرة.
            </Text>
          }
        />
        {admin ? (
          <Modal
            visible={statusSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setStatusSheetOpen(false)}
          >
            <View style={styles.backdrop}>
              <BackdropPressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق نافذة الفلاتر"
                onPress={() => setStatusSheetOpen(false)}
                style={StyleSheet.absoluteFill}
              />
              <SafeAreaView
                edges={['bottom']}
                style={styles.sheet}
                accessibilityViewIsModal
              >
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text accessibilityRole="header" style={styles.sheetTitle}>
                    حالة الطلب
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="إغلاق الفلاتر"
                    onPress={() => setStatusSheetOpen(false)}
                    style={styles.sheetDone}
                  >
                    <Text style={styles.sheetDoneText}>تم</Text>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.sheetBody}>
                  <View style={styles.chipGrid}>
                    {(
                      ['all', ...Object.keys(statusLabels)] as (
                        'all' | RequestStatus
                      )[]
                    ).map((status) => {
                      const label =
                        status === 'all' ? 'كل الحالات' : statusLabels[status];
                      const selected = statusFilter === status;
                      const count = scopedRows.filter(
                        (item) => status === 'all' || item.status === status,
                      ).length;
                      const chipText = `${label} (${count.toLocaleString('ar-EG')})`;
                      return (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityState={{ selected }}
                          onPress={() => setStatusFilter(status)}
                          style={[styles.chip, selected && styles.chipSelected]}
                        >
                          {selected ? (
                            <MaterialCommunityIcons
                              name="check"
                              size={18}
                              color={colors.onPrimary}
                              accessibilityElementsHidden
                            />
                          ) : null}
                          <Text
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                          >
                            {chipText.replaceAll(' ', '\u00a0')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.sheetActions}>
                    <ProviderAction
                      title="عرض النتائج"
                      onPress={() => setStatusSheetOpen(false)}
                    />
                    <ProviderAction
                      title="مسح الفلاتر"
                      secondary
                      onPress={() => {
                        clearFilters();
                        setStatusSheetOpen(false);
                      }}
                    />
                  </View>
                </ScrollView>
              </SafeAreaView>
            </View>
          </Modal>
        ) : null}
      </>
    );

  if (admin) {
    return (
      <AdminPage title="إدارة طلبات الدعم" badge="مشرف الدليل" scroll={false}>
        {listBody}
      </AdminPage>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <BackHeader title="طلباتي للدعم" />
      {listBody}
    </SafeAreaView>
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
  const { services } = useProviderState();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [record, setRequest] = useState<SupportRequest | null>(null);
  const request =
    record && ((admin && isAdmin) || record.ownerId === user?.uid)
      ? record
      : null;
  const ownerId = request?.ownerId;
  const ownedServices =
    admin && ownerId
      ? (services ?? []).filter((service) => service.ownerId === ownerId)
      : [];
  const [ownerRefresh, setOwnerRefresh] = useState(0);
  const ownerKey =
    admin && isAdmin && db && ownerId ? `${ownerId}:${ownerRefresh}` : null;
  const [ownerResult, setOwnerResult] = useState<{
    key: string;
    status: 'ready' | 'error';
    name: string | null;
  } | null>(null);
  const ownerState = !ownerKey
    ? { status: 'idle' as const, name: null }
    : ownerResult?.key === ownerKey
      ? { status: ownerResult.status, name: ownerResult.name }
      : { status: 'loading' as const, name: null };
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
  useEffect(() => {
    if (!ownerKey || !db || !ownerId) return;
    let active = true;
    void fetchProfile(db, ownerId)
      .then((profile) => {
        if (active)
          setOwnerResult({
            key: ownerKey,
            status: 'ready',
            name: profile?.name ?? null,
          });
      })
      .catch(() => {
        if (active)
          setOwnerResult({ key: ownerKey, status: 'error', name: null });
      });
    return () => {
      active = false;
    };
  }, [ownerKey, ownerId]);
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

  const tone = request ? getStatusTone(request.status, colors) : null;
  const detailContent = (
    <>
      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.error}
            accessibilityElementsHidden
          />
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
      <View style={styles.detailToolbar}>
        {request ? (
          <View style={styles.idPill}>
            <Text style={styles.idPillText}>#{request.id.slice(0, 8)}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تحديث الحالة"
          disabled={busy}
          onPress={() => setRefresh((value) => value + 1)}
          style={styles.filterPill}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
          <Text style={styles.filterPillText}>تحديث الحالة</Text>
        </Pressable>
      </View>
      {request && tone ? (
        <>
          <View style={styles.detailCard}>
            <View style={styles.ticketHeader}>
              <View style={styles.kindBadge}>
                <View
                  style={[
                    styles.kindIconBox,
                    { backgroundColor: colors.categoryBlue },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lifebuoy"
                    size={20}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </View>
                <Text style={styles.kindTitle}>طلب دعم</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                <MaterialCommunityIcons
                  name={tone.icon}
                  size={14}
                  color={tone.fg}
                  accessibilityElementsHidden
                />
                <Text style={[styles.statusPillText, { color: tone.fg }]}>
                  {statusLabels[request.status]}
                </Text>
              </View>
            </View>
            <View style={styles.metaBox}>
              <Text selectable style={styles.metaText}>
                رقم الطلب: {request.id}
              </Text>
              <Text style={styles.metaText}>
                اتسلم: {new Date(request.createdAt).toLocaleString('ar-EG')}
              </Text>
              <Text style={styles.metaText}>
                آخر تحديث: {new Date(request.updatedAt).toLocaleString('ar-EG')}
              </Text>
            </View>
            <View style={styles.messageBlock}>
              <Text style={styles.sectionLabel}>تفاصيل الطلب</Text>
              <Text selectable style={styles.detailMessage}>
                {request.message}
              </Text>
            </View>
          </View>
          {admin ? (
            <View style={styles.detailCard}>
              <View style={styles.ownerHeader}>
                <View style={styles.ownerIconBox}>
                  <MaterialCommunityIcons
                    name="account-circle-outline"
                    size={22}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </View>
                <View style={styles.ownerCopy}>
                  <Text accessibilityRole="header" style={styles.sectionLabel}>
                    صاحب الطلب
                  </Text>
                  <Text style={styles.ownerNameText}>
                    {ownerState.status === 'error'
                      ? 'مش قادرين نحمّل اسم صاحب الحساب.'
                      : ownerState.status === 'loading'
                        ? 'بنحمّل اسم صاحب الحساب…'
                        : (ownerState.name ?? 'اسم الحساب غير متاح')}
                  </Text>
                </View>
              </View>
              {ownerState.status === 'error' ? (
                <ProviderAction
                  title="إعادة تحميل صاحب الحساب"
                  secondary
                  onPress={() => setOwnerRefresh((value) => value + 1)}
                />
              ) : null}
              {ownedServices.length > 0 ? (
                <View style={styles.linkedServicesBlock}>
                  <Text style={styles.sectionLabel}>خدمات مرتبطة بالحساب</Text>
                  {ownedServices.map((service) => (
                    <Pressable
                      key={service.id}
                      accessibilityRole="button"
                      accessibilityLabel={`إدارة خدمة ${service.serviceTitle}`}
                      onPress={() =>
                        router.push({
                          pathname: '/admin/service/[id]',
                          params: { id: service.id },
                        })
                      }
                      style={styles.linkedServiceRow}
                    >
                      <MaterialCommunityIcons
                        name="storefront-outline"
                        size={18}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <View style={styles.linkedServiceCopy}>
                        <Text style={styles.linkedServiceTitle}>
                          {service.name} — {service.serviceTitle}
                        </Text>
                        <Text style={styles.captionText}>
                          {service.publicationStatus === 'published'
                            ? 'منشورة في الدليل'
                            : 'في الأرشيف (غير منشورة)'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-left"
                        size={18}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {request.staffNote ? (
            <View style={styles.replyCard}>
              <View style={styles.replyHeader}>
                <MaterialCommunityIcons
                  name="reply-outline"
                  size={18}
                  color={colors.primaryDark}
                  accessibilityElementsHidden
                />
                <Text style={styles.replyHeaderTitle}>آخر رد من الدعم</Text>
              </View>
              <Text selectable style={styles.detailMessage}>
                {request.staffNote}
              </Text>
            </View>
          ) : null}
          {admin && nextStatuses(request.status).length ? (
            <View style={styles.detailCard}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                تحديث حالة الطلب
              </Text>
              <FormField
                label="ملاحظة للمستخدم (مطلوبة للرفض)"
                value={note}
                onChangeText={setNote}
                maxLength={2000}
                multiline
                editable={!busy}
              />
              {nextStatuses(request.status).map((status) => (
                <ProviderAction
                  key={status}
                  title={statusLabels[status]}
                  secondary={status === 'rejected'}
                  destructive={status === 'rejected'}
                  disabled={busy || (status === 'rejected' && !note.trim())}
                  onPress={() => void review(status)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : !error ? (
        <LoadingState label="بنحمّل تفاصيل الطلب…" />
      ) : null}
    </>
  );

  if (admin) {
    return (
      <AdminPage title="تفاصيل طلب الدعم" badge="مشرف الدليل">
        {detailContent}
      </AdminPage>
    );
  }

  return <ProviderPage title="تفاصيل طلب الدعم">{detailContent}</ProviderPage>;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      gap: 12,
      flexGrow: 1,
      maxWidth: 840,
      width: '100%',
      alignSelf: 'center',
    },
    listHeader: { gap: 12 },
    newRequestButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: colors.actionBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    newRequestText: {
      ...typography.button,
      color: colors.onPrimary,
      writingDirection: 'rtl',
    },
    summaryRow: { flexDirection: 'row', gap: 8 },
    summaryCard: {
      flex: 1,
      minWidth: 0,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    summaryCount: {
      ...typography.sectionTitle,
      fontFamily: fontFamily.bold,
    },
    summaryLabel: {
      ...typography.caption,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    toolbarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    resultsLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },
    filterPill: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.actionBackground,
      borderColor: colors.actionBackground,
    },
    filterPillText: {
      ...typography.caption,
      fontFamily: fontFamily.medium,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    filterPillTextActive: { color: colors.onPrimary },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.errorContainer,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: {
      ...typography.caption,
      flex: 1,
      color: colors.error,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    ticketCard: {
      borderRadius: 20,
      padding: 16,
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ticketHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    kindBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    kindIconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kindTitle: {
      ...typography.title,
      flexShrink: 1,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    statusPill: {
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    statusPillText: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      lineHeight: 20,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    ticketMessage: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    replyPreview: {
      backgroundColor: colors.surfaceLow,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    replyPreviewText: {
      ...typography.caption,
      flex: 1,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    ticketFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    ticketMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    idPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.surfaceLow,
    },
    idPillText: {
      ...typography.caption,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
      writingDirection: 'ltr',
    },
    dateText: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    ticketCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    ticketCtaText: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    footerNote: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'center',
      writingDirection: 'rtl',
      paddingTop: spacing.xs,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '85%',
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing.sm,
    },
    sheetTitle: {
      ...typography.sectionTitle,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    sheetDone: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    sheetDoneText: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    sheetBody: { gap: spacing.md, paddingBottom: spacing.sm },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.actionBackground,
      borderColor: colors.actionBackground,
    },
    chipText: {
      ...typography.caption,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    chipTextSelected: { color: colors.onPrimary },
    sheetActions: { gap: spacing.sm },
    detailToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    metaBox: {
      backgroundColor: colors.surfaceLow,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    messageBlock: { gap: 6 },
    sectionLabel: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    detailMessage: {
      ...typography.body,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    replyCard: {
      backgroundColor: colors.surfaceLow,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    replyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    replyHeaderTitle: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    requesterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
      backgroundColor: colors.surfaceLow,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    requesterIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    requesterLabel: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    requesterName: {
      ...typography.caption,
      fontFamily: fontFamily.medium,
      color: colors.textPrimary,
      flexShrink: 1,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    providerChip: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: colors.categoryBlue,
    },
    providerChipText: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    ownerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    ownerIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.categoryBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ownerCopy: { flex: 1, minWidth: 0, gap: 2 },
    ownerNameText: {
      ...typography.title,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    linkedServicesBlock: { gap: 8 },
    linkedServiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linkedServiceCopy: { flex: 1, minWidth: 0, gap: 2 },
    linkedServiceTitle: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    captionText: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
  });
