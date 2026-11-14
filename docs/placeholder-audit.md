# User-facing placeholder audit

The public screens and their imported runtime data paths were inspected. Fixes:

- Home category tiles now use the active Firestore catalogue order, with an intentional eight-tile layout limit. No fixed category-ID whitelist hides newly configured categories.
- Removed the inactive “map coming soon” form button. Address/area input remains functional; no map feature is implied.
- Provider reporting now opens the configured real support email, without claiming automatic email delivery or a submitted Firestore report.
- Removed outdated unpublished-listing “demo version” copy.
- Moved fictional providers and the mock moderation state/transitions into `__tests__/fixtures`. Extracted only the real admin comparison helper into `src/features/provider/changedFields.ts`. No runtime import of the fixture providers or mock state remains.
- Submission success now checks the service ID against the authenticated account's pending server-loaded requests; direct navigation does not manufacture a pending card or success check mark. Create/update acknowledgement follows request type.

Intentional static configuration remains: Arabic labels and input examples, design tokens, icon/search metadata, the supported area-ID catalogue, branding, owner-supplied support/policy links and configured national emergency shortcuts. Those are not fabricated provider records.

Real limitations remain visible: account deletion requires a verified support/cleanup process, bounded search covers loaded results, and failed/unavailable contacts stay disabled. These are not replaced with simulated success. No Firebase writes, deletion backend, map selection or production deployment was added in this audit.

Verification: TypeScript, ESLint, formatting and 260 app tests passed after the cleanup. No real call, report email or deletion request was sent during tests.
