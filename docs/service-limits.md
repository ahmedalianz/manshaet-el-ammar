# Provider service limits

Each account may have three published services or pending new-service requests in total. IDs are deduplicated. Editing a service or retrying the same pending request does not consume another slot. Rejecting a new submission or unpublishing releases its slot. Rejecting an edit does not release the published service's slot.

The app checks quota on the Add Service page and reserves atomically inside submitRequest. Firestore rules require the matching reservation and prevent owners from lowering the count, deleting the quota, or increasing their own limit. Two concurrent submissions cannot both reserve the last slot. The limit message links to the existing support email flow.

## Deployment — requires owner approval

No production data or rules were changed while implementing this feature. The new app requires the updated rules and existing-account backfill. Old app versions cannot reserve quotas and will be denied new service submissions after the rules deploy; require testers/users to update.

1. With an authorized Firebase CLI owner login, inspect the migration in read-only mode:
   `node scripts/backfill-service-quotas.mjs --project manshyat-amar`
2. Arrange a maintenance window that prevents submissions, approvals, rejections and unpublishing during the backfill and rules deployment. Do not backfill concurrently with live writes.
3. After explicit production approval, backfill:
   `node scripts/backfill-service-quotas.mjs --project manshyat-amar --apply --confirm-maintenance`
4. Verify the quota documents against published services and pending new requests; deploy the updated rules:
   `npx firebase-tools deploy --only firestore:rules --project manshyat-amar`
5. Distribute the updated AAB, verify with dedicated accounts, and resume submissions. Pending creations from old versions can still be reviewed because they were counted during backfill.

The migration preserves approved custom limits. Existing accounts already above three keep their services; they cannot add more until they are below their limit or support grants an exception. The script does not remove old quota documents, and intentionally requires project and maintenance confirmation before writing. The migration uses the existing Firebase CLI login; no Admin credential file is needed or bundled.

## Support-approved exceptions

After reviewing a support request, an authorized admin may set `limit` (integer, at most 100) on `serviceQuotas/{uid}`. This raises only that account's maximum. Keep the existing serviceIds. Ordinary clients cannot change the limit. No new admin feature or payment process is introduced.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test -- --silent`, and `npm run test:rules`. Rules tests use only the demo-manshaet emulator. Verify fourth-service denial, concurrency, permission bypass attempts, edits at capacity, rejection/unpublish slot release and support override before deploying.
