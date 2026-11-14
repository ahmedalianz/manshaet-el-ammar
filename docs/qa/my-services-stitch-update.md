# My Services — Stitch design update

10 November 2026. Reference: Stitch project `2475157814755974565`, screen `facf52e5f7854a2a857da788651e4de8` (خدماتي — لوحة الخدمات).

Implemented the reference's compact header, add-service overview, horizontal status filters, redesigned status cards, and support footer. Kept Arabic headings, IBM Plex Sans Arabic, the current petroleum-blue Light/Dark palettes, natural text wrapping, and existing bottom navigation.

## Functional behavior

- Counts come from the signed-in owner's existing listings. Each listing occupies one filter group: published, pending (including proposed edits), needs changes, or unpublished. All still shows every logical service once.
- Published data and pending edits remain distinct. Rejection reasons, resubmission, comparison, edit, and published-preview routes retain their existing behavior. Pending new submissions and unpublished listings retain existing action restrictions.
- A filter with no matches offers reset-to-all; an account with no listings keeps its first-service recovery screen. Existing loading, error notice, and pull-to-refresh behavior remain.
- Account button opens the existing profile; support opens the existing support action. No new backend operations or authentication changes.
- Used category icons rather than invented business photos. Omitted unbacked analytics totals, review-time promises, notifications, and empty overflow menus. No new dependencies.

## Changed implementation

- `src/app/(tabs)/my-services.tsx`
- `src/features/provider/MyServiceCard.tsx`
- `__tests__/my-services-design.test.tsx`

## Verification

- Full Jest run: **41 suites / 366 tests passed**.
- TypeScript: passed.
- ESLint on changed source/test files: passed.
- Prettier on changed files: passed.
- Full repository ESLint: passed on final verification. No admin files were edited for this task.
- Six focused tests cover status counts/filtering, proposal and preview routes, rejection explanations, add/account/support actions, filter-empty recovery, and guest/empty-account behavior. Existing accessibility/status tests remain passing.
- Android emulator, ~411dp / normal text: checked the current signed-in account's empty screen in [Light](evidence/my-services-design/empty-light.png) and [Dark](evidence/my-services-design/empty-dark.png). Restored Light afterward. No account switching, service submission, or record mutation was performed.

Populated states were verified with isolated fixtures, not real owner listings on the emulator: the current account has none. Populated-device layout, enlarged system text, physical devices, and iOS remain unverified. This is not a claim of pixel-perfect rendering for those environments.
