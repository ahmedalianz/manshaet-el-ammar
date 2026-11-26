import { describe, expect, it } from '@jest/globals';
import { validPhotoDraft } from '../src/features/photos/draftValidation';

describe('photo draft boundary', () => {
  it('accepts a durable local candidate without credentials', () => {
    expect(
      validPhotoDraft({
        action: 'replace',
        localUri: 'file:///documents/service-photo-drafts/image.jpg',
        candidateId: 'candidate-123',
        uploaded: true,
      }),
    ).toBe(true);
  });
  it.each([
    { action: 'replace', localUri: 'https://attacker.example/image.jpg' },
    { action: 'replace', localUri: 'file:///documents/private.jpg' },
    {
      action: 'replace',
      localUri: 'file:///documents/service-photo-drafts/../private.jpg',
    },
    {
      action: 'replace',
      localUri: 'file:///documents/service-photo-drafts/%2e%2e/private.jpg',
    },
    { action: 'replace' },
    { action: 'keep', candidateId: '../other-owner' },
    { action: 'publish' },
  ])('rejects malformed or untrusted draft %j', (value) =>
    expect(validPhotoDraft(value)).toBe(false),
  );
});
