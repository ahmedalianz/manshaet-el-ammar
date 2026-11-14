import { useLocalDirectory } from '../local/LocalDirectory';
import { confirmProviderDetails } from './confirmation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { auth as firebaseAuth } from '../../lib/firebase/auth';
import { db } from '../../lib/firebase/firestore';
import {
  fetchCategories,
  fetchPublicProviders,
  fetchProviderTotal,
  type ProviderCursor,
  fetchMyProviders,
  fetchMyRequests,
  submitRequest,
  updateProfile,
  fetchProfile,
} from './firebaseRepository';
import type {
  ProviderListing,
  MockAccount,
  ServiceValues,
  ServiceRequest,
  PublishedService,
  ServiceReport,
} from './types';
import type { ServiceCategory, ServiceProvider } from '../discovery/types';
import {
  fetchModeration,
  reviewRequest,
  unpublishProvider,
  restoreProvider,
  deleteProvider,
  resolveReport,
} from './firebaseAdminRepository';
import { firebaseMessage } from '../auth/errors';

type State = {
  userId: string | null;
  role: 'guest' | 'provider' | 'admin';
  account?: MockAccount;
  initializing: boolean;
  configured: boolean;
  moderationEnabled: boolean;
  adminLoading: boolean;
  adminError: string | null;
  adminBusy: boolean;
  categories: ServiceCategory[];
  listings: ProviderListing[];
  publicProviders: ServiceProvider[];
  publicHasMore: boolean;
  publicFetchingMore: boolean;
  publicFetching: boolean;
  publicTotal: number | undefined;
  loadMorePublicProviders: () => Promise<unknown>;
  services: PublishedService[];
  requests: ServiceRequest[];
  reports: ServiceReport[];
  pendingRequests: ServiceRequest[];
  publicLoading: boolean;
  categoriesLoading: boolean;
  publicError: string | null;
  privateRefreshing: boolean;
  privateLoading: boolean;
  privateError: string | null;
  refresh: () => void;
  refreshMyServices: () => Promise<void>;
  signOut: () => Promise<void>;
  submit: (
    values: ServiceValues,
    id?: string,
    replacePending?: boolean,
    consent?: boolean,
    submissionId?: string,
  ) => Promise<string>;
  allocateSubmissionId: () => string;
  updateAccountName: (name: string) => Promise<void>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string, reason: string) => Promise<void>;
  unpublishService: (id: string, reason: string) => Promise<void>;
  restoreService: (id: string) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  closeReport: (id: string) => Promise<void>;
  confirmDetails: (id: string, revision: string) => Promise<void>;
};
const Context = createContext<State | null>(null);
function ownerListings(
  providers: ProviderListing[],
  requests: ServiceRequest[],
): ProviderListing[] {
  const ids = new Set([
    ...providers.map((item) => item.id),
    ...requests.map((item) => item.providerId),
  ]);
  return [...ids].flatMap<ProviderListing>((id) => {
    const published = providers.find((item) => item.id === id);
    const history = requests
      .filter((item) => item.providerId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = history.at(-1);
    const pending = history.find((item) => item.status === 'pending');
    if (published?.publicationStatus === 'unpublished')
      return [
        {
          ...published,
          ...(latest?.type === 'restore' ? latest.proposedData : {}),
          status: pending
            ? 'pending'
            : latest?.type === 'restore' && latest.status === 'rejected'
              ? 'rejected'
              : 'approved',
          rejectionReason:
            latest?.type === 'restore' && latest.status === 'rejected'
              ? latest.rejectionReason
              : undefined,
        },
      ];
    if (published)
      return [
        {
          ...published,
          pendingChanges: pending?.proposedData,
          editRejectionReason:
            latest?.status === 'rejected' && latest.type === 'update'
              ? latest.rejectionReason
              : undefined,
        },
      ];
    if (!latest) return [];
    // An approved historical request without a current public document is not public.
    return [
      {
        ...latest.proposedData,
        id,
        ownerId: latest.ownerId,
        status: latest.status === 'approved' ? 'approved' : latest.status,
        publicationStatus:
          latest.status === 'approved' ? 'unpublished' : undefined,
        rejectionReason: latest.rejectionReason,
      },
    ];
  });
}
export function ProviderStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const local = useLocalDirectory();
  const cachedProviders = local.getCachedProviders();
  const cachedCategories = local.getCachedCategories();
  const uid = auth.user?.uid ?? null;
  const client = useQueryClient();
  const [adminBusy, setAdminBusy] = useState(false);
  const adminLock = useRef(false);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current !== uid) {
      const prior = previous.current;
      if (prior) {
        void client.cancelQueries({ queryKey: ['private', prior] });
        client.removeQueries({ queryKey: ['private', prior] });
      }
      previous.current = uid;
    }
  }, [uid, client]);
  const publicQuery = useInfiniteQuery({
    queryKey: ['public', 'providers', 'pages'],
    initialPageParam: undefined as ProviderCursor,
    queryFn: ({ pageParam }) => fetchPublicProviders(db!, pageParam),
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.items.some((item) => item.cachedAt),
      )
        ? 30_000
        : false,
    enabled: Boolean(db),
    staleTime: 5 * 60_000,
  });
  const publicCount = useQuery({
    queryKey: ['public', 'provider-total'],
    queryFn: () => fetchProviderTotal(db!),
    enabled: Boolean(db),
    staleTime: 60_000,
  });
  const categoryQuery = useQuery({
    queryKey: ['public', 'categories'],
    queryFn: () => fetchCategories(db!),
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.cachedAt) ? 30_000 : false,
    enabled: Boolean(db),
    staleTime: 30 * 60_000,
  });
  const ownerQuery = useQuery({
    queryKey: ['private', uid, 'providers'],
    queryFn: () => fetchMyProviders(db!, uid!),
    enabled: Boolean(db && uid && !auth.initializing),
  });
  const requestQuery = useQuery({
    queryKey: ['private', uid, 'requests'],
    queryFn: () => fetchMyRequests(db!, uid!),
    enabled: Boolean(db && uid && !auth.initializing),
  });
  const profileQuery = useQuery({
    queryKey: ['private', uid, 'profile'],
    queryFn: () => fetchProfile(db!, uid!),
    enabled: Boolean(db && uid && !auth.initializing),
  });
  const isAdmin = Boolean(uid && auth.isAdmin && !auth.initializing);
  const adminQuery = useQuery({
    queryKey: ['private', uid, 'moderation'],
    queryFn: () => fetchModeration(db!),
    enabled: Boolean(db && isAdmin),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (uid && !isAdmin) {
      void client.cancelQueries({ queryKey: ['private', uid, 'moderation'] });
      client.removeQueries({ queryKey: ['private', uid, 'moderation'] });
    }
  }, [uid, isAdmin, client]);
  const requireSession = () => {
    if (!db || !uid || auth.initializing)
      throw new Error('سجّل الدخول قبل إدارة خدماتك.');
    if (firebaseAuth?.currentUser?.uid !== uid)
      throw new Error('الجلسة اتغيرت. سجّل الدخول من جديد.');
    return { database: db, uid };
  };
  const refreshMyServices = useCallback(async () => {
    if (!uid || auth.initializing) return;
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['private', uid, 'providers'],
        exact: true,
      }),
      client.invalidateQueries({
        queryKey: ['private', uid, 'requests'],
        exact: true,
      }),
    ]);
  }, [uid, auth.initializing, client]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['public'] });
    if (uid) void client.invalidateQueries({ queryKey: ['private', uid] });
  };
  const moderate = async (
    operation: (database: NonNullable<typeof db>, uid: string) => Promise<void>,
  ) => {
    const session = requireSession();
    if (!isAdmin) throw new Error('الخطوة دي متاحة لمشرف الدليل بس.');
    if (adminLock.current)
      throw new Error('استنى الخطوة اللي شغالة تخلص الأول.');
    adminLock.current = true;
    setAdminBusy(true);
    try {
      await operation(session.database, session.uid);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['private', session.uid] }),
        client.invalidateQueries({ queryKey: ['public'] }),
      ]);
    } catch (error) {
      throw new Error(firebaseMessage(error));
    } finally {
      adminLock.current = false;
      setAdminBusy(false);
    }
  };
  const submit: State['submit'] = async (
    values,
    id,
    _replace,
    consent = false,
    submissionId,
  ) => {
    try {
      const session = requireSession();
      const result = await submitRequest(
        session.database,
        session.uid,
        values,
        id,
        submissionId,
        consent,
      );
      await client.invalidateQueries({ queryKey: ['private', session.uid] });
      return result;
    } catch (error) {
      throw new Error(firebaseMessage(error));
    }
  };
  const requests = uid && !auth.initializing ? (requestQuery.data ?? []) : [];
  const published = uid && !auth.initializing ? (ownerQuery.data ?? []) : [];
  const account =
    uid && !auth.initializing
      ? {
          id: uid,
          name: profileQuery.data?.name ?? auth.user?.displayName ?? 'حسابي',
          email: auth.user?.email ?? '',
          role: auth.isAdmin ? ('admin' as const) : ('provider' as const),
        }
      : undefined;
  return (
    <Context.Provider
      value={{
        userId: uid,
        role: account?.role ?? 'guest',
        account,
        initializing: auth.initializing,
        configured: auth.configured,
        moderationEnabled: isAdmin,
        adminLoading: Boolean(isAdmin && adminQuery.isPending),
        adminError:
          isAdmin && adminQuery.error
            ? firebaseMessage(adminQuery.error)
            : null,
        adminBusy,
        categories: categoryQuery.data ?? cachedCategories,
        listings: ownerListings(published, requests),
        publicProviders: [
          ...new Map(
            (
              publicQuery.data?.pages.flatMap((page) => page.items) ??
              cachedProviders
            ).map((item) => [item.id, item]),
          ).values(),
        ].filter((item) => !local.unavailableIds.includes(item.id)),
        publicHasMore: publicQuery.hasNextPage,
        publicFetchingMore: publicQuery.isFetchingNextPage,
        publicFetching: publicQuery.isFetching,
        publicTotal: publicCount.data,
        loadMorePublicProviders: () =>
          publicQuery.fetchNextPage({ cancelRefetch: false }),
        services: isAdmin ? (adminQuery.data?.services ?? []) : [],
        requests: isAdmin ? (adminQuery.data?.requests ?? []) : requests,
        reports: isAdmin ? (adminQuery.data?.reports ?? []) : [],
        pendingRequests: isAdmin
          ? (adminQuery.data?.requests ?? [])
          : requests.filter((item) => item.status === 'pending'),
        categoriesLoading:
          Boolean(db) && categoryQuery.isPending && !cachedCategories.length,
        publicLoading:
          Boolean(db) &&
          (publicQuery.isPending || categoryQuery.isPending) &&
          !(cachedCategories.length && cachedProviders.length),
        publicError:
          publicQuery.error || categoryQuery.error
            ? firebaseMessage(publicQuery.error ?? categoryQuery.error)
            : null,
        privateRefreshing:
          ownerQuery.isFetching ||
          requestQuery.isFetching ||
          (isAdmin && adminQuery.isFetching),
        privateLoading:
          Boolean(uid) &&
          (ownerQuery.isPending ||
            requestQuery.isPending ||
            profileQuery.isPending),
        privateError:
          ownerQuery.error || requestQuery.error || profileQuery.error
            ? firebaseMessage(
                ownerQuery.error ?? requestQuery.error ?? profileQuery.error,
              )
            : null,
        refresh,
        refreshMyServices,
        signOut: auth.signOut,
        confirmDetails: async (id, revision) => {
          const session = requireSession();
          try {
            await confirmProviderDetails(
              session.database,
              session.uid,
              id,
              revision,
            );
            await Promise.all([
              client.invalidateQueries({ queryKey: ['private', session.uid] }),
              client.invalidateQueries({ queryKey: ['public'] }),
            ]);
          } catch (error) {
            throw new Error(firebaseMessage(error));
          }
        },
        submit,
        allocateSubmissionId: () =>
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`,
        updateAccountName: async (name) => {
          try {
            const s = requireSession();
            await updateProfile(s.database, s.uid, name);
            await client.invalidateQueries({
              queryKey: ['private', s.uid, 'profile'],
            });
          } catch (error) {
            throw new Error(firebaseMessage(error));
          }
        },
        approveRequest: (id) =>
          moderate((db, uid) => reviewRequest(db, uid, id, 'approved')),
        rejectRequest: (id, reason) =>
          moderate((db, uid) => reviewRequest(db, uid, id, 'rejected', reason)),
        unpublishService: (id, reason) =>
          moderate(async (db, uid) => {
            await unpublishProvider(db, uid, id, reason);
            local.markUnavailable(id);
          }),
        restoreService: (id) =>
          moderate((db, uid) => restoreProvider(db, uid, id)),
        deleteService: (id) =>
          moderate(async (db) => {
            await deleteProvider(db, id);
            local.markUnavailable(id);
          }),
        closeReport: (id) => moderate((db, uid) => resolveReport(db, uid, id)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProviderState() {
  const state = useContext(Context);
  if (!state) throw new Error('ProviderStateProvider is required');
  return state;
}
