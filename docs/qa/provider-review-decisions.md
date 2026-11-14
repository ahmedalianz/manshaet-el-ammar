# Provider review decisions

Implemented 2026-11-12.

My Services refreshes the signed-in provider's listings and review requests on screen focus, on returning from the background while focused, and through pull-to-refresh. It does not refresh the public directory or admin moderation queue.

The latest completed review for each owned listing appears as an unread approval/rejection panel. The panel distinguishes additions, edits, and restoration requests and includes the actual rejection reason when available. A summary resets active filters so affected cards can be found. Pending and other owners' requests are excluded, including when an administrator is signed in.

Acknowledgements persist in AsyncStorage under an account-specific key on this device. Existing completed decisions appear on the first visit until acknowledged. Later decisions receive a new key. Storage failures display feedback; acknowledgements are not synced across devices.

Verification:

- Focused hook, screen, and context tests: 21 passed.
- Complete unit suite: 51 suites, 432 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

Tests cover focus and foreground transitions, duplicate active events, guest behavior, targeted query invalidation, pending-to-approved changes, rejected edits and reasons, remount persistence, account isolation, rapid acknowledgements, and storage failures.

Not exercised: a live administrator approving/rejecting a real submission, physical-device rendering, or cross-device acknowledgement. No production Firebase records were changed. Push approval/rejection notifications remain deferred; no notification permissions, delivery backend, or dependencies were added.
