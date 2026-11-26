import { describe, expect, it, jest } from '@jest/globals';
import {
  contactUrl,
  copyProviderNumber,
  normalizeContactNumber,
  openProviderContact,
  providerContactNumber,
} from '../src/features/discovery/contact';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';
const real: ServiceProvider = {
  ...providers[0],
  dataSource: 'firestore',
  publicationStatus: 'published',
  phone: '01012345678',
  whatsapp: '01112345678',
};
describe('Egyptian contact numbers', () => {
  it.each([
    '01012345678',
    '+201012345678',
    '00201012345678',
    '201012345678',
    ' 010 1234-5678 ',
    '٠١٠١٢٣٤٥٦٧٨',
    '۰۱۰۱۲۳۴۵۶۷۸',
  ])('normalizes %s', (value) =>
    expect(normalizeContactNumber(value)).toBe('+201012345678'),
  );
  it.each(['01112345678', '01212345678', '01512345678'])(
    'supports %s',
    (value) =>
      expect(normalizeContactNumber(value)).toBe(`+20${value.slice(1)}`),
  );
  it.each([
    '',
    '010123',
    '010123456789',
    '01312345678',
    '02012345678',
    '+971501234567',
    '010abc45678',
    '01012345678;123',
    '++201012345678',
    '010/12345678',
  ])('rejects %s when malformed', (value) =>
    expect(normalizeContactNumber(value)).toBeNull(),
  );
  it('builds restricted URLs', () => {
    expect(contactUrl(real.phone, 'call')).toBe('tel:+201012345678');
    expect(contactUrl(real.whatsapp!, 'whatsapp')).toBe(
      'https://wa.me/201112345678',
    );
  });
});
describe('provider contact safety', () => {
  it.each([
    providers[0],
    { ...real, status: 'pending' as const },
    { ...real, status: 'rejected' as const },
    { ...real, publicationStatus: 'unpublished' as const },
    { ...real, publicationStatus: undefined },
    { ...real, phone: 'invalid' },
  ])('blocks nonpublic/fixture/invalid data', async (provider) => {
    const openURL = jest.fn<() => Promise<void>>();
    const setStringAsync = jest.fn<() => Promise<boolean>>();
    expect((await openProviderContact(provider, 'call', { openURL })).ok).toBe(
      false,
    );
    expect((await copyProviderNumber(provider, { setStringAsync })).ok).toBe(
      false,
    );
    expect(openURL).not.toHaveBeenCalled();
    expect(setStringAsync).not.toHaveBeenCalled();
  });
  it('never infers WhatsApp from phone', () => {
    expect(
      providerContactNumber({ ...real, whatsapp: undefined }, 'whatsapp'),
    ).toBeNull();
    expect(
      providerContactNumber({ ...real, whatsapp: 'invalid' }, 'whatsapp'),
    ).toBeNull();
  });
  it('opens explicit real contacts', async () => {
    const openURL = jest
      .fn<(url: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    expect((await openProviderContact(real, 'call', { openURL })).ok).toBe(
      true,
    );
    expect(openURL).toHaveBeenLastCalledWith('tel:+201012345678');
    expect((await openProviderContact(real, 'whatsapp', { openURL })).ok).toBe(
      true,
    );
    expect(openURL).toHaveBeenLastCalledWith('https://wa.me/201112345678');
  });
  it('offers the explicit WhatsApp number on failure without claiming installation status', async () => {
    const openURL = jest
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValue(new Error('native'));
    expect(
      await openProviderContact(real, 'whatsapp', { openURL }),
    ).toMatchObject({
      ok: false,
      copyNumber: '+201112345678',
      message: 'مش قادرين نفتح واتساب. تقدر تنسخ الرقم وتتواصل بنفسك.',
    });
  });
  it('copies normalized numbers and handles both clipboard failures', async () => {
    const setStringAsync = jest
      .fn<(value: string) => Promise<boolean>>()
      .mockResolvedValue(true);
    expect(await copyProviderNumber(real, { setStringAsync })).toMatchObject({
      ok: true,
      message: 'تم نسخ الرقم',
    });
    expect(setStringAsync).toHaveBeenLastCalledWith('+201012345678');
    setStringAsync.mockResolvedValue(false);
    expect((await copyProviderNumber(real, { setStringAsync })).ok).toBe(false);
    setStringAsync.mockRejectedValue(new Error('clipboard'));
    expect((await copyProviderNumber(real, { setStringAsync })).ok).toBe(false);
  });
});
