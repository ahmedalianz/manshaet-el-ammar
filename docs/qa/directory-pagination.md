# Directory pagination and complete search

## Behavior

- Global public providers use 100-record pages; category queries use 50-record pages. These are request sizes, not result limits.
- Ordering is publishedAt descending followed by document ID descending. Continuation uses startAfter with the last document snapshot, preserving the tie-breaker when timestamps match. A full page has a continuation; an empty terminal request handles exact page-size boundaries.
- TanStack infinite queries retain loaded pages and deduplicate IDs. Separate paginated cache keys prevent old single-array caches from being interpreted as pages during hot reload.
- Browse screens expose Load More. An active text search or Discover filter automatically traverses remaining pages using the unchanged Arabic matching functions. Clearing the search/filter or leaving the focused screen stops scheduling further pages; an in-flight read can finish into the shared cache.
- Failed pages retain earlier records, stop the automatic scan, show an explicit incomplete-results message, and allow retry at the same cursor. No definitive zero-result state is rendered before completion.
- Loaded services, total public services and matching services are labeled separately. Total counts use getCountFromServer on the same ordered/filter-constrained query without a limit or cursor. If that query fails, the UI says the total is unavailable rather than using the loaded count as a total. Category totals are explicitly labeled as category totals.
- Home remains a six-suggestion preview and links to full results with the exact query. Incoming search requests clear stale Discover filters and do not overwrite edited search state merely when returning from details.

No Firestore records, schema, rules or indexes were changed. Public collection mapping and contact validation remain unchanged. Existing count queries and pages share the public cache invalidation prefix.

## Implementation

Repository: src/features/provider/firebaseRepository.ts
Global page state/count: src/features/provider/ProviderContext.tsx
Category page state/count: src/features/discovery/firebaseQueries.ts
Search scan/progress/retry controls: src/features/discovery/DirectoryPagination.tsx
Consumers: Home, Explore and category screens.

## Verification

TypeScript and lint passed. Complete suite: 48 suites / 419 tests passed.

New coverage exercises older matches after record 100 and category record 50, document-snapshot cursors for equal timestamps, empty terminal pages, constrained category counts, duplicate removal, failed-page retry, stopping after clear/blur, resuming on focus, explicit unknown totals, partial vs exhaustive result labels, and Home's full-results query handoff.

Read-only Android smoke checks after reloading the updated bundle:
- Discover displayed loaded 3 / directory total 3.
- Plumbing displayed loaded 1 / category total 1.

Screenshots: evidence/directory-pagination-live-count.png and evidence/category-pagination-live-count.png.

## Limits

The existing substring/Arabic search remains client-side. Its first uncached search reads all remaining public pages; subsequent queries reuse the cached corpus. Large directories therefore incur reads and memory proportional to the public records, with explicit progress rather than silently truncated results. No indexed text-search backend was added.

Counts and paged reads are separate server operations, not an atomic snapshot. Concurrent additions/deletions can temporarily differ from a cached count; refresh uses the existing query invalidation/refetch flow. Multi-page boundaries were verified using controlled test fixtures, not by creating production records. No large-directory performance or offline device matrix was run manually.

Documentation used: https://firebase.google.com/docs/firestore/query-data/query-cursors and https://firebase.google.com/docs/firestore/query-data/aggregation-queries .
