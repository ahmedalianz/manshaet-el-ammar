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
  signIn: (profile: DemoProfile) => void;
  signOut: () => void;
  submit: (
    values: ServiceValues,
    id?: string,
    replacePending?: boolean,
  ) => Promise<string>;
  approveRequest: (id: string) => void;
  rejectRequest: (id: string, reason: string) => void;
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
        signIn: (profile) => {
          if (__DEV__) changeSession(`demo-${profile}`);
        },
        signOut: () => changeSession(null),
        submit,
        approveRequest: (id) => {
          run({ type: 'approve', requestId: id });
        },
        rejectRequest: (id, reason) => {
          run({ type: 'reject', requestId: id, reason });
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
