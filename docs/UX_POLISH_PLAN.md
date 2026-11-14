# UI/UX Polish Implementation Plan

This plan is based on the source audit in [`UX_AUDIT.md`](./UX_AUDIT.md). It is intentionally limited to fixes supported by the current screens and state model. No new UI framework, animation dependency, or redesign is planned.

## Phase A — Critical State and Typecheck Fixes

**Scope**

- Reconcile the two mock provider state models into one interface used by context, forms, account pages, and admin pages.
- Supply the account, role, moderation lists, counters, and action callbacks that the mounted screens expect, or update the screens to the single selected contract.
- Make demo provider/admin selection work in development while keeping mock-only submission/moderation blocked and clearly disclosed in production.
- Preserve private pending/rejected submissions, approved-only public listings, ownership checks, and the current transparent reload-reset behavior.
- Fix the moderation reducer/type issue so that subsequent checks can run cleanly.

**Likely files**

- `src/features/provider/ProviderContext.tsx`
- `src/features/provider/moderation.ts`
- `src/features/provider/types.ts`
- `src/features/provider/listingState.ts`
- `src/features/provider/fixtures.ts`
- `src/app/provider/sign-in.tsx`
- `src/app/(tabs)/more.tsx`
- `src/app/account/profile.tsx`
- `src/app/admin/index.tsx`
- `src/app/admin/request/[id].tsx`
- `src/app/admin/service/[id].tsx`
- `src/app/admin/report/[id].tsx`
- `src/features/admin/AdminUi.tsx`

**Dependencies**

- None. This is the prerequisite for reviewing and changing account/admin behavior.
- Keep the local implementation in-memory; Firebase integration is out of scope for this polish phase.

**Acceptance criteria**

- `npm run typecheck` passes with no errors.
- A dev provider can submit, view, edit, and resubmit their own listings; rejected/pending/published/pending-edit states are reachable and understandable.
- A dev admin can review a new request, compare an edit, approve/reject once, unpublish a published listing, and close a report; counters and public listing visibility update accordingly.
- Switching roles cannot expose another demo provider’s private requests or modify another owner’s listings.
- Production behavior continues to describe mock limitations honestly and does not imply real authentication or moderation.

**Regression risks**

- A state migration can accidentally publish a pending or rejected listing, duplicate an approved service, clear a pending edit, or leak fixtures across demo accounts.
- Confirmations must not claim a real reviewer or backend accepted an action.

**Tests required**

- Add focused unit tests for submit, resubmit, approve, reject, pending edit replacement, unpublish, report close, and owner/admin access checks.
- Run TypeScript and lint checks.
- Smoke the provider, admin, and guest flows in a development build or simulator.

## Phase B — Design System and Accessibility Consistency

**Scope**

- Adjust the muted text treatment so normal-sized captions meet contrast on the actual tinted surfaces where they appear.
- Replace repeated provider/form spacing literals with existing spacing values when the visual rhythm matches.
- Check selected, disabled, error, pending, rejected, and published states for clear text and color distinctions.
- Preserve IBM Plex Sans Arabic and system font scaling.

**Likely files**

- `src/theme/colors.ts`
- `src/theme/spacing.ts` (only if an existing token cannot represent a repeated value)
- `src/features/provider/ProviderPage.tsx`
- `src/features/provider/ServiceForm.tsx`
- `src/features/provider/MyServiceCard.tsx`
- `src/features/discovery/components/DiscoveryUi.tsx`
- `src/features/account/AccountMenuRow.tsx`
- Any screen using muted captions on `background`, `surfaceLow`, or `surfaceContainer`

**Dependencies**

- Phase A should pass typecheck first so the app can be previewed consistently.

**Acceptance criteria**

- All defined text/surface pairs used for normal body/caption text are checked and meet the selected contrast target.
- Provider forms, detail screens, and account menus use a consistent spacing rhythm without cramped content at 360px width.
- IBM Plex Sans Arabic remains loaded in the same weights; text still wraps with system font scaling enabled.

**Regression risks**

- Darkening shared muted text can make secondary hierarchy feel too strong.
- Replacing 20/22px gaps with a nearby token can make some forms feel either loose or cramped.

**Tests required**

- Contrast checks for foreground/background pairs.
- Lint and typecheck.
- Visual pass at 360, 390, and 412px with normal and enlarged text.

## Phase C — Core Discovery and Provider Journey

**Scope**

- Add an explicit cross-platform clear-query action.
- Differentiate truly empty categories from no matches caused by a query or selected area, with a direct reset action.
- Improve search ordering so exact provider matches are not routinely hidden behind broad category matches; use current mock examples and Arabic normalization.
- Honor the supported sign-in return path consistently.
- Before real listings are used, enable contact/report actions only with real data and an actual report destination. Keep demo fixture contact disabled.
- Retain the existing two-step form, consent, validation, and data preservation behavior.

**Likely files**

- `src/features/discovery/components/DiscoveryUi.tsx`
- `src/features/discovery/search.ts`
- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/explore.tsx`
- `src/app/category/[id].tsx`
- `src/app/provider/[id].tsx`
- `src/app/provider/sign-in.tsx`
- `src/app/provider/join.tsx`
- `src/features/provider/ServiceForm.tsx`
- `src/app/(tabs)/more.tsx`

**Dependencies**

- Phase A for a usable dev profile and current route behavior.
- Real phone/WhatsApp calls, report submission, and offline handling depend on a later approved backend/data contract; do not fake these in the local mock.

**Acceptance criteria**

- Android and iOS users can clear active search in one tap; focus behavior is sensible.
- A no-match state explains whether query/area filters caused it and offers reset.
- Common Arabic query cases find the intended providers and do not truncate exact matches behind broad categories.
- Sign-in from More and Join returns to a predictable destination.
- Demo numbers remain non-callable and visibly marked; real contact controls are only enabled when backed by valid listing data.

**Regression risks**

- Search ranking changes which listings appear first.
- Filter reset must not unexpectedly erase the user’s query when only the area should reset (or vice versa).
- Phone formatting and WhatsApp number differences need to survive normalization and display.

**Tests required**

- Unit tests for Arabic normalization and ranking, including Alef variants, diacritics, and mixed numbers.
- Lint and typecheck.
- Manual search, filter, clear, provider detail, and back-navigation pass on Android and iOS.
- If real contact/report services are introduced later, test invalid numbers, missing WhatsApp, app unavailable, offline submission, retry, and duplicate prevention.

## Phase D — Premium Polish and Content Completion

**Scope**

- Replace unsupported safety wording with accurate community-directory copy.
- Remove or visibly mark informational/action placeholders until they have real destinations; add concise About, Contact, Privacy, and Terms content when approved.
- Check press states, icon sizes, directional affordances, keyboard/safe-area behavior, screen reader labels, and modal/dialog flow. Add only subtle interaction feedback where the current control lacks it; do not animate all controls.
- Run final small-screen and accessibility verification.

**Likely files**

- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/more.tsx`
- `src/app/provider/[id].tsx`
- `src/features/discovery/components/DiscoveryUi.tsx`
- `src/features/provider/ServiceForm.tsx`
- `src/features/admin/AdminUi.tsx`
- New information routes under `src/app/` only once content/destinations are ready

**Dependencies**

- Phases A–C for stable core behavior.
- Privacy, terms, and contact page content must be supplied/approved before those pages are presented as complete.

**Acceptance criteria**

- No copy implies provider identity, qualification, availability, quality, or user safety is guaranteed.
- Every visible button or menu row works or clearly explains why it is unavailable before the tap.
- TalkBack/VoiceOver can identify primary actions, current filter selection, form errors, and service status.
- No overlap or clipped text is found at 360, 390, and 412px with enlarged text and Android system back enabled.
- Motion is brief and purposeful; reduced-motion settings are respected if motion is added.

**Regression risks**

- Adding information routes without final content creates new maintenance and trust risks.
- Platform alert/modal behavior differs; confirm on Android and iOS before replacing existing dialogs.
- Avoid making a control look enabled if its action still cannot complete.

**Tests required**

- Final lint and typecheck; all focused tests from prior phases.
- TalkBack and VoiceOver smoke pass, large-font pass, keyboard open/submit/back pass, and device/simulator layout pass at target widths.

## Suggested Order

1. Phase A — restore a single working state contract and a passing typecheck.
2. Phase B — correct contrast and spacing while the UI is stable.
3. Phase C — reduce discovery friction and define which contact/report behaviors belong to the later real-data release.
4. Phase D — settle copy, placeholder destinations, and final device accessibility details.

Keep each phase as a separate reviewable change. Do not install dependencies or integrate Firebase as part of this polish plan.
