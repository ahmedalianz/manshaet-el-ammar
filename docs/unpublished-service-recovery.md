# Unpublished service recovery

## Behavior

- Admin → إدارة الخدمات → الأرشيف lists hidden services separately from published services, with search and the reason for hiding each one.
- Unpublish requires a nonblank reason of at most 1,000 characters. One transaction saves the last published snapshot to private `archivedProviders/{providerId}`, records the reason/reviewer/time, rejects an in-flight edit with that reason, releases its quota reservation, and removes the public document.
- My Services shows the reason. The owner can correct and submit the same logical service for review, with fresh publication consent. Rejected corrections retain their values/reason for another attempt. Waiting corrections cannot be edited or submitted twice.
- A correction is a `serviceRequests` record of type `restore`. It reserves a quota slot and never writes public data. Approval validates the active category, consent, owner, latest request slot, archive status and quota, publishes the proposed values, and marks the archive `restored`. Rejection releases its quota slot and leaves the archive intact.
- An admin can explicitly restore the saved published version after confirmation. This is blocked while a correction is waiting, after a prior restoration, for inactive categories, or when the owner's quota is full. A waiting correction instead gets a review shortcut.
- Restored archive metadata stays private. Public documents contain only approved service fields. Permanent service deletion also removes its archive. Account-data deletion runbooks must include archived snapshots and restoration metadata.

## Rollout

Deploy `firestore.rules` and `firestore.indexes.json` before releasing the app update. These changes are prepared locally; production deployment and production data changes were not performed for verification. Older app versions do not understand the new `restore` request type and need updating.

Previously hidden services were physically deleted from `providers`, without storing a reason or the exact last published snapshot. They cannot be safely auto-restored. Before rollout, an administrator must review any retained approved request history/backups and import a private archive with a real reason (never invent one). Do not import permanently deleted services or use a pending/rejected proposal as the last published version. Required archive fields mirror the public service plus `ownerId`, `publishedAt`, `archiveStatus: unpublished`, `unpublishReason`, `unpublishedAt` and `unpublishedBy`. If no reliable approved snapshot remains, the owner should submit a new service for review through support guidance.

Archive and owner queries currently return up to 100 archived records. This matches the existing moderation/owner-list read bounds; archive pagination is not introduced here.

## Verification

- Repository/context/component coverage includes mandatory reason and cancel, atomic archive and pending-edit rejection, restore confirmation, quota limits, stable identity, correction ownership/consent, rejected correction history, archive search/navigation, owner correction entry, and private/public projections.
- Firestore/Auth tests run with isolated local demo-project emulators, including guest/foreign-owner denial, owner read-only archive access, mandatory reason, atomic public removal and consent/quota-gated correction requests.
- No real services were hidden, restored or edited for verification. Native device review of the new reason dialog and archive remains a manual check.

## Manual check

1. With a test provider and admin, hide a published service; cancel first, then confirm with a reason.
2. Check its absence from Home, Explore and public details, its presence in admin archive, and the reason in My Services.
3. Correct the address as owner, submit with fresh consent, then reject as admin. Confirm the service remains hidden and the rejection reason/entered correction remain available.
4. Resubmit and approve; confirm exactly one public record with unchanged service/owner IDs and the approved values.
5. Hide again and explicitly restore the saved version; cancel once before confirming. Check the archive no longer shows it as hidden.
6. Try direct restore while a correction is waiting and with a full owner quota; both must refuse publication.
7. Check the reason dialog with keyboard, long Arabic reasons, Light/Dark mode and Android back cancellation.

### Verified results

TypeScript, ESLint and formatting checks passed. The full app suite passed: 45 suites, 403 tests. The isolated Auth/Firestore emulator suite passed: 46 tests. No production deployment, legacy-data backfill or native-device mutation was performed.
