import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as ReactNative from 'react-native';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { categories } from '../src/features/discovery/data/categories';
import { clearUserDrafts } from '../src/features/local/drafts';
import { PhotoField } from '../src/features/photos/PhotoField';
import { AddServiceArtwork } from '../src/features/provider/AddServiceArtwork';
import { CategorySelectionSheet } from '../src/features/provider/CategorySelectionSheet';
import { ServiceForm } from '../src/features/provider/ServiceForm';
import { ServiceReview } from '../src/features/provider/ServiceReview';
import { fireEvent, render, screen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useFocusEffect: () => {},
  usePreventRemove: () => () => {},
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    userId: 'visual-owner',
    submit: jest.fn(async () => 'prov-1'),
    saveAdminService: jest.fn(async () => 'prov-1'),
    allocateSubmissionId: jest.fn(() => 'sub-1'),
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
  }),
}));

const previousPhotoApiUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
  await clearUserDrafts('visual-owner');
});

afterEach(async () => {
  await clearUserDrafts('visual-owner');
  if (previousPhotoApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
  } else {
    process.env.EXPO_PUBLIC_PHOTO_API_URL = previousPhotoApiUrl;
  }
});

describe('Add Service visual and illustration upgrades', () => {
  it.each([
    { variant: 'step1' as const, compact: false },
    { variant: 'step2' as const, compact: false },
    { variant: 'photo' as const, compact: false },
    { variant: 'photo' as const, compact: true },
    { variant: 'review' as const, compact: false },
  ])(
    'renders AddServiceArtwork ($variant, compact=$compact) hidden from accessibility in light and dark modes',
    async ({ variant, compact }) => {
      for (const scheme of ['light', 'dark'] as const) {
        jest.mocked(ReactNative.useColorScheme).mockReturnValue(scheme);
        const { toJSON } = await render(
          <AddServiceArtwork variant={variant} compact={compact} />,
        );
        const tree = toJSON();
        expect(tree).toBeTruthy();
        if (tree && !Array.isArray(tree)) {
          expect(tree.props.pointerEvents).toBe('none');
          expect(tree.props.accessibilityElementsHidden).toBe(true);
          expect(tree.props.importantForAccessibility).toBe(
            'no-hide-descendants',
          );
        }
      }
    },
  );

  it('keeps Step 1 free of PhotoField clutter, previews selected category details, and shows PhotoField on Step 2', async () => {
    await render(
      <FeedbackProvider>
        <ServiceForm />
      </FeedbackProvider>,
    );

    expect(screen.getByText('أهلًا بيك في دليل أهل منشأة العمار')).toBeTruthy();
    expect(screen.getByText('تعريف الخدمة')).toBeTruthy();
    expect(screen.queryByText('صورة المكان — اختياري')).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
    );
    await fireEvent.press(
      screen.getByRole('radio', { name: 'السباكة والمضخات' }),
    );

    expect(screen.getAllByText('السباكة والمضخات')).toHaveLength(1);
    expect(
      screen.getByText('أدوات صحية، مضخات ري، وتصليح تركيبات منزلية'),
    ).toBeTruthy();
    expect(
      screen.getByText('مثال للتخصص: سباك صحي وصيانة منزلية'),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('الاسم اللي هيظهر للناس *'),
      'أحمد محمود',
    );
    await fireEvent.changeText(
      screen.getByLabelText('تخصصك أو اسم مختصر لخدمتك *'),
      'سباك صحي وصيانة منزلية',
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );

    expect(screen.getByText('إزاي الناس توصل ليك؟')).toBeTruthy();
    expect(screen.getByText('صورة المكان — اختياري')).toBeTruthy();
  });

  it('renders enabled dropzone and compact single-notice unavailable state in PhotoField', async () => {
    process.env.EXPO_PUBLIC_PHOTO_API_URL =
      'https://photos.example.workers.dev';
    const { rerender } = await render(
      <PhotoField
        value={{ action: 'keep' }}
        onChange={jest.fn(async () => {})}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByText('واجهة واضحة', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByText('إضاءة نهارية', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'اختيار صورة من المعرض' }).props
        .accessibilityState.disabled,
    ).toBe(false);

    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
    await rerender(
      <PhotoField
        value={{ action: 'keep' }}
        onChange={jest.fn(async () => {})}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getAllByText(
        'إضافة الصور مش متاحة حاليًا. تقدر تبعت بيانات خدمتك عادي.',
      ),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'اختيار صورة من المعرض' }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it('renders ServiceReview hero header with single-match summary rows and interactive edit actions', async () => {
    const onEdit = jest.fn();
    await render(
      <ServiceReview
        values={{
          name: 'أحمد محمود',
          categoryId: 'plumbing',
          serviceTitle: 'سباك صحي وصيانة منزلية',
          description: 'صيانة سريعة',
          phone: '01012345678',
          address: 'شارع المدرسة',
          serviceMode: 'fixed',
        }}
        categoryName="السباكة والمضخات"
        categoryIcon="pipe-wrench"
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText('خطوة أخيرة قبل النشر')).toBeTruthy();
    expect(screen.getAllByText('أحمد محمود')).toHaveLength(1);
    expect(screen.getAllByText('01012345678')).toHaveLength(1);

    await fireEvent.press(
      screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تعديل التواصل والمكان' }),
    );

    expect(onEdit).toHaveBeenNthCalledWith(1, 1);
    expect(onEdit).toHaveBeenNthCalledWith(2, 2);
  });

  it('renders category descriptions, empty search state, and one-tap other fallback in CategorySelectionSheet', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    await render(
      <CategorySelectionSheet
        visible
        categories={categories}
        selected="plumbing"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByText('أدوات صحية، مضخات ري، وتصليح تركيبات منزلية'),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('ابحث عن قسم...'),
      'كلمة غير موجودة نهائيا',
    );
    expect(screen.getByText('مفيش أقسام مطابقة للبحث')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'اختيار خدمات تانية' }),
    );
    expect(onSelect).toHaveBeenCalledWith('other');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('previews the other category description and tailored examples without a stock category image', async () => {
    await render(
      <FeedbackProvider>
        <ServiceForm />
      </FeedbackProvider>,
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'خدمات تانية' }));

    expect(
      screen.getByText('أي خدمة تانية مش موجودة في الأقسام المتاحة'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'مثال للتخصص: تصوير مناسبات أو صيانة موبايلات أو حلاقة',
      ),
    ).toBeTruthy();
  });
});
