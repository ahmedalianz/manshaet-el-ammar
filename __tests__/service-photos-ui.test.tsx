import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from './helpers/render';
import { providers as fixtureProviders } from './fixtures/providers';
import type {
  ProviderListing,
  PublishedService,
  ServiceRequest,
} from '../src/features/provider/types';
import type {
  ServiceCategory,
  ServiceProvider,
} from '../src/features/discovery/types';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import type { PhotoDraft } from '../src/features/photos/api';
import { PhotoField } from '../src/features/photos/PhotoField';
import {
  PhotoViewportProvider,
  usePhotoViewport,
} from '../src/features/photos/PhotoViewport';
import { ProviderCard } from '../src/features/discovery/components/ProviderCard';
import * as ProviderContextModule from '../src/features/provider/ProviderContext';
import * as AdminRepoModule from '../src/features/provider/firebaseAdminRepository';
import { MyServiceCard } from '../src/features/provider/MyServiceCard';
import { ServiceForm } from '../src/features/provider/ServiceForm';
import {
  AdminPhotoReview,
  RecoverServicePhotoAction,
} from '../src/features/admin/AdminPhotoReview';
import ProviderDetailsScreen from '../src/app/provider/[id]';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockGetIdToken = jest.fn(async () => 'test-token');
const mockLaunchLibrary = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockManipulate = jest.fn();
const mockCopyFile = jest.fn();
const mockDeleteFile = jest.fn();
const mockExistingUris = new Set<string>();
const mockFileSizes = new Map<string, number>();

const mockPublicProviderResult = {
  data: null as ServiceProvider | null | undefined,
  isPending: false,
  error: null as Error | null,
  refetch: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  usePreventRemove: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: 'p-detail-1' })),
  useFocusEffect: (callback: () => void | (() => void)) => {
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

jest.mock('expo-image', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View: ViewActual } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: ({
      source,
      cachePolicy,
      placeholder,
      accessibilityLabel,
      onError,
      accessible,
      ...rest
    }: {
      source?: unknown;
      cachePolicy?: unknown;
      placeholder?: unknown;
      accessibilityLabel?: string;
      onError?: unknown;
      accessible?: boolean;
      [key: string]: unknown;
    }) =>
      ReactActual.createElement(ViewActual, {
        testID: 'expo-image',
        source,
        cachePolicy,
        placeholder,
        accessibilityLabel,
        onError,
        accessible,
        ...rest,
      } as React.ComponentProps<typeof ViewActual>),
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
}));

jest.mock('expo-file-system', () => {
  const joinMockUri = (parts: (string | { uri: string })[]) =>
    parts
      .map((part, idx) => {
        const s = typeof part === 'string' ? part : part.uri;
        return idx === 0 ? s.replace(/\/+$/, '') : s.replace(/^\/+|\/+$/g, '');
      })
      .join('/');

  class MockDirectory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = joinMockUri(parts);
    }
    get exists() {
      return true;
    }
    create() {}
    list() {
      return [];
    }
  }
  class MockFile {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = joinMockUri(parts);
    }
    get exists() {
      return mockExistingUris.has(this.uri);
    }
    get size() {
      return mockFileSizes.get(this.uri) ?? 220_000;
    }
    async copy(dest: { uri: string }) {
      const initialSize = this.size;
      await Promise.resolve();
      if (!this.exists) {
        throw new Error(`The file "${this.uri}" doesn't exist.`);
      }
      mockCopyFile(this.uri, dest.uri);
      mockExistingUris.add(dest.uri);
      mockFileSizes.set(dest.uri, initialSize);
    }
    delete() {
      mockDeleteFile(this.uri);
      mockExistingUris.delete(this.uri);
    }
  }
  return {
    Paths: {
      document: 'file:///documents',
      cache: 'file:///cache',
    },
    Directory: MockDirectory,
    File: MockFile,
  };
});

jest.mock('../src/lib/firebase/auth', () => ({
  auth: {
    currentUser: {
      uid: 'owner-1',
      getIdToken: () => mockGetIdToken(),
    },
  },
}));

jest.mock('@firebase/auth', () => {
  const actual =
    jest.requireActual<typeof import('@firebase/auth')>('@firebase/auth');
  return {
    ...actual,
    onIdTokenChanged: (
      authObj: { currentUser?: unknown } | null,
      listener: (user: unknown) => void,
    ) => {
      listener(authObj?.currentUser ?? null);
      return jest.fn();
    },
  };
});

jest.mock('firebase/auth', () => {
  const actual =
    jest.requireActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    onIdTokenChanged: (
      authObj: { currentUser?: unknown } | null,
      listener: (user: unknown) => void,
    ) => {
      listener(authObj?.currentUser ?? null);
      return jest.fn();
    },
  };
});

jest.mock('../src/lib/firebase/firestore', () => ({
  db: {},
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { Text: TextActual } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Icon = ({ name, testID }: { name: string; testID?: string }) =>
    ReactActual.createElement(
      TextActual,
      { testID: testID ?? `icon-${name}` },
      name,
    );
  return {
    MaterialCommunityIcons: Icon,
    Ionicons: Icon,
  };
});

jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => mockPublicProviderResult,
}));

jest.mock('../src/features/local/FavoriteButton', () => ({
  FavoriteButton: () => null,
}));

const { ownerListings } = ProviderContextModule;

interface MockXhrInstance {
  method: string;
  url: string;
  headers: Record<string, string>;
  status: number;
  responseText: string;
  upload: {
    onprogress?: (event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void;
  };
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open: jest.Mock<(method: string, url: string) => void>;
  setRequestHeader: jest.Mock<(key: string, val: string) => void>;
  send: jest.Mock<() => void>;
  abort: jest.Mock<() => void>;
}

const mockXhrInstances: MockXhrInstance[] = [];
const originalFetch = global.fetch;
const originalXhr = global.XMLHttpRequest;
const previousPhotoApiUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;

const baseCategory: ServiceCategory = {
  id: 'plumbing',
  name: 'سباكة',
  description: 'أعمال السباكة المنزلية',
  icon: 'pipe-wrench',
  group: 'trades',
  keywords: ['سباك'],
};

function makeApprovedPhoto() {
  return {
    version: 'v1',
    thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/thumb.jpg',
    detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/detail.jpg',
    width: 1280,
    height: 960,
  };
}

function makeListing(
  overrides: Partial<ProviderListing> = {},
): ProviderListing {
  return {
    id: 'p1',
    ownerId: 'owner-1',
    name: 'أحمد السباك',
    categoryId: 'plumbing',
    serviceTitle: 'سباك صحي محترف',
    description: 'خدمة منزلية سريعة ومضمونة.',
    phone: '01012345678',
    address: 'منشأة العمار - شارع المدرسة',
    serviceMode: 'fixed',
    status: 'approved',
    ...overrides,
  };
}

function createProviderStateValue(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof ProviderContextModule.useProviderState> {
  return {
    userId: 'owner-1',
    role: 'provider',
    authMethod: 'email',
    initializing: false,
    configured: true,
    moderationEnabled: false,
    categories: [baseCategory],
    categoriesLoading: false,
    listings: [],
    publicProviders: [],
    publicHasMore: false,
    publicFetchingMore: false,
    publicFetching: false,
    publicTotal: undefined,
    loadMorePublicProviders: jest.fn(async () => undefined),
    services: [],
    requests: [],
    reports: [],
    pendingRequests: [],
    publicLoading: false,
    publicError: null,
    privateRefreshing: false,
    privateLoading: false,
    privateError: null,
    adminLoading: false,
    adminError: null,
    adminBusy: false,
    submit: jest.fn(async () => 'r-submitted'),
    allocateSubmissionId: jest.fn(() => 'p-reserved-1'),
    refresh: jest.fn(),
    refreshMyServices: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
    ...overrides,
  } as unknown as ReturnType<typeof ProviderContextModule.useProviderState>;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://photos.example.workers.dev';
  mockPush.mockReset();
  mockReplace.mockReset();
  mockGetIdToken.mockResolvedValue('test-token');
  mockLaunchLibrary.mockReset();
  mockManipulate.mockReset();
  mockCopyFile.mockReset();
  mockDeleteFile.mockReset();
  mockExistingUris.clear();
  mockFileSizes.clear();
  mockXhrInstances.length = 0;
  mockPublicProviderResult.data = null;
  mockPublicProviderResult.isPending = false;
  mockPublicProviderResult.error = null;

  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('file://')) {
      return {
        ok: true,
        status: 200,
        blob: async () => ({ size: 220_000 }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidateId: 'cand-1', serviceId: 'p1' }),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  global.XMLHttpRequest = jest.fn(() => {
    const instance: MockXhrInstance = {
      method: '',
      url: '',
      headers: {},
      status: 200,
      responseText: JSON.stringify({
        candidateId: 'cand-1',
        width: 960,
        height: 720,
        bytes: 220_000,
      }),
      upload: {},
      open: jest.fn((method: string, url: string) => {
        instance.method = method;
        instance.url = url;
      }),
      setRequestHeader: jest.fn((key: string, val: string) => {
        instance.headers[key] = val;
      }),
      send: jest.fn(),
      abort: jest.fn(() => {
        instance.onabort?.();
      }),
    };
    mockXhrInstances.push(instance);
    return instance as unknown as XMLHttpRequest;
  }) as unknown as typeof XMLHttpRequest;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXhr;
  if (previousPhotoApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
  } else {
    process.env.EXPO_PUBLIC_PHOTO_API_URL = previousPhotoApiUrl;
  }
});

describe('service photos UI & state', () => {
  it('clears stale photoReviewStatus in ownerListings when a newer request has no photo change', () => {
    const provider = makeListing({ placePhoto: makeApprovedPhoto() });
    const olderRejectedRequest: ServiceRequest = {
      id: 'r-old',
      ownerId: 'owner-1',
      providerId: 'p1',
      type: 'update',
      status: 'rejected',
      proposedData: {
        name: provider.name,
        categoryId: provider.categoryId,
        serviceTitle: provider.serviceTitle,
        description: provider.description,
        phone: provider.phone,
        address: provider.address,
      },
      photoChange: { action: 'replace', candidateId: 'cand-old' },
      photoReviewStatus: 'rejected',
      photoReviewReason: 'الصورة مش واضحة',
      createdAt: '2026-01-01T10:00:00.000Z',
      reviewedAt: '2026-01-01T11:00:00.000Z',
    };
    const newerTextRequest: ServiceRequest = {
      id: 'r-new',
      ownerId: 'owner-1',
      providerId: 'p1',
      type: 'update',
      status: 'pending',
      proposedData: {
        name: provider.name,
        categoryId: provider.categoryId,
        serviceTitle: 'سباك صحي - عنوان محدث',
        description: provider.description,
        phone: provider.phone,
        address: provider.address,
      },
      createdAt: '2026-01-02T10:00:00.000Z',
    };

    const result = ownerListings(
      [provider],
      [olderRejectedRequest, newerTextRequest],
    );

    expect(result).toHaveLength(1);
    expect(result[0].photoReviewStatus).toBeUndefined();
    expect(result[0].photoReviewReason).toBeUndefined();
    expect(result[0].photoCandidateId).toBeUndefined();
    expect(result[0].placePhoto).toEqual(provider.placePhoto);
  });

  it('picks gallery image even when Android returns width/height 0, downsizes, and saves durable draft', async () => {
    const mockContextRelease = jest.fn();
    const mockRenderRelease = jest.fn();
    const mockSaveAsync = jest.fn(async () => ({
      uri: 'file:///cache/processed.jpg',
      width: 960,
      height: 720,
    }));
    const mockResize = jest.fn();
    const mockContext = {
      resize: mockResize,
      renderAsync: jest.fn(async () => {
        mockExistingUris.add('file:///cache/processed.jpg');
        mockFileSizes.set('file:///cache/processed.jpg', 210_000);
        return {
          width: 960,
          height: 720,
          saveAsync: mockSaveAsync,
          release: mockRenderRelease,
        };
      }),
      release: mockContextRelease,
    };
    mockResize.mockReturnValue(mockContext);
    mockManipulate.mockReturnValue(mockContext);
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picker/raw.jpg', width: 0, height: 0 }],
    });

    const onChange = jest.fn(async (_value: PhotoDraft) => {});
    await render(
      <FeedbackProvider>
        <PhotoField
          value={{ action: 'keep' }}
          onChange={onChange}
          onCancel={jest.fn()}
        />
      </FeedbackProvider>,
    );

    await fireEvent.press(screen.getByText('اختيار صورة من المعرض'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        action: 'replace',
        localUri: expect.stringMatching(
          /^file:\/+documents\/service-photo-drafts\//,
        ),
      });
    });

    expect(mockLaunchLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
    expect(mockManipulate).toHaveBeenCalledWith('file:///picker/raw.jpg', {
      maxWidth: 1280,
      maxHeight: 1280,
    });
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockCopyFile).toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith('file:///cache/processed.jpg');
    expect(mockContextRelease).toHaveBeenCalled();
    expect(mockRenderRelease).toHaveBeenCalled();
  });

  it('tracks upload progress, supports cancel, and lets ServiceForm continue without photo even when offline DELETE rejects', async () => {
    const providerState = createProviderStateValue();
    jest
      .spyOn(ProviderContextModule, 'useProviderState')
      .mockReturnValue(providerState);

    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picker/place.jpg', width: 1600, height: 1200 }],
    });
    const mockContext = {
      resize: jest.fn(),
      renderAsync: jest.fn(async () => {
        mockExistingUris.add('file:///cache/out.jpg');
        mockFileSizes.set('file:///cache/out.jpg', 210_000);
        return {
          width: 1280,
          height: 960,
          saveAsync: jest.fn(async () => ({
            uri: 'file:///cache/out.jpg',
            width: 1280,
            height: 960,
          })),
          release: jest.fn(),
        };
      }),
      release: jest.fn(),
    };
    mockContext.resize.mockReturnValue(mockContext);
    mockManipulate.mockReturnValue(mockContext);

    const listing = makeListing();
    await render(
      <FeedbackProvider>
        <ServiceForm listing={listing} />
      </FeedbackProvider>,
    );

    await fireEvent.changeText(
      screen.getByDisplayValue('سباك صحي محترف'),
      'سباك صحي محترف ومعتمد',
    );

    await fireEvent.press(
      screen.getByLabelText('التالي: بيانات التواصل والمكان'),
    );

    await waitFor(() => {
      expect(screen.getByText('اختيار صورة من المعرض')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('اختيار صورة من المعرض'));

    await waitFor(() => {
      expect(screen.getByText('كمّل من غير صورة جديدة')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('مراجعة البيانات'));

    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.press(checkboxes[checkboxes.length - 1]);

    await fireEvent.press(screen.getByText('إرسال الطلب للمراجعة'));

    await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(1);
    });

    await act(async () => {
      mockXhrInstances[0].upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/جاري رفع الصورة/)).toBeTruthy();
      expect(screen.getByText('إلغاء رفع الصورة')).toBeTruthy();
    });

    // Make DELETE reject as offline before cancelling and before continuing without photo.
    global.fetch = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          throw new Error('Network request failed');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as unknown as Response;
      },
    ) as unknown as typeof fetch;

    await fireEvent.press(screen.getByText('إلغاء رفع الصورة'));

    expect(mockXhrInstances[0].abort).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('إعادة محاولة رفع الصورة')).toBeTruthy();
      expect(screen.getByText('كمّل وابعت من غير صورة')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('كمّل وابعت من غير صورة'));

    await waitFor(() => {
      expect(providerState.submit).toHaveBeenCalledTimes(1);
    });

    const submittedValues = (providerState.submit as jest.Mock).mock
      .calls[0][0] as { photoChange?: unknown };
    expect(submittedValues.photoChange).toBeUndefined();
  });

  it('distinguishes approved, pending, and tappable red rejected photo states in MyServiceCard', async () => {
    const providerState = createProviderStateValue();
    jest
      .spyOn(ProviderContextModule, 'useProviderState')
      .mockReturnValue(providerState);

    const approved = makeApprovedPhoto();

    const pendingListing = makeListing({
      id: 'p-pending',
      name: 'خدمة بانتظار المراجعة',
      placePhoto: approved,
      photoReviewStatus: 'pending',
      photoCandidateId: 'cand-pend',
      photoAction: 'replace',
    });

    const { rerender } = await render(
      <FeedbackProvider>
        <MyServiceCard listing={pendingListing} category={baseCategory} />
      </FeedbackProvider>,
    );

    expect(screen.getByText('صورة جديدة قيد المراجعة')).toBeTruthy();
    expect(
      screen.getByLabelText('الصورة المعتمدة لخدمة خدمة بانتظار المراجعة').props
        .source,
    ).toEqual({
      uri: approved.thumbnailUrl,
      cacheKey: approved.thumbnailUrl,
    });

    await waitFor(() => {
      const preview = screen.getByLabelText('صورة خاصة قيد المراجعة');
      expect(preview.props.cachePolicy).toBe('none');
      expect(preview.props.source).toEqual({
        uri: 'https://photos.example.workers.dev/v1/photos/candidates/cand-pend/preview',
        headers: { Authorization: 'Bearer test-token' },
      });
    });

    const rejectedListing = makeListing({
      id: 'p-rejected',
      name: 'خدمة بصورة مرفوضة',
      placePhoto: approved,
      status: 'approved',
      photoReviewStatus: 'rejected',
      photoReviewReason: 'الصورة غير واضحة',
      photoCandidateId: 'cand-rej',
      photoAction: 'replace',
    });

    await rerender(
      <FeedbackProvider>
        <MyServiceCard listing={rejectedListing} category={baseCategory} />
      </FeedbackProvider>,
    );

    expect(screen.getByText('الصورة الجديدة محتاجة تعديل')).toBeTruthy();
    expect(screen.getByText('الصورة غير واضحة')).toBeTruthy();

    const reminderButton = screen.getByLabelText(
      'الصورة محتاجة تعديل — راجع الملاحظات وعدّل الصورة',
    );
    const flattenedStyle = Array.isArray(reminderButton.props.style)
      ? Object.assign({}, ...reminderButton.props.style.filter(Boolean))
      : reminderButton.props.style;
    expect(flattenedStyle.borderColor).toBeTruthy();

    expect(
      screen.getByTestId('icon-clipboard-edit-outline', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByTestId('icon-chevron-left')).toBeTruthy();

    await fireEvent.press(reminderButton);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/provider/edit/[id]',
      params: { id: 'p-rejected' },
    });
  });

  it('uses only thumbnailUrl on ProviderCard, falls back on image error, and renders detailUrl on details', async () => {
    const approved = makeApprovedPhoto();
    const provider: ServiceProvider = {
      ...fixtureProviders[0],
      id: 'p-detail-1',
      placePhoto: approved,
    };

    const { rerender, container } = await render(
      <FeedbackProvider>
        <PhotoViewportProvider>
          <ProviderCard
            provider={provider}
            category={baseCategory}
            onPress={jest.fn()}
          />
        </PhotoViewportProvider>
      </FeedbackProvider>,
    );

    const offscreenImages = screen.getAllByTestId('expo-image');
    expect(offscreenImages).toHaveLength(1);
    expect(JSON.stringify(offscreenImages[0].props.source)).not.toContain(
      approved.thumbnailUrl,
    );
    expect(JSON.stringify(offscreenImages[0].props.source)).not.toContain(
      approved.detailUrl,
    );

    const layoutTargets: Parameters<typeof fireEvent>[0][] = [];
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const el = node as {
        props?: { onLayout?: unknown };
        children?: unknown[];
      };
      if (typeof el.props?.onLayout === 'function') {
        layoutTargets.push(node as Parameters<typeof fireEvent>[0]);
      }
      if (Array.isArray(el.children)) {
        el.children.forEach(visit);
      }
    };
    visit(container);
    for (const target of layoutTargets) {
      const stateNode = (
        target as unknown as {
          unstable_fiber?: {
            return?: {
              stateNode?: {
                measureInWindow?: (
                  cb: (x: number, y: number, w: number, h: number) => void,
                ) => void;
              };
            };
          };
        }
      ).unstable_fiber?.return?.stateNode;
      if (stateNode) {
        stateNode.measureInWindow = (cb) => cb(0, 100, 48, 48);
      }
      await fireEvent(target, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 48, height: 48 } },
      });
    }

    const cardImages = screen.getAllByTestId('expo-image');
    expect(cardImages).toHaveLength(1);
    expect(cardImages[0].props.source).toEqual({
      uri: approved.thumbnailUrl,
      cacheKey: approved.thumbnailUrl,
    });
    expect(JSON.stringify(cardImages[0].props.source)).not.toContain(
      approved.detailUrl,
    );

    await fireEvent(cardImages[0], 'error');

    const fallenBackImage = screen.getByTestId('expo-image');
    expect(fallenBackImage.props.source).not.toEqual({
      uri: approved.thumbnailUrl,
      cacheKey: approved.thumbnailUrl,
    });

    const providerState = createProviderStateValue();
    jest
      .spyOn(ProviderContextModule, 'useProviderState')
      .mockReturnValue(providerState);
    mockPublicProviderResult.data = provider;

    await rerender(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );

    const detailImage = screen.getByTestId('service-details-photo', {
      includeHiddenElements: true,
    });
    expect(detailImage.props.source.uri).toBe(approved.detailUrl);
    expect(detailImage.props.contentFit).toBe('contain');
    expect(StyleSheet.flatten(detailImage.props.style)).toMatchObject({
      width: '100%',
      aspectRatio: approved.width / approved.height,
    });

    // Fallback artwork can have different dimensions from the remote photo.
    await fireEvent(detailImage, 'error');
    await fireEvent(detailImage, 'load', {
      source: { width: 600, height: 900 },
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('service-details-photo', {
          includeHiddenElements: true,
        }).props.style,
      ).aspectRatio,
    ).toBe(600 / 900);
  });

  it('throttles PhotoViewportProvider trailing scroll notifications and cleans up timers on unmount', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    const listener = jest.fn();
    const ViewportChild = () => {
      const viewport = usePhotoViewport();
      React.useEffect(() => {
        return viewport?.subscribe(listener);
      }, [viewport]);
      return (
        <View>
          <Pressable testID="scroll-btn" onPress={() => viewport?.onScroll()} />
        </View>
      );
    };

    const { unmount } = await render(
      <PhotoViewportProvider>
        <ViewportChild />
      </PhotoViewportProvider>,
    );

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const scrollBtn = screen.getByTestId('scroll-btn');

    // First scroll is throttled trailing/leading depending on initial lastRun; advance first so leading runs cleanly.
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    listener.mockClear();

    await fireEvent.press(scrollBtn);
    expect(listener).toHaveBeenCalledTimes(1);

    // Rapid second scroll schedules trailing notification for <= 100ms.
    await fireEvent.press(scrollBtn);
    expect(listener).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(listener).toHaveBeenCalledTimes(2);

    // Schedule another trailing scroll, unmount before it fires, and verify timer cleanup prevents post-unmount delivery.
    await fireEvent.press(scrollBtn);
    await fireEvent.press(scrollBtn);
    const countBeforeUnmount = listener.mock.calls.length;
    await unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(listener).toHaveBeenCalledTimes(countBeforeUnmount);
  });

  it('requires viewing private preview before AdminPhotoReview approval, enforces rejection reason, localizes errors, and navigates on completion', async () => {
    const request: ServiceRequest = {
      id: 'req-photo-1',
      ownerId: 'owner-1',
      providerId: 'p1',
      type: 'update',
      status: 'approved',
      proposedData: {
        name: 'أحمد السباك',
        categoryId: 'plumbing',
        serviceTitle: 'سباك صحي محترف',
        description: 'خدمة ممتازة.',
        phone: '01012345678',
        address: 'منشأة العمار',
      },
      photoChange: { action: 'replace', candidateId: 'cand-admin-1' },
      photoReviewStatus: 'pending',
      createdAt: '2026-01-01T10:00:00.000Z',
    };

    const onRefresh = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    await render(
      <FeedbackProvider>
        <AdminPhotoReview
          request={request}
          currentPhoto={makeApprovedPhoto()}
          onRefresh={onRefresh}
        />
      </FeedbackProvider>,
    );

    const approveBtn = screen.getByText('اعتماد تغيير الصورة');
    await fireEvent.press(approveBtn);
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/photo-review'),
      expect.anything(),
    );

    await fireEvent.press(screen.getByText('عرض الصورة الخاصة'));

    await waitFor(() => {
      const preview = screen.getByLabelText('الصورة المقترحة للمراجعة');
      expect(preview.props.cachePolicy).toBe('none');
      expect(preview.props.source).toEqual({
        uri: 'https://photos.example.workers.dev/v1/photos/candidates/cand-admin-1/preview',
        headers: { Authorization: 'Bearer test-token' },
      });
    });

    await fireEvent.press(screen.getByText('رفض تغيير الصورة'));

    expect(screen.getByText('اكتب سبب رفض الصورة.')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/photo-review'),
      expect.anything(),
    );

    await fireEvent.changeText(
      screen.getByLabelText('سبب رفض الصورة'),
      'الصورة بها أشخاص بدون إذن',
    );

    (global.fetch as jest.Mock<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Photo changed on another device' }),
    } as unknown as Response);

    await fireEvent.press(screen.getByText('رفض تغيير الصورة'));

    await waitFor(() => {
      expect(screen.getByText(/اتحدّثت/)).toBeTruthy();
    });

    (global.fetch as jest.Mock<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as unknown as Response);

    onRefresh.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByText('اعتماد تغيير الصورة'));
    await waitFor(() => {
      expect(screen.getByText('تحديث حالة المراجعة')).toBeTruthy();
    });
    const reviewCalls = (global.fetch as jest.Mock<typeof fetch>).mock.calls
      .length;
    await fireEvent.press(screen.getByText('تحديث حالة المراجعة'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin'));
    expect((global.fetch as jest.Mock<typeof fetch>).mock.calls.length).toBe(
      reviewCalls,
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(2);
      expect(mockReplace).toHaveBeenCalledWith('/admin');
    });
  });

  it('offers RecoverServicePhotoAction when a restored published service awaits paused photo recovery and retries cleanly', async () => {
    const providerState = createProviderStateValue({ role: 'admin' });
    jest
      .spyOn(ProviderContextModule, 'useProviderState')
      .mockReturnValue(providerState);
    jest
      .spyOn(AdminRepoModule, 'hasRecoverableServicePhoto')
      .mockResolvedValue(true);
    const retryRestoreSpy = jest
      .spyOn(AdminRepoModule, 'retryRestoreServicePhoto')
      .mockRejectedValueOnce(
        new Error('معالجة الصور متوقفة مؤقتًا حاليًا. جرّب تاني بعد شوية.'),
      )
      .mockResolvedValueOnce(undefined);

    const onRestored = jest.fn();
    const service: PublishedService = {
      id: 'p-restored-1',
      ownerId: 'owner-1',
      name: 'أحمد السباك',
      categoryId: 'plumbing',
      serviceTitle: 'سباك صحي',
      description: 'خدمة منزلية.',
      phone: '01012345678',
      address: 'منشأة العمار',
      publicationStatus: 'published',
    };

    await render(
      <FeedbackProvider>
        <RecoverServicePhotoAction service={service} onRestored={onRestored} />
      </FeedbackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('استعادة صورة الخدمة')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('استعادة صورة الخدمة'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'معالجة الصور متوقفة مؤقتًا حاليًا. جرّب تاني بعد شوية.',
        ),
      ).toBeTruthy();
    });
    expect(onRestored).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('إغلاق الإشعار'));

    await fireEvent.press(screen.getByText('استعادة صورة الخدمة'));

    await waitFor(() => {
      expect(retryRestoreSpy).toHaveBeenCalledTimes(2);
      expect(providerState.refresh).toHaveBeenCalledTimes(1);
      expect(onRestored).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('استعادة صورة الخدمة')).toBeNull();
    });
  });

  it('recovers from failed upload cleanup even after cancelling picker without picking a new photo', async () => {
    const providerState = createProviderStateValue();
    jest
      .spyOn(ProviderContextModule, 'useProviderState')
      .mockReturnValue(providerState);

    mockLaunchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///picker/place.jpg', width: 1600, height: 1200 }],
    });
    const mockContext = {
      resize: jest.fn(),
      renderAsync: jest.fn(async () => {
        mockExistingUris.add('file:///cache/out.jpg');
        mockFileSizes.set('file:///cache/out.jpg', 210_000);
        return {
          width: 1280,
          height: 960,
          saveAsync: jest.fn(async () => ({
            uri: 'file:///cache/out.jpg',
            width: 1280,
            height: 960,
          })),
          release: jest.fn(),
        };
      }),
      release: jest.fn(),
    };
    mockContext.resize.mockReturnValue(mockContext);
    mockManipulate.mockReturnValue(mockContext);

    let reservationCount = 0;
    let deleteCount = 0;
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith('file://')) {
          return {
            ok: true,
            status: 200,
            blob: async () => ({ size: 210_000 }),
          } as unknown as Response;
        }
        if (
          url.endsWith('/v1/photos/reservations') &&
          init?.method === 'POST'
        ) {
          reservationCount += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidateId: `cand-${reservationCount}`,
              serviceId: 'p1',
            }),
          } as unknown as Response;
        }
        if (init?.method === 'DELETE') {
          deleteCount += 1;
          if (deleteCount === 1) {
            throw new Error('Network request failed');
          }
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Photo not found' }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as unknown as Response;
      },
    ) as unknown as typeof fetch;

    const listing = makeListing();
    await render(
      <FeedbackProvider>
        <ServiceForm listing={listing} />
      </FeedbackProvider>,
    );

    await fireEvent.changeText(
      screen.getByDisplayValue('سباك صحي محترف'),
      'سباك صحي محترف ومعتمد',
    );
    await fireEvent.press(
      screen.getByLabelText('التالي: بيانات التواصل والمكان'),
    );
    await waitFor(() => {
      expect(screen.getByText('اختيار صورة من المعرض')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('اختيار صورة من المعرض'));
    await waitFor(() => {
      expect(screen.getByLabelText('معاينة صورة المكان')).toBeTruthy();
      expect(screen.getByText('تغيير الصورة')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('مراجعة البيانات'));
    let checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.press(checkboxes[checkboxes.length - 1]);
    await fireEvent.press(screen.getByText('إرسال الطلب للمراجعة'));

    await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(1);
    });

    // Attempt 1 fails upload, and its cleanup DELETE fails transiently -> candidateId kept with needsCleanup: true.
    await act(async () => {
      mockXhrInstances[0].status = 500;
      mockXhrInstances[0].responseText = JSON.stringify({
        error: 'Upload failed',
      });
      mockXhrInstances[0].onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('إعادة محاولة رفع الصورة')).toBeTruthy();
    });

    // User returns to edit, opens picker ("تغيير الصورة"), and closes picker without choosing a new photo.
    await fireEvent.press(screen.getByText('السابق'));
    await waitFor(() => {
      expect(screen.getByText('تغيير الصورة')).toBeTruthy();
    });
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: true, assets: null });
    await fireEvent.press(screen.getByText('تغيير الصورة'));

    await waitFor(() => {
      expect(screen.getByLabelText('معاينة صورة المكان')).toBeTruthy();
      expect(screen.getByText('تغيير الصورة')).toBeTruthy();
    });

    // Move back to Review and resubmit: stale cand-1 cleanup 404 is ignored, cand-2 is reserved & uploaded cleanly.
    await fireEvent.press(screen.getByText('مراجعة البيانات'));
    checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.press(checkboxes[checkboxes.length - 1]);
    await fireEvent.press(screen.getByText('إرسال الطلب للمراجعة'));

    await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(2);
    });
    expect(mockXhrInstances[1].url).toContain('/candidates/cand-2');

    await act(async () => {
      mockXhrInstances[1].status = 200;
      mockXhrInstances[1].onload?.();
    });

    await waitFor(() => {
      expect(providerState.submit).toHaveBeenCalledTimes(1);
    });
    expect((providerState.submit as jest.Mock).mock.calls[0][0]).toMatchObject({
      photoChange: { action: 'replace', candidateId: 'cand-2' },
    });
  });
});
