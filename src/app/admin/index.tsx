import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  AdminGuard,
  AdminPage,
  ServiceSummary,
  useAdminStyles,
  formatAdminDate,
} from '../../features/admin/AdminUi';
import {
  EmptyState,
  SearchInput,
} from '../../features/discovery/components/DiscoveryUi';
import { categories } from '../../features/discovery/data/categories';
import { normalizeArabic } from '../../features/discovery/search';
import {
  ProviderAction,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { useProviderState } from '../../features/provider/ProviderContext';
import { useAdminClaims } from '../../features/claims/useServiceClaims';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import type {
  PublishedService,
  ServiceClaim,
  ServiceReport,
  ServiceRequest,
} from '../../features/provider/types';

type AdminTab = 'requests' | 'claims' | 'services' | 'reports' | 'archive';
type DashboardRow =
  | { key: string; kind: 'request'; request: ServiceRequest }
  | { key: string; kind: 'claim'; claim: ServiceClaim }
  | { key: string; kind: 'service'; service: PublishedService }
  | { key: string; kind: 'report'; report: ServiceReport };
const tabs: {
  id: AdminTab;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { id: 'requests', label: 'طلبات المراجعة', icon: 'clipboard-clock-outline' },
  { id: 'claims', label: 'طلبات الملكية', icon: 'account-switch-outline' },
  {
    id: 'services',
    label: 'الخدمات المنشورة',
    icon: 'storefront-check-outline',
  },
  { id: 'archive', label: 'الأرشيف', icon: 'archive-outline' },
  { id: 'reports', label: 'البلاغات', icon: 'flag-outline' },
];
export default function AdminScreen() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}
function AdminDashboard() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const providerStyles = useProviderStyles();
  const adminStyles = useAdminStyles();
  const {
    userId,
    services,
    reports,
    pendingRequests,
    refresh,
    privateRefreshing,
    adminBusy,
    syncClaimableServices,
  } = useProviderState();
  const { claims: pendingClaimsList } = useAdminClaims('pending');
  const [activeTab, setActiveTab] = useState<AdminTab>('requests');
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const pending = [...pendingRequests].sort((a, b) =>
    newestFirst
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  );
  const pendingClaims = [...pendingClaimsList].sort((a, b) =>
    newestFirst
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  );
  const published = services.filter(
    (service) => service.publicationStatus === 'published',
  );
  const unclaimedAdminIds = published
    .filter((service) => service.ownerId === userId && !service.claimable)
    .map((service) => service.id);
  const openReports = reports
    .filter((report) => report.status === 'open')
    .sort((a, b) =>
      newestFirst
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  const archived = services.filter(
    (service) => service.publicationStatus === 'unpublished',
  );
  const matches = (activeTab === 'archive' ? archived : published).filter(
    (service) =>
      normalizeArabic(`${service.name} ${service.serviceTitle}`).includes(
        normalizeArabic(query),
      ),
  );
  const counts: Record<AdminTab, number> = {
    requests: pending.length,
    claims: pendingClaims.length,
    services: published.length,
    reports: openReports.length,
    archive: archived.length,
  };
  const rows: DashboardRow[] =
    activeTab === 'requests'
      ? pending.map((request) => ({
          key: request.id,
          kind: 'request',
          request,
        }))
      : activeTab === 'claims'
        ? pendingClaims.map((claim) => ({
            key: claim.id,
            kind: 'claim',
            claim,
          }))
        : activeTab === 'services' || activeTab === 'archive'
          ? matches.map((service) => ({
              key: service.id,
              kind: 'service',
              service,
            }))
          : openReports.map((report) => ({
              key: report.id,
              kind: 'report',
              report,
            }));
  const renderRow = ({ item }: { item: DashboardRow }) => {
    if (item.kind === 'request') {
      const proposed = item.request.proposedData;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`مراجعة ${proposed.serviceTitle}`}
          style={adminStyles.card}
          onPress={() =>
            router.push({
              pathname: '/admin/request/[id]',
              params: { id: item.request.id },
            })
          }
        >
          <View style={styles.requestHeading}>
            <Text style={[providerStyles.label, styles.grow]}>
              {proposed.name}
            </Text>
            <Text
              style={[
                adminStyles.badge,
                item.request.type === 'create'
                  ? styles.createBadge
                  : styles.updateBadge,
              ]}
            >
              {item.request.type === 'create'
                ? 'طلب خدمة جديدة'
                : item.request.type === 'restore'
                  ? 'تصحيح خدمة مخفية'
                  : 'تعديل خدمة منشورة'}
            </Text>
          </View>
          {item.request.photoReviewStatus === 'pending' ? (
            <Text style={adminStyles.badge}>
              {item.request.status === 'approved'
                ? 'الصورة فقط قيد المراجعة'
                : 'مراجعة صورة المكان'}
            </Text>
          ) : null}
          <Text style={styles.serviceTitle}>{proposed.serviceTitle}</Text>
          <Text style={providerStyles.body}>
            {categories.find((category) => category.id === proposed.categoryId)
              ?.name ?? 'قسم غير متاح'}
          </Text>
          <View style={styles.requestFooter}>
            <Text style={[providerStyles.body, styles.grow]}>
              {proposed.address}
            </Text>
            <Text style={styles.date}>
              {formatAdminDate(item.request.createdAt)}
            </Text>
            <MaterialCommunityIcons
              name="chevron-left"
              color={colors.muted}
              size={22}
            />
          </View>
        </Pressable>
      );
    }
    if (item.kind === 'claim') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`مراجعة طلب نقل ${item.claim.serviceName}`}
          style={adminStyles.card}
          onPress={() =>
            router.push({
              pathname: '/admin/claim/[id]',
              params: { id: item.claim.id },
            })
          }
        >
          <View style={styles.requestHeading}>
            <Text style={[providerStyles.label, styles.grow]}>
              {item.claim.serviceName}
            </Text>
            <Text style={[adminStyles.badge, styles.updateBadge]}>
              طلب نقل ملكية
            </Text>
          </View>
          <Text style={styles.serviceTitle}>{item.claim.serviceTitle}</Text>
          <Text style={providerStyles.body}>
            مقدم الطلب: {item.claim.claimantName} — {'\u2066'}
            {item.claim.claimantPhone}
            {'\u2069'}
          </Text>
          <View style={styles.requestFooter}>
            <Text style={[providerStyles.body, styles.grow]}>
              راجع الطلب وانقل الملكية
            </Text>
            <Text style={styles.date}>
              {formatAdminDate(item.claim.createdAt)}
            </Text>
            <MaterialCommunityIcons
              name="chevron-left"
              color={colors.muted}
              size={22}
            />
          </View>
        </Pressable>
      );
    }
    if (item.kind === 'service')
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`إدارة ${item.service.serviceTitle}`}
          style={adminStyles.card}
          onPress={() =>
            router.push({
              pathname: '/admin/service/[id]',
              params: { id: item.service.id },
            })
          }
        >
          <ServiceSummary values={item.service} />
          {item.service.claimable ? (
            <Text style={adminStyles.badge}>متاح لنقل الملكية</Text>
          ) : null}
          {item.service.unpublishReason ? (
            <Text style={providerStyles.notice}>
              سبب الإخفاء: {item.service.unpublishReason}
            </Text>
          ) : null}
          <Text style={providerStyles.label}>تفاصيل الخدمة ←</Text>
        </Pressable>
      );
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="مراجعة البلاغ"
        style={adminStyles.card}
        onPress={() =>
          router.push({
            pathname: '/admin/report/[id]',
            params: { id: item.report.id },
          })
        }
      >
        <Text style={providerStyles.label}>
          {services.find((service) => service.id === item.report.providerId)
            ?.serviceTitle ?? 'خدمة غير متاحة'}
        </Text>
        <Text style={providerStyles.body}>{item.report.reason}</Text>
        <Text style={styles.date}>
          تاريخ البلاغ: {formatAdminDate(item.report.createdAt)}
        </Text>
        <Text style={providerStyles.label}>مراجعة البلاغ ←</Text>
      </Pressable>
    );
  };
  return (
    <AdminPage title="إدارة الخدمات" badge="مشرف الدليل" scroll={false}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.top}>
            <ProviderAction
              title="إضافة خدمة جديدة"
              onPress={() =>
                router.push({
                  pathname: '/provider/add',
                  params: { from: 'admin' },
                })
              }
            />
            <Text style={styles.demo}>
              اسحب القائمة لتحديث الطلبات والخدمات والبلاغات.
            </Text>
            <View accessibilityRole="tablist" style={styles.filterGroup}>
              {tabs.map((tab) => {
                const selected = activeTab === tab.id;
                const count = counts[tab.id];
                const alertReport = tab.id === 'reports' && count > 0;
                return (
                  <Pressable
                    key={tab.id}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected }}
                    onPress={() => setActiveTab(tab.id)}
                    style={[
                      styles.filterChip,
                      selected && styles.activeChip,
                      !selected && alertReport && styles.alertChip,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={tab.icon}
                      size={18}
                      color={
                        selected
                          ? colors.onPrimary
                          : alertReport
                            ? colors.error
                            : colors.primaryDark
                      }
                      accessibilityElementsHidden
                    />
                    <Text
                      style={[
                        styles.chipLabel,
                        selected && styles.activeChipLabel,
                        !selected && alertReport && { color: colors.error },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.chipCountPill,
                        selected
                          ? styles.activeCountPill
                          : alertReport
                            ? styles.alertCountPill
                            : count > 0
                              ? styles.populatedCountPill
                              : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipCountText,
                          selected && styles.activeCountText,
                          !selected && alertReport && { color: colors.error },
                          !selected &&
                            !alertReport &&
                            count > 0 && { color: colors.primaryDark },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {activeTab === 'services' || activeTab === 'archive' ? (
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث باسم الخدمة أو صاحبها..."
              />
            ) : null}
            {activeTab === 'services' &&
            syncClaimableServices &&
            (unclaimedAdminIds.length > 0 || syncMessage) ? (
              <View style={adminStyles.card}>
                {unclaimedAdminIds.length > 0 ? (
                  <ProviderAction
                    secondary
                    disabled={Boolean(adminBusy)}
                    title={`تفعيل طلبات نقل الملكية لخدمات الإدارة (${unclaimedAdminIds.length.toLocaleString('ar-EG')})`}
                    onPress={async () => {
                      setSyncMessage(null);
                      try {
                        const result =
                          await syncClaimableServices(unclaimedAdminIds);
                        if (result.failed > 0 && result.lastError) {
                          setSyncMessage(
                            `اتفعّلت ${result.updated.toLocaleString('ar-EG')} خدمة وتعذّر تحديث ${result.failed.toLocaleString('ar-EG')}: ${result.lastError}`,
                          );
                        } else if (result.updated > 0) {
                          setSyncMessage(
                            `تم تفعيل طلبات نقل الملكية لـ ${result.updated.toLocaleString('ar-EG')} خدمة.`,
                          );
                        } else {
                          setSyncMessage('كل خدمات الإدارة متفعّلة بالفعل.');
                        }
                      } catch (cause) {
                        setSyncMessage(
                          cause instanceof Error
                            ? cause.message
                            : 'مش قادرين نفعّل الخدمات دلوقتي. جرّب تاني.',
                        );
                      }
                    }}
                  />
                ) : null}
                {syncMessage ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={providerStyles.notice}
                  >
                    {syncMessage}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.listToolbar}>
              {activeTab !== 'services' && activeTab !== 'archive' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    newestFirst ? 'الفرز: الأحدث أولًا' : 'الفرز: الأقدم أولًا'
                  }
                  onPress={() => setNewestFirst((value) => !value)}
                  style={styles.sortButton}
                >
                  <MaterialCommunityIcons
                    name="sort"
                    size={21}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.sortText}>
                    {newestFirst ? 'الأحدث أولًا' : 'الأقدم أولًا'}
                  </Text>
                </Pressable>
              ) : null}
              <Text
                accessibilityLiveRegion="polite"
                style={styles.resultsLabel}
              >
                عرض {rows.length.toLocaleString('ar-EG')}{' '}
                {activeTab === 'requests'
                  ? 'طلبات معلقة'
                  : activeTab === 'claims'
                    ? 'طلبات نقل ملكية'
                    : activeTab === 'reports'
                      ? 'بلاغات مفتوحة'
                      : activeTab === 'archive'
                        ? 'خدمات في الأرشيف'
                        : 'خدمات منشورة'}
              </Text>
            </View>
          </View>
        }
        refreshing={privateRefreshing}
        onRefresh={refresh}
        key={activeTab}
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title={
              activeTab === 'requests'
                ? 'مفيش طلبات مستنية المراجعة.'
                : activeTab === 'claims'
                  ? 'مفيش طلبات نقل ملكية مستنية المراجعة.'
                  : activeTab === 'reports'
                    ? 'مفيش بلاغات مفتوحة.'
                    : query.trim()
                      ? 'مفيش خدمات مطابقة للبحث.'
                      : activeTab === 'archive'
                        ? 'مفيش خدمات في الأرشيف'
                        : 'لسه مفيش خدمات منشورة'
            }
            message={
              (activeTab === 'services' || activeTab === 'archive') &&
              query.trim()
                ? 'جرّب اسم تاني أو امسح البحث.'
                : 'اسحب لتحديث القائمة. الطلبات الجديدة هتظهر هنا بعد إرسالها.'
            }
            actionLabel={
              (activeTab === 'services' || activeTab === 'archive') &&
              query.trim()
                ? 'مسح البحث'
                : undefined
            }
            onAction={
              (activeTab === 'services' || activeTab === 'archive') &&
              query.trim()
                ? () => setQuery('')
                : undefined
            }
          />
        }
      />
    </AdminPage>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    listContent: {
      padding: 16,
      paddingBottom: 32,
      flexGrow: 1,
      maxWidth: 840,
      width: '100%',
      alignSelf: 'center',
    },
    top: { gap: 14, paddingBottom: 16 },
    listToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      gap: 6,
    },
    sortText: {
      ...typography.label,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    resultsLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },
    createBadge: {
      backgroundColor: colors.publishedBackground,
      color: colors.success,
    },
    updateBadge: {
      backgroundColor: colors.pendingBackground,
      color: colors.warning,
    },
    serviceTitle: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    demo: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    filterGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    activeChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    alertChip: {
      borderColor: colors.error,
    },
    chipLabel: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    activeChipLabel: {
      color: colors.onPrimary,
    },
    chipCountPill: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeCountPill: {
      backgroundColor: colors.surface,
    },
    populatedCountPill: {
      backgroundColor: colors.surfaceContainer,
    },
    alertCountPill: {
      backgroundColor: colors.errorContainer,
    },
    chipCountText: {
      ...typography.caption,
      color: colors.muted,
    },
    activeCountText: {
      color: colors.primaryDark,
    },
    grow: { flex: 1, minWidth: 0 },
    requestHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    requestFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    date: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
  });
