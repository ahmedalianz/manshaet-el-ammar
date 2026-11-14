# Provider contact actions

Provider Details now reuses React Native Linking, Expo Clipboard and the existing themed feedback UI. No dependency, call permission, native package-visibility configuration, analytics, messaging or moderation change was added.

Eligibility requires all three existing model fields: `dataSource: 'firestore'`, `status: 'approved'`, and `publicationStatus: 'published'`. That marker is assigned by the approved public-provider mapper, not inferred from a valid-looking number. Fixture records, pending/rejected/unpublished records and invalid numbers cannot launch or copy contacts. The published provider collection contains contact data deliberately submitted with publication consent; private account details are never used.

Numbers accept local Egyptian mobile prefixes 010/011/012/015 and equivalent `+20`, `0020` or bare `20` forms, Arabic-Indic/Persian digits, common spaces/hyphens and existing parenthesis formatting. They normalize to E.164. Unexpected characters, other country codes, lengths and prefixes are rejected. The existing model supports mobile numbers only; landlines remain unsupported, not silently treated as mobiles.

Call opens the OS dialer using validated `tel:+20…`; WhatsApp uses only the explicitly entered optional WhatsApp number and HTTPS `wa.me/20…`. A valid number is not evidence that a WhatsApp account exists. `openURL` is called directly and caught, avoiding `canOpenURL` package-visibility false negatives and allowing HTTPS browser handling. The OS decides whether WhatsApp or a browser handles the link. No direct-call API is used.

Every action refetches the current public detail document first. Missing/unpublished documents or failed reads never fall back to cached numbers. A synchronous per-screen lock prevents repeated taps while checking/opening/copying. Copy writes the normalized number and reports success only after the Clipboard API succeeds. Opening failures offer a copy-number fallback; the fallback revalidates publication again and uses the configured WhatsApp number for WhatsApp failures.

The focused change is in:

- `src/features/discovery/contact.ts`: eligibility, normalization, URL validation, opening and copying.
- `src/features/provider/validation.ts`: reuse of bare `20` normalization in form validation.
- `src/app/provider/[id].tsx`: enabled/disabled controls, fresh availability checks, duplicate-action lock and Arabic fallback feedback.
- `__tests__/contact-actions.test.ts`, `__tests__/provider-feedback.test.tsx`: normalization, safety, launch/copy failures, repeated taps, stale/unpublished records and WhatsApp fallback.

Verification: all 243 tests across 25 suites passed; TypeScript, ESLint and focused formatting checks passed. Linking and Clipboard were mocked; tests did not open real calls, WhatsApp or browsers. Android/iOS external-app handoff, browser fallback, physical clipboard, RTL and light/dark appearance were not manually verified for this change. No trusted real provider contact was used for device testing.

Limitations: availability checks require connectivity; an administrator could remove a document immediately after the check. There is no guarantee that a formatted number is reachable or that WhatsApp exists for it. Home/category listing cards now share the same contact-action handler as Provider Details, including fresh public-record checks, tap locks and copy fallback. Details navigation and contact buttons are separate accessible controls. Reports remain coming soon.

API references: [React Native Linking](https://reactnative.dev/docs/linking), [Expo SDK 58 Clipboard](https://docs.expo.dev/versions/v58.0.0/sdk/clipboard/).
