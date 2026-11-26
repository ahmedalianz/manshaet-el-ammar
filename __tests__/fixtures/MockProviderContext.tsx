import { categories } from '../../src/features/discovery/data/categories';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  DemoProfile,
  MockAccount,
  MockOperation,
  MockState,
  ProviderListing,
  PublishedService,
  ServiceClaim,
  ServiceReport,
  ServiceRequest,
  ServiceValues,
} from '../../src/features/provider/types';
import {
  applyOperation,
  getMyServices,
  getPublicProviders,
  initialMockState,
} from './moderation';

type ProviderState = {
  configured: boolean;
  initializing: boolean;
  privateLoading: boolean;
  privateError: string | null;
  categories: typeof categories;
  userId: string | null;
  role: 'guest' | 'provider' | 'admin';
  account?: MockAccount;
  listings: ProviderListing[];
  publicProviders: ReturnType<typeof getPublicProviders>;
  services: PublishedService[];
  requests: ServiceRequest[];
  reports: ServiceReport[];
  pendingRequests: ServiceRequest[];
  claims: ServiceClaim[];
  pendingClaims: ServiceClaim[];
  signIn: (profile: DemoProfile) => void;
  signOut: () => void;
  submit: (
    values: ServiceValues,
    id?: string,
    replacePending?: boolean,
  ) => Promise<string>;
  saveAdminService: (
    values: ServiceValues,
    id?: string,
    submissionId?: string,
  ) => Promise<string>;
  approveRequest: (id: string) => void;
  rejectRequest: (id: string, reason: string) => void;
  submitClaim: (input: {
    providerId: string;
    claimantName: string;
    claimantPhone: string;
    note?: string;
    consent: boolean;
  }) => Promise<string>;
  approveClaim: (id: string) => Promise<void>;
  rejectClaim: (id: string, reason: string) => Promise<void>;
  setServiceClaimable: (id: string, claimable: boolean) => Promise<void>;
  syncClaimableServices: (ids: string[]) => Promise<{
    updated: number;
    failed: number;
    lastError: string | null;
  }>;
  unpublishService: (id: string, reason?: string) => void;
  closeReport: (id: string) => void;
  updateAccountName: (name: string) => void;
};
const Context = createContext<ProviderState | null>(null);
export function ProviderStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>(initialMockState);
  const stateRef = useRef(state);
  const [userId, setUserId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const sequence = useRef(0);
  const account = state.accounts.find((item) => item.id === userId);
  const changeSession = (id: string | null) => {
    sessionRef.current = id;
    setUserId(id);
  };
  const run = (operation: MockOperation) => {
    if (!__DEV__)
      throw new Error('العمليات التجريبية متاحة في بيئة التطوير فقط.');
    const current = stateRef.current;
    const actor =
      current.accounts.find((item) => item.id === sessionRef.current) ?? null;
    const next = applyOperation(current, actor, operation, {
      now: () => new Date().toISOString(),
      id: () => `local-${++sequence.current}`,
    });
    stateRef.current = next;
    setState(next);
    return next;
  };
  const submit = async (
    values: ServiceValues,
    id?: string,
    replacePending = false,
  ) => {
    const next = run({
      type: 'submit',
      values,
      providerId: id,
      replacePending,
    });
    return id ?? next.requests.at(-1)!.providerId;
  };
  const saveAdminService = async (values: ServiceValues, id?: string) => {
    const next = run({
      type: 'adminSave',
      values,
      providerId: id,
    });
    return id ?? next.services.at(-1)!.id;
  };
  return (
    <Context.Provider
      value={{
        configured: true,
        initializing: false,
        privateLoading: false,
        privateError: null,
        categories,
        userId,
        role: account?.role ?? 'guest',
        account,
        listings: userId ? getMyServices(state, userId) : [],
        publicProviders: getPublicProviders(state),
        services:
          account?.role === 'admin'
            ? state.services
            : state.services.filter((service) => service.ownerId === userId),
        requests:
          account?.role === 'admin'
            ? state.requests
            : state.requests.filter((request) => request.ownerId === userId),
        reports: account?.role === 'admin' ? state.reports : [],
        pendingRequests: state.requests
          .filter(
            (request) =>
              account?.role === 'admin' && request.status === 'pending',
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        claims: (state.claims ?? []).filter(
          (claim) => account?.role === 'admin' || claim.claimantId === userId,
        ),
        pendingClaims: (state.claims ?? [])
          .filter(
            (claim) => account?.role === 'admin' && claim.status === 'pending',
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        signIn: (profile) => {
          if (__DEV__) changeSession(`demo-${profile}`);
        },
        signOut: () => changeSession(null),
        submit,
        saveAdminService,
        approveRequest: (id) => {
          run({ type: 'approve', requestId: id });
        },
        rejectRequest: (id, reason) => {
          run({ type: 'reject', requestId: id, reason });
        },
        submitClaim: async (input) => {
          if (!input.consent)
            throw new Error('لازم تأكّد إن الخدمة تخصّك قبل إرسال الطلب.');
          const next = run({
            type: 'submitClaim',
            providerId: input.providerId,
            claimantName: input.claimantName,
            claimantPhone: input.claimantPhone,
            note: input.note,
          });
          return (
            next.claims?.find(
              (item) =>
                item.providerId === input.providerId &&
                item.claimantId === sessionRef.current,
            )?.id ?? ''
          );
        },
        approveClaim: async (id) => {
          run({ type: 'approveClaim', claimId: id });
        },
        rejectClaim: async (id, reason) => {
          run({ type: 'rejectClaim', claimId: id, reason });
        },
        setServiceClaimable: async (id, claimable) => {
          if (account?.role !== 'admin')
            throw new Error('العملية متاحة للمشرف التجريبي فقط.');
          const next: MockState = {
            ...stateRef.current,
            services: stateRef.current.services.map((item) =>
              item.id === id ? { ...item, claimable } : item,
            ),
          };
          stateRef.current = next;
          setState(next);
        },
        syncClaimableServices: async (ids) => {
          if (account?.role !== 'admin')
            throw new Error('العملية متاحة للمشرف التجريبي فقط.');
          let updated = 0;
          const next: MockState = {
            ...stateRef.current,
            services: stateRef.current.services.map((item) => {
              if (ids.includes(item.id) && !item.claimable) {
                updated += 1;
                return { ...item, claimable: true };
              }
              return item;
            }),
          };
          stateRef.current = next;
          setState(next);
          return { updated, failed: 0, lastError: null };
        },
        unpublishService: (id) => {
          run({ type: 'unpublish', providerId: id });
        },
        closeReport: (id) => {
          run({ type: 'closeReport', reportId: id });
        },
        updateAccountName: (name) => {
          run({ type: 'updateAccount', name });
        },
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
