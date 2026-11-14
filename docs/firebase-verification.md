# Firebase integration verification

Verified locally on 4 November 2026:

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test`: 194 tests across 22 suites passed. This includes real production Auth/context adapter component tests using mocked transport, repository/mapping tests, and older isolated mock regression fixtures. Component tests are not device or deployed-project tests.
- `npm run test:rules`: 35 tests across five suites passed against local Auth/Firestore emulators using only `demo-manshaet`. These include actual Email/Password SDK account creation, sign-out/sign-in, private profile access and password-reset emulator outbox behavior, plus rule enforcement and query compatibility.
- `npx expo config --type public`: passed.
- Prettier checks passed for application/test sources and Firebase JSON/documentation.
- Read-only inspection of the running Android emulator showed the app rendering More with a restored signed-in account, logo, RTL text and tab spacing. No account or listing was created through the device during this verification.

No deployment or production write was performed by this verification pass. Existing connected-project/Google configuration work was preserved. Local tests do not establish the state of deployed rules, indexes, OAuth configuration or actual email delivery.

## Remaining manual acceptance checks

Use a separate development Firebase project or isolated emulators, with Android host `10.0.2.2`. Never use a real provider's details for tests.

- Cold-start with no session; public categories/search/details work without sign-in and private tabs stay hidden.
- Register, sign out, sign in and restart the native app; verify persistence and intended-destination navigation.
- Submit both form steps with consent; see a confirmed pending request, no public provider, and one owner card. Retry/double-tap and offline failures must not create a second request.
- Change accounts and verify no previous private card/profile flashes during restoration or delayed reads.
- Follow the Console moderation guide: approve a new request, refresh discovery/My Services, propose an edit, and confirm public data stays unchanged until approval.
- Reject a create or update with a reason; correct/resubmit, preserving history. A second pending proposal must be blocked.
- Delete the public provider to unpublish; retain requests/slot and verify unavailable details and blocked further updates.
- Exercise keyboard, long Arabic text, back/cancel and sticky actions on physical devices and the target widths/platforms. These were not fully device-tested in this pass.

Public search is bounded, contact launch/report UI remains restricted, pending submissions are immutable, and moderation is manual. See [setup and recovery](firebase-setup.md) for these limits and the production checklist.
