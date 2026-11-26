import { expect, it } from '@jest/globals';
import {
  validatePhone,
  validateMobile,
} from '../src/features/provider/validation';
import {
  contactUrl,
  launchContactUrl,
} from '../src/features/discovery/contact';

it.each([
  '0132427470',
  '+20132427470',
  '0020132427470',
  '٠١٣٢٤٢٧٤٧٠',
  '0223456789',
  '01012345678',
])('accepts service phone %s', (number) => {
  expect(validatePhone(number)).toBeUndefined();
});
it.each(['013242747', '01324274700', '01912345678', '123', ''])(
  'rejects malformed phone %s',
  (number) => {
    expect(validatePhone(number)).toBeDefined();
  },
);
it('calls landlines but does not treat them as WhatsApp mobiles', async () => {
  expect(validateMobile('0132427470')).toBeDefined();
  expect(contactUrl('0132427470', 'call')).toBe('tel:+20132427470');
  expect(contactUrl('0132427470', 'whatsapp')).toBeNull();
  const opened: string[] = [];
  expect(
    await launchContactUrl('tel:+20132427470', {
      openURL: async (url) => opened.push(url),
    }),
  ).toEqual({ ok: true });
  expect(opened).toEqual(['tel:+20132427470']);
});
