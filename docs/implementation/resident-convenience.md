# Resident convenience and provider reliability

Implemented locally in the existing app. Production rules/index deployment and store release are separate steps. No notification service, automatic account deletion, or dependency was added.

## Features and storage boundaries

- Public provider cards/details support local favorites. More → المحفوظات works for guests. IDs survive account changes; each saved ID is refreshed individually. A missing page result never removes a favorite.
- WhatsApp sharing opens a recipient chooser, with native-share/copy alternatives. It includes public name, service, phone and address (coverage for mobile services without a public address). Opening a share UI does not mean delivery.
- Public reads persist validated, whitelisted snapshots only. Categories and up to 500 provider snapshots expire after 30 days; favorites are retained first and favorite IDs do not expire. Confirmed unavailable IDs immediately lose contact snapshots. Cached screens explain retrieval time and incomplete coverage. Offline contact/share requires acknowledgement and share text includes cache date. Owner confirmation and cache timestamps are separate.
- Availability is part of moderated proposals: explicit fixed/mobile/both mode, canonical coverage, optional seven-day hours, up to two nonoverlapping periods, including overnight and Friday/Saturday overlap checks. Mobile addresses are optional and must be public, not a private home address. Hours are stated hours, with no “open now” calculation.
- Owner confirmation reads current published data and uses its `updatedAt` revision in a transaction. Only `lastConfirmedAt` is stamped by server time. Missing/90-day-old confirmation prompts a reminder without unpublishing. Changed publications and restores omit the old confirmation.
- Forms save per-account new/edit drafts after 750ms and flush on background/navigation. Consent is never saved. Recovery is explicit; publication revision differences are shown before restoring. A failed write never reports “saved”. Successful submission/discard/sign-out clears drafts; write epochs prevent pending sign-out writes recreating them. Auth-session loss also attempts cleanup. Favorites remain independent.
- `/support` and `/support/new` offer authenticated private support/deletion tickets. A stable submission ID makes acknowledgement retries idempotent. A receipt appears only after the server acknowledges. Staff statuses/notes are separate from listing moderation. Guests retain email support. No submission is queued offline.

AsyncStorage keys are `directory.public.v1` and `directory.draft.v1.<encoded UID>.<encoded service ID or new>`. Do not put profiles, moderation proposals, reports, tickets, passwords, or tokens into the public cache. Local storage is device storage, not encrypted secret storage.

## Wire format and atomic validation

Existing listings without availability remain readable. Owners must choose a mode on their next submission. `weeklyHours` on Firestore is a complete seven-key map. Each day is a compact string `status,start1,end1,start2,end2`; minutes are decimal integers, starts are 0–1439, and an overnight end includes 1440. Status codes: unspecified 0, closed 1, appointment 2, 24 hours 3, specified periods 4. Nonperiod statuses use four zeroes; one period pads the second pair with zeroes. Example: `4,540,720,1320,1560` means 09:00–12:00 and 22:00–02:00 next day. The app model/editor uses typed HH:mm periods, not this encoding.

Hours submissions atomically create the immutable request, slot/quota changes, and four private `serviceRequests/{id}/scheduleValidation/{0..3}` validation receipts. Each receipt validates a bounded portion of that same parent's schedule; all four must carry the same server timestamp as the parent write. This avoids Firestore's per-write expression limit while preserving owner, pending-status, timestamp, quota and category checks. Receipt creation requires a new parent in the same atomic operation; clients cannot edit them. The slot also mirrors the same hours and checks equality. Archiving copies availability exactly from the current publication; restoration cannot mutate the archive snapshot. Delete receipts with their parent history in trusted cleanup tooling.

## Release sequence

1. Release client-compatible public sharing/favorites behavior.
2. Review and deploy rules/indexes before enabling availability/confirmation writes. Exercise full two-period and overnight weeks in the Firebase emulators. Require updated clients for the new submission contract; older clients must not silently discard new fields.
3. Verify local draft/cache behavior on target devices, including storage failure and session loss. There is no offline write queue.
4. Review and deploy private `supportRequests` rules and the ownerId/createdAt index, then enable tracked requests. Ensure staff monitor the queue and the support inbox.

Use the existing Firebase deployment process against the intended project only. This change does not deploy rules/indexes or delete real data.

## Manual acceptance checklist

Use emulator/test accounts and mock outbound actions. Never place a real call or send a real WhatsApp message for QA.

- Guest: save/remove, restart, sign in/out, open saved unavailable service, clear-all cancel/confirm.
- Share: fresh details, mobile coverage-only details, WhatsApp missing, native-share cancellation, copy failure, confirmed removed service, cached acknowledgement/cancellation and refreshed removal while dialog is open.
- Availability: all modes; optional mobile address; all day statuses; one/two/overnight periods; adjacency and weekly overlap; moderate create/edit; unpublish, correct, restore; legacy edit requiring mode.
- Confirmation: current details shown, cancel, 89/90 days, another publication before confirm, wrong owner, arbitrary-field attempt, timestamp reset after changed approval/restore.
- Draft: new/edit autosave, background, back/save-exit, restore/discard, fresh consent, publication revision conflict, storage failure, offline reopen, retry online, sign-out during a pending write, session loss/deleted account.
- Cache: warm/cold offline start, incomplete page notice, expired records, favorites-first 500 cap, no cursor restoration, duplicate pagination merge, permission denial never used as offline permission.
- Tickets: guest sign-in path, duplicate retry, no receipt on failure, ownership/admin access, required rejection reason, allowed transitions, missing ticket, manual deletion wording and final email.
- Android and iOS: 360/390/412 logical-width equivalents, large Arabic font, keyboard reachability, safe areas/sticky actions, hardware/gesture back, petroleum-blue Light/Dark. Record native coverage separately from component-test coverage.

Automated checks cover storage boundaries, cache TTL/cap/removal, sharing/fallbacks, draft recovery/error/consent, availability mapping/overlap, revision-bound confirmation, private ticket transactions/UI, and Firestore permissions. Native/device results and remaining checks are recorded in the delivery notes; unit tests are not device E2E evidence.

## Verification record — 2026-11-13

- TypeScript and ESLint: passed.
- App tests: 58 suites / 465 tests passed. Firebase Auth + Firestore emulator tests: 52 passed in an isolated demo project; no production writes.
- Formatting: all source and the focused changed tests/docs passed. A broad repository check also finds existing formatting issues in historical QA evidence and unrelated documents/tests; those were left intact.
- Android and iOS native production bundle exports passed. Android debug APK rebuilt and installed successfully on Pixel_10 (API 36).
- Native smoke coverage is limited: current favorites empty state rendered in Arabic with safe bottom spacing; approximately 390dp and large-font layouts were inspected. Resolution/system-theme changes restarted navigation, and the saved app preference overrode the system Dark toggle. Full authenticated native journeys, actual Dark-mode screenshots, the complete 360/390/412 matrix, keyboard checks and iOS simulator interaction remain on the manual checklist. Component tests do not substitute for these device checks. Emulator settings were restored.
- An additional optional all-platform export hit a web SSR dependency error (`tslib` / `__extends`); native Android/iOS exports succeeded separately. Web hosting is not part of this mobile delivery.
- No real calls, WhatsApp messages, support/deletion requests, notifications, production deployment or account deletion were performed. Rules/index deployment, staff operating readiness and device acceptance remain release gates.
