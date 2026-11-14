# Remove the legacy single-area field

The app model, form snapshots, public cache, moderation projections/comparisons, cards, search, and Explore filters no longer use the single `area`/`areaId` field. Legacy reads ignore and strip it; newly persisted values omit it. Public addresses and the separate coverage feature for travelling services remain supported. The former discovery-area constants now live only as availability coverage options.

Local Firestore validators no longer require the field and reject obsolete names, including the `areadId` typo. The migration recursively inventories Firestore documents/subcollections, defaults to read-only, and deletes only exact obsolete map fields. It uses separate update masks, document-version preconditions, a private rollback backup, and hashes to verify all retained fields are unchanged. Arrays containing legacy map fields fail closed for manual review.

## Current production status

Read-only inventory of `manshyat-amar`, Standard edition, `(default)` database: **43 documents scanned; 15 affected documents / 15 obsolete fields**. Approved production cleanup completed on 2026-11-13: all 15 fields were removed from 15 documents. The final recursive scan verified zero obsolete fields remain. Every changed document passed the retained-field fingerprint check.

The currently deployed rules have been privately backed up and a surgical area-only candidate is prepared under ignored `.local-migrations/`. This candidate preserves existing production behavior instead of releasing unrelated staged resident-reliability changes. It passed four isolated emulator tests. The full staged rules passed 52 emulator tests; the migration helper passed three Node tests.

The user explicitly approved the production cleanup. The active release was rechecked against the reviewed baseline before deployment. Firebase compiled and released the surgical area-only patch successfully; unrelated staged features were not deployed. The migration then completed successfully with a private rollback backup at `.local-migrations/removed-area-fields-approved.json` (owner-read/write permissions only).

## Execution / future repeat procedure

After explicit production approval:

1. Re-read the active rules release and compare it with the backed-up release; stop/rebase if another deployment has changed it.
2. Deploy only the reviewed area-specific production candidate. Keep the staged full rules out of this deployment.
3. Run the inventory again, then `node scripts/remove-legacy-area-fields.mjs --project manshyat-amar --apply --backup .local-migrations/removed-area-fields.json`. A backup path must be new; files use private permissions and the directory is gitignored.
4. Confirm the post-migration scan reports zero obsolete fields. The script also verifies every changed document retained all other fields exactly. Record the final counts here.
5. Reload/rebuild updated clients. Older clients that still send the removed field must be updated; the new rules intentionally reject it.

No address strings, coverage selections, service status, IDs, ownership, or business timestamps are removed by this migration. Historical QA evidence may still describe old area filters; it is not an active schema.
