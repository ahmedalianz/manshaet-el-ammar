import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from './helpers/render';
import { StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';
import { MyServiceCard } from '../src/features/provider/MyServiceCard';
import { initialMockState, getMyServices } from './fixtures/moderation';
import { SectionTitle } from '../src/features/discovery/components/DiscoveryUi';
import { FormField } from '../src/features/provider/FormField';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
const luminance = (hex: string) => {
  const values = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
describe('actual theme contrast pairs', () => {
  it.each([
    'background',
    'surface',
    'surfaceLow',
    'surfaceContainer',
    'accountBackground',
  ] as const)('keeps muted copy readable on %s', (surface) =>
    expect(contrast(colors.muted, colors[surface])).toBeGreaterThanOrEqual(4.5),
  );
  it.each([
    'surface',
    'surfaceLow',
    'surfaceContainer',
    'secondary',
    'errorContainer',
  ] as const)('keeps status/secondary text readable on %s', (surface) =>
    expect(
      contrast(colors.textSecondary, colors[surface]),
    ).toBeGreaterThanOrEqual(4.5),
  );
  it.each(['background', 'surface', 'surfaceLow', 'surfaceContainer'] as const)(
    'keeps error text readable on %s',
    (surface) =>
      expect(contrast(colors.error, colors[surface])).toBeGreaterThanOrEqual(
        4.5,
      ),
  );
  it('keeps primary button labels readable', () =>
    expect(contrast(colors.surface, colors.primaryDark)).toBeGreaterThanOrEqual(
      4.5,
    ));
  it('gives input borders sufficient non-text contrast', () =>
    expect(contrast(colors.muted, colors.surface)).toBeGreaterThanOrEqual(3));
});

describe('wrapping and accessible state labels', () => {
  const listings = getMyServices(initialMockState(), 'demo-listings');
  it.each([
    ['owned-approved', 'منشورة'],
    ['owned-pending', 'طلب إضافة قيد المراجعة'],
    ['owned-rejected', 'مطلوب تعديل وإعادة الإرسال'],
    ['owned-changes', 'تعديلات قيد المراجعة'],
    ['owned-rejected-edit', 'تعديلات تحتاج تعديل'],
    ['owned-unpublished', 'غير منشورة'],
  ])('exposes an explicit text status for %s', async (id, label) => {
    await render(
      <MyServiceCard
        listing={listings.find((listing) => listing.id === id)!}
      />,
    );
    const text = screen.getByText(label);
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.numberOfLines).toBeUndefined();
  });
  it('provides a comfortable section action target', async () => {
    await render(
      <SectionTitle
        title="خدمات البلد"
        actionLabel="عرض الكل"
        onAction={() => {}}
      />,
    );
    expect(
      StyleSheet.flatten(screen.getByRole('button').props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
  });
  it('retains error announcements and LTR phone input without disabling scaling', async () => {
    await render(
      <FormField
        label="رقم الموبايل"
        value="01012345678"
        phone
        error="راجع الرقم"
      />,
    );
    const input = screen.getByLabelText('رقم الموبايل');
    expect(input.props.textAlign).toBe('left');
    expect(input.props.allowFontScaling).not.toBe(false);
    expect(screen.getByText('راجع الرقم').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });
});
