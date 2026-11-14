import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { ProviderAction, useProviderStyles } from '../provider/ProviderPage';
import { LoadingState } from '../../components/ui/LoadingState';

export type DirectoryPaging = {
  hasMore?: boolean;
  fetching?: boolean;
  error?: unknown;
  loadMore?: () => Promise<unknown>;
};
// Fetch subsequent pages only while search is active. A failed page pauses the
// scan until explicit retry; clearing search stops scheduling additional pages.
export function useDirectorySearch(
  query: string,
  { hasMore, fetching, error, loadMore }: DirectoryPaging,
) {
  const focused = useIsFocused();
  const active = focused && Boolean(query.trim());
  useEffect(() => {
    if (active && hasMore && !fetching && !error && loadMore)
      void loadMore().catch(() => {});
  }, [active, hasMore, fetching, error, loadMore]);
}
export function DirectoryPagination({
  loaded,
  total,
  matches,
  searching = false,
  totalLabel = 'إجمالي الدليل',
  hasMore,
  fetching,
  error,
  loadMore,
}: DirectoryPaging & {
  loaded: number;
  total?: number;
  matches?: number;
  searching?: boolean;
  totalLabel?: string;
}) {
  const s = useProviderStyles();
  const partial = Boolean(hasMore || error);
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {`تم تحميل ${loaded.toLocaleString('ar-EG')} خدمة · ${total === undefined ? `${totalLabel} غير متاح حاليًا` : `${totalLabel} ${total.toLocaleString('ar-EG')}`}`}
      </Text>
      {searching ? (
        <Text
          accessibilityLiveRegion="polite"
          style={s.body}
        >{`${(matches ?? 0).toLocaleString('ar-EG')} خدمة مطابقة ${partial ? 'في البيانات المحملة — البحث لم يكتمل بعد' : 'في الدليل بالكامل'}`}</Text>
      ) : null}
      {fetching && hasMore ? (
        <LoadingState
          compact
          label={searching ? 'بنبحث في باقي الدليل…' : 'بنحمّل خدمات أكتر…'}
        />
      ) : null}
      {error && partial ? (
        <Text accessibilityRole="alert" style={s.body}>
          تعذر تحميل باقي الدليل. النتائج الحالية غير مكتملة.
        </Text>
      ) : null}
      {hasMore && loadMore ? (
        <ProviderAction
          title={error ? 'إعادة محاولة تحميل باقي الخدمات' : 'تحميل خدمات أكتر'}
          disabled={Boolean(fetching)}
          onPress={() => {
            void loadMore().catch(() => {});
          }}
        />
      ) : null}
    </View>
  );
}
