import { MotionPressable as Pressable } from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { useProviderStyles } from '../../features/provider/ProviderPage';
import { useProviderState } from '../../features/provider/ProviderContext';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import type {
  PublishedService,
  ServiceReport,
  ServiceRequest,
} from '../../features/provider/types';

type AdminTab = 'requests' | 'services' | 'reports' | 'archive';
type DashboardRow =
  | { key: string; kind: 'request'; request: ServiceRequest }
  | { key: string; kind: 'service'; service: PublishedService }
  | { key: string; kind: 'report'; report: ServiceReport };
const tabs: { id: AdminTab; label: string; counter: string }[] = [
  { id: 'requests', label: 'طلبات المراجعة', counter: 'قيد المراجعة' },
  { id: 'services', label: 'الخدمات المنشورة', counter: 'خدمات منشورة' },
  { id: 'archive', label: 'الأرشيف', counter: 'غير منشورة' },
  { id: 'reports', label: 'البلاغات', counter: 'بلاغات مفتوحة' },
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
  const { services, reports, pendingRequests, refresh, privateRefreshing } =
    useProviderState();
  const [activeTab, setActiveTab] = useState<AdminTab>('requests');
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const pending = [...pendingRequests].sort((a, b) =>
    newestFirst
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  );
  const published = services.filter(
    (service) => service.publicationStatus === 'published',
  );
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
            <View style={styles.counters}>
              {tabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityLabel={`عرض ${tab.label}`}
                  accessibilityState={{ selected: activeTab === tab.id }}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.counter,
                    {
                      borderColor:
                        activeTab === tab.id ? colors.primary : colors.border,
                      borderWidth: activeTab === tab.id ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.count,
                      tab.id === 'reports' && { color: colors.error },
                    ]}
                  >
                    {counts[tab.id]}
                  </Text>
                  <Text style={styles.counterLabel}>{tab.counter}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.demo}>
              راجع الطلبات وتابع الخدمات والبلاغات. اسحب القائمة لتحديثها.
            </Text>
            <View accessibilityRole="tablist" style={styles.tabs}>
              {tabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: activeTab === tab.id }}
                  onPress={() => setActiveTab(tab.id)}
                  style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.id && styles.activeText,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <Text style={styles.tabBadge}>{counts[tab.id]}</Text>
                </Pressable>
              ))}
            </View>
            {activeTab === 'services' || activeTab === 'archive' ? (
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث باسم الخدمة أو صاحبها..."
              />
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
    counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    counter: {
      flexGrow: 1,
      flexBasis: '45%',
      minWidth: 0,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      minHeight: 88,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    count: { ...typography.screenTitle, color: colors.primaryDark },
    counterLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    demo: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: 4,
    },
    tab: {
      flexGrow: 1,
      flexBasis: '40%',
      minHeight: 48,
      paddingVertical: 10,
      paddingHorizontal: 4,
      justifyContent: 'center',
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    activeTab: { backgroundColor: colors.surface },
    tabText: {
      ...typography.caption,
      textAlign: 'center',
      writingDirection: 'rtl',
      color: colors.muted,
    },
    activeText: {
      color: colors.primaryDark,
      fontFamily: typography.label.fontFamily,
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
    tabBadge: {
      ...typography.caption,
      color: colors.primaryDark,
      backgroundColor: colors.surfaceLow,
      borderRadius: 8,
      paddingHorizontal: 6,
    },
    date: {
      ...typography.caption,
      color: colors.muted,
      writingDirection: 'rtl',
    },
  });
