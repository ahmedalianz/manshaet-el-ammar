# Mock moderation and account verification

## Automated checks

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npx prettier --check src __tests__`.

The Jest/React Native Testing Library suites cover moderation transitions, ownership and role checks, duplicate decisions, rejected-request history, pending edit replacement, publication preservation, report closure, shared-context synchronization, account privacy, More visibility, profile editing, sign-out, and inert password reset. These are unit/component integration tests, not device E2E tests. Each repository test starts from fresh deterministic fixtures.

## Manual device checklist

Use the development role selector at Sign In; changing profiles preserves the shared database within the running JavaScript session. A reload resets all changes. The empty provider profile starts without listings; the populated provider and admin profiles exercise lifecycle fixtures.

- Guest: browse Home/Explore, confirm My Services is hidden, open More, and confirm no account/admin controls are shown. Direct Profile/Admin links must not reveal private data.
- Provider: add a service, verify both form steps, phone normalization, same-number WhatsApp, required consent, dirty-back confirmation, and pending status. Search publicly and confirm the submission is absent.
- Admin: open More → إدارة الخدمات. Confirm pending/published/report counters, active tabs, name/title search, Arabic dates, and empty states.
- Approve the new request after confirmation. Switch to the provider without reloading: one published card must appear and public discovery must contain the approved service.
- Reject a new request with a reason; resubmit as its owner. The rejected record remains in history and the corrected request returns to the queue without a duplicate logical service.
- Edit a published service's phone/address. Confirm old public data stays visible and admin comparison shows changed fields only. Approve and verify the new public values, or reject and verify the old public data plus the owner's rejection reason.
- Replace an existing proposal only through the explicit confirmation. Repeat approval and verify an understandable stale-request error, with no duplicate publication.
- Unpublish a service. Confirm it disappears from discovery but remains in My Services; pending edits remain recorded and cannot be approved. Reports stay open until separately closed.
- Close an open report after confirmation. Confirm only its report counter/list changes. Inspect missing-service and unpublished-service report fallbacks.
- More/Profile: inspect guest/provider/admin states; edit a nonempty account name, verify More updates immediately and service/request values do not change. Reject an empty name. Email is read-only; password reset is visibly disabled.
- Sign out and confirm guest More and protected-route denial. Sign back in and confirm listings/requests were retained.
- Open About, Contact, and Privacy pages. No fake contact method, final legal claims, or outgoing email action should appear. App version comes from Expo configuration.
- Review 360, 390, and 412dp Android layouts, long Arabic text, keyboard access, bottom safe areas, and scroll reachability. Restore emulator density afterward.

## Device coverage recorded during implementation

Android emulator checks exercised guest More, provider/admin sign-in through More, admin dashboard navigation, approval confirmation and approval (pending count 2 → 1, published count 9 → 10), provider/admin Profile display, inline profile saving and its real success dialog, and disabled password reset. Layout snapshots were reviewed for guest More at 360dp and Profile at approximately 390/412dp. These checks do not constitute the entire device checklist above; the remaining lifecycle branches are covered by automated tests and remain listed for full device regression. iOS device testing was not performed.

## Limitations and migration

All accounts, requests, reports, approvals, and contact values are local demo data. Mock permissions are development aids and are not production security. There is no Firebase business access, real password reset, notification delivery, persistence, or real report submission. Contact details have not been configured and policy text needs review before production.

Future Firebase integration must replace the existing context's explicit operations with authenticated ownership, approved-only public projections, private requests/reports, atomic review decisions, and server-enforced authorization. Keep account names separate from public listing names and retain request history. Do not migrate fixtures into production data.
