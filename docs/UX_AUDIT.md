# UI/UX Audit — منشأة العمار

**Scope:** Read-only audit of the current workspace on 2026-11-03. No app behavior was changed. Evidence is from source code, route inventory, `README.md`, and static checks. No simulator/device or Stitch reference screens were available for visual review.

## Executive Summary

The app has a coherent Arabic-first foundation: Expo Router routes are grouped clearly, IBM Plex Sans Arabic and shared color/spacing/type tokens exist, RTL is configured in `app.json`, and public discovery, provider forms, service states, and admin detail screens are represented in code. Search handles Arabic diacritics and common Alef variants. Mock-only behavior is often disclosed clearly.

The largest weakness is an incomplete merge between two provider state implementations. Account and admin screens expect account, role, request, report, and moderation APIs that the mounted `ProviderContext` does not expose. `npm run typecheck` fails with 33 TypeScript diagnostics, and the admin role cannot be resolved by the mounted context. This blocks a reliable review of the provider-to-admin journey and should be fixed first.

The main product gap is that the defining resident action—calling or messaging a provider—is deliberately disabled in the current mock. Other opportunities are smaller: improve muted-text contrast, add an Android-friendly clear-search action, clarify filtered empty results, and align hardcoded spacing with the existing tokens. Avoid a redesign or a larger component system.

## Findings

Effort is S / M / L. “Design change” means a visible UI or copy change. “Behavior change” means user-visible behavior changes. “Before Firebase” indicates whether to resolve the issue before any real backend work.

| ID / Priority | Screen or component; evidence | Issue and user impact | Recommended fix | Effort | Design change | Behavior change | Before Firebase |
|---|---|---|---|---|---|---|---|
| F-01 / **P0** | Account and admin state: `src/features/provider/ProviderContext.tsx` (`ProviderState`, provider value); `src/features/provider/moderation.ts`; `src/app/provider/sign-in.tsx`; `src/app/(tabs)/more.tsx`; `src/app/account/profile.tsx`; `src/app/admin/**` | **Confirmed integration/build issue.** The mounted context exposes `userId`, `listings`, `publicProviders`, `signIn`, `signOut`, and `submit`; More/Profile/Admin consume `account`, `role`, account update, moderation lists/actions, and counters that are absent. The sign-in UI offers only empty-provider and listings-provider profiles, not the admin profile declared in the types; the context also only sets an ID and does not establish a role. A second mock moderation model exists in `moderation.ts` but is not wired to the context. `npm run typecheck` reports 33 errors, including these missing properties and an additional incompatible `flatMap` result in `moderation.ts`. This makes account/admin behavior unreliable and prevents the project’s typecheck from passing. | Choose one mock-state contract, connect it consistently to context, sign-in, submissions, account, and admin routes, then remove or reconcile the unused competing model. Preserve explicit demo-only copy. | M | Yes | Yes | **Yes** |
| F-02 / **P1** | Provider detail: `src/app/provider/[id].tsx` contact section and bottom bar | The primary contact actions are disabled, and the report action only opens an “unavailable” alert. This is accurately disclosed as demo data, but residents cannot complete the advertised discovery-to-contact journey in a real listing build. | Keep demo numbers inert. Before real listings launch, enable phone/WhatsApp actions only for valid saved contact data and make reporting submit a real report; retain useful fallbacks for missing contact fields. | M | Small | Yes | **Yes** |
| F-03 / **P1** | Mock persistence: `src/features/provider/ProviderContext.tsx`; disclosures in `src/features/provider/ServiceForm.tsx`, `src/app/provider/success.tsx`, and `README.md` | Provider session selection and listing changes are in-memory and reset on JS reload. The UI discloses this, so it is not a misleading mock, but a submitted listing does not reach a volunteer reviewer or survive a restart. The profile editing UI is not currently wired to this context (F-01). The flow is suitable for a demo, not a community service launch. | Treat the local flow as prototype-only. Before launch, connect submission, account ownership, moderation, and public approved-only reads to the selected persistence layer; preserve consent and clear pending/rejected states. | L | Yes | Yes | **Yes** |
| F-04 / **P2** | Search: `src/features/discovery/components/DiscoveryUi.tsx` `SearchInput`; `src/app/(tabs)/index.tsx`; `src/app/(tabs)/explore.tsx`; `src/app/category/[id].tsx` | `clearButtonMode="while-editing"` is the only clear affordance. It is platform-specific and does not give Android users an equivalent visible clear action. Clearing a search can require repeated backspaces, especially for older users. | Show a labeled clear control while the query is non-empty on all platforms; keep focus behavior predictable after clearing. | S | Small | Yes | No |
| F-05 / **P2** | Category results: `src/app/category/[id].tsx`, especially `visibleProviders` and `ListEmptyComponent` | The empty message says “مفيش خدمات في القسم ده” even when search or area filtering removed otherwise available providers. It can make users think the category itself has no listings. There is no explicit reset action beside the active query/filter. | Use a no-matching-results message when a query or area is active, and provide a one-tap way to clear/reset those filters. Keep a separate empty-category message when the category truly has no approved providers. | S | Small | Yes | No |
| F-06 / **P2** | Theme/text contrast: `src/theme/colors.ts` `muted`; `src/theme/typography.ts` `caption`; uses across discovery, provider cards, and account | The muted color `#6F7975` on the app background `#F0FCF8` is **4.28:1** (computed from the defined hex colors), below the usual 4.5:1 target for normal text. This affects many 14sp captions and secondary labels. On white it is 4.50:1, so the contrast concern depends on the surface. | Darken the existing muted token slightly or use the existing text-secondary token for small copy on tinted surfaces; recheck each actual foreground/background pair. | S | Small | Yes | No |
| F-07 / **P2** | Shared spacing: `src/features/provider/ProviderPage.tsx`, `src/features/provider/ServiceForm.tsx`, and screen styles alongside `src/theme/spacing.ts` | A spacing token scale exists, but provider page/form styles use repeated literal values such as 20, 22, and 32 while other screens use token values. This creates avoidable rhythm differences between provider, discovery, and account screens. | Reuse the existing spacing tokens where they match; add no new token unless the same distinct value is truly repeated and needed. | S | Yes | No | No |
| F-08 / **P2** | About/privacy/contact and optional location/report actions: `src/app/(tabs)/more.tsx`, `src/features/provider/ServiceForm.tsx`, `src/app/provider/[id].tsx` | The informational entries and optional map/report actions show “not available/coming soon” alerts rather than opening a page or completing an action. They are honest placeholders, but their menu/button affordance still spends a tap without helping the user. Actual About, Contact, Privacy, and Terms pages are not present in the route tree. | For this phase, either remove the nonessential menu entries or make them visibly unavailable. Add real informational pages and report behavior only when their content and destination are ready. | S | Yes | Yes | Before public launch |
| F-09 / **P2** | Sign-in return routing: `src/app/provider/join.tsx`, `src/app/(tabs)/more.tsx`, and `src/app/provider/sign-in.tsx` | Callers pass `next: 'more'` (and other values), but sign-in only handles `next === 'add'`; every other value replaces the screen with My Services. A user entering from More is moved away from the page they started on. | Use a small explicit allowlist of supported return destinations and honor it, or stop passing unused values and consistently route to My Services. | S | No | Yes | No |
| F-10 / **P2** | Discovery ranking: `src/features/discovery/search.ts` `searchDirectory` | Quick search concatenates category matches before provider matches and truncates the combined list to six. A provider that closely matches the query can appear below broad category matches or be omitted when enough categories match. | Rank exact provider/category-name matches ahead of broad description/keyword matches, or keep separate clearly labeled groups with a short result limit. Validate with Arabic examples already in fixtures. | S | Small | Yes | No |
| F-11 / **P2** | Home trust copy: `src/app/(tabs)/index.tsx` hero text | “بكل بساطة وأمان” implies a safety assurance, while the app explicitly says it does not verify provider identity, qualifications, availability, or service quality. | Replace “وأمان” with a neutral ease-of-use phrase and keep the direct-contact/community-directory limitation visible where appropriate. | S | Small | Yes | **Yes** |

No P3 findings were added; cosmetic-only issues are lower value until the state model and core contact flow are settled.

## Design System Inconsistencies

- **Typography:** IBM Plex Sans Arabic is loaded in Regular, Medium, SemiBold, and Bold and exposed through shared typography tokens. Most audited screens use those tokens. Several local styles override line heights or use hardcoded font sizes, so consistency should be reviewed during the spacing pass; there is no evidence supporting a font replacement. Native text scaling is not explicitly disabled, but expanded-font layouts were not visually checked.
- **Spacing:** `src/theme/spacing.ts` defines 4, 8, 16, 24, 32, and 40. Some provider styles use 20 and 22 literals, while discovery/account screens mostly consume tokens. Safe-area handling is present on main screens and bottom tabs, though form/modal layouts still need device review.
- **Colors:** Emerald primary and surface colors are reused consistently. Muted text on the tinted app background is the confirmed contrast exception (F-06). Success/status colors are not centralized; current listing states rely mainly on surface, beige, and red backgrounds, so badge distinction should be checked with real contrast and grayscale/accessibility settings before revising colors.
- **Components:** Shared `BackHeader`, `SearchInput`, `CategoryCard`, `ProviderCard`, `FormField`, `ProviderAction`, `AccountMenuRow`, and admin summary components exist. Extraction is not the priority; repair the shared provider/account state contract first.

## User Journey Findings

### Public discovery

- Home, Explore, category details, and provider detail routes exist. Categories and providers are mock data; provider cards link to details, and category details support search and area filters.
- Search normalizes Arabic diacritics/tatweel and common Alef variants (`src/features/discovery/search.ts`). It does not normalize Arabic/Persian digit forms for directory search, though phone form validation separately handles them. No search dependency is needed for current data sizes.
- Search feedback exists for empty matches. The category empty message conflates an actually empty category with a filter miss (F-05); Android has no explicit clear control (F-04).
- Detail screens expose visible copy-phone behavior, while call and WhatsApp actions are disabled with demo notices. This is intentional for the fixture data and must be revisited before real listings are used (F-02).

### Provider

- Join → demo sign-in → two-step form → success → My Services is represented. The form orders basic identity/service information before contact/location, supports optional description and WhatsApp same-as-phone, uses native phone-pad input, requires public-display consent, validates before advancing/submitting, and guards against accidental navigation. These are strong foundations for a small Android device.
- Submitted state and sign-in are in-memory demo state. They reset after reload and do not enter a durable moderation queue (F-01/F-03). No actual network pending/error state is appropriate for the current synchronous local fixture flow; the busy label and catch path are present in the form.
- My Services displays empty, pending, rejected, published, and published-with-pending-edits examples. The dedicated fixtures include rejected edits/unpublished admin data, but the mounted provider context does not supply all the role/account/admin state expected by the newer screens. Do not infer that every fixture state is reachable through the UI today.

### Admin

- Dashboard, request detail/comparison, published service detail, and report detail route files exist. They include pending counts, comparison fields, rejection reason input, confirmation alerts, unpublish confirmation, and report closure UI.
- The route UI depends on state and actions absent from `ProviderContext`; the mounted sign-in also does not expose a role. Therefore moderation is not operational end-to-end in the present workspace, and static typecheck fails (F-01). There is no evidence of dynamic counters or duplicate-action behavior at runtime because this integration is incomplete.
- A single-admin compact queue is a suitable scope. No dashboard analytics or extra moderation features are warranted.

### Account

- Guest/provider/admin variants, profile edit form, read-only email, sign-out confirmation, and admin-only menu entries are represented in UI code.
- Account fields/update callbacks are absent from the mounted context, so these flows currently contribute to typecheck errors and are not confirmed as working. “Reset password” and info pages are explicitly labeled unavailable rather than claiming success. Sign-in does not honor the `more` return destination (F-09).

## Missing and Incomplete Functionality

| Area | Current state | Classification |
|---|---|---|
| About, Contact, Privacy, Terms | Menu rows exist; handlers display unavailable alerts. No corresponding routes found. | Incomplete functionality, clearly disclosed (F-08). |
| Phone/WhatsApp contact | Values are examples; buttons are disabled, copy is marked as demo. | Deliberate mock limitation; required before public directory use (F-02). |
| Report listing | Detail view is present, but public “report” action only explains that it is unavailable. | Incomplete functionality (F-08). |
| Map/location | Optional control displays a coming-soon message; no permission is requested. | Incomplete optional functionality. |
| Real sign-in, account persistence, service persistence, moderation | Dev-only mock flow; data resets when the JS app reloads. README says Firebase is prepared but no project is connected and no moderation occurs in this phase. | Deliberate mock limitation; not a Firebase UX defect. |
| Admin role and state contract | Admin UI exists but its expected context fields/actions are not provided. | Confirmed integration defect (F-01). |
| Offline/retry/network states | No network-backed screen path exists in the current mock state. | Not applicable to local operations; define these states with future network-backed reads/submissions. |
| Tests | No test files/specs and no test script were found. | Missing verification coverage, not a runtime finding. |
| Stitch reference screens | No Stitch exports or design reference files were found; only app icon and splash assets are present. | Visual comparison unavailable. |

## Missing UI States

- **Loading:** App font/splash loading is handled in the root layout. Form submission shows busy text and disables submit. No skeleton loaders are justified for the local operations.
- **Empty:** Home does not render a special empty-provider state if all demo providers are absent; Explore and My Services have empty states; category details have a generic empty state whose wording needs correction (F-05).
- **Error/retry:** Form catches submission errors and displays inline text; invalid category/provider records show not-found style states. There is no retry control for local operations, which is reasonable. No network failure state exists because no network request backs these screens.
- **Success:** Provider submission confirmation is explicit that it is simulated and local.
- **Access denied:** Admin guard has a denial message, but its role source is missing from the mounted context; the denied/success paths are not runtime-validated.
- **Offline:** Do not show “offline” for synchronous mock actions. Add network unavailable, retry, and submission-pending states when a real service is introduced.

## Accessibility & RTL

- `app.json` enables forced Arabic RTL for iOS/Android. Most Arabic text sets `writingDirection: 'rtl'`; phone and email display use LTR handling, and phone detail wraps digits with directional isolates. These are good code-level choices.
- Buttons generally include roles/labels; filters expose selected state; form errors use polite live regions. Some icon controls rely on adjacent text rather than additional labels, and the custom category selector could be checked with TalkBack/VoiceOver.
- Common button/card targets are around 48–56px; category filter chips are 40px high. Verify small targets and tab bar behavior on Android at 360px width.
- Confirmed contrast concern: F-06. Text scaling and mixed Arabic/English wrapping are code-level risks only; no device/simulator visual validation was performed at 360, 390, or 412px.
- Back icon direction looks intentionally selected for an RTL screen (`arrow-right`), but should be checked with Android system back and iOS navigation gestures.

## Performance

- Current lists are small local fixtures. `FlatList` is used for category detail and My Services; scroll screens are modest. No evidence justifies FlashList or broad memoization.
- Explore memoizes category filtering, but category/provider search scans small in-memory arrays. There is no material performance concern at current data sizes.
- Home and admin screens use scroll containers for small datasets; no measured render issue was found. Revisit list virtualization only if real data volume grows.
- No heavy image collections or animation dependency were found. The splash/image implementation and native RTL configuration still need device validation.

## Quick Wins

1. Repair the mounted mock state contract until `npm run typecheck` passes (F-01).
2. Improve muted text contrast on tinted backgrounds (F-06).
3. Add a cross-platform search clear action and context-aware empty result copy (F-04/F-05).
4. Replace the unsupported “وأمان” claim with neutral copy (F-11).
5. Replace repeated provider spacing literals with matching existing spacing tokens (F-07).

## Deferred Improvements

- Real phone/WhatsApp launch, public reporting, and backend persistence belong to the product release work that enables real listings; do not fake these for the current mock (F-02/F-03).
- Real privacy/terms/contact content should be written before exposing the service publicly. Until then, reduce placeholder menu taps (F-08).
- More advanced ranking, map selection, illustrations, animations, and larger-list optimizations can wait. Current code offers no evidence that added libraries or decorative motion are needed.

## Implementation Roadmap

| Order | Scope | Likely files | Acceptance criteria | Regression risks | Tests/checks |
|---|---|---|---|---|---|
| A — Restore one working mock contract | Reconcile provider context, demo profiles, account state, provider submissions, and admin actions. Keep the mock disclosure and existing screens. | `src/features/provider/ProviderContext.tsx`, `types.ts`, `moderation.ts`, `src/app/provider/sign-in.tsx`, `src/app/(tabs)/more.tsx`, `src/app/account/profile.tsx`, `src/app/admin/**` | Typecheck is clean; dev sign-in can select provider/admin; account fields render; submission appears in My Services and admin queue; approval/rejection/report/unpublish update counters and public visibility once; production build still blocks mock-only writes. | Ownership leaks between demo profiles, duplicate requests, public exposure of pending/rejected listings, role visibility. | Typecheck; focused transition tests for submit/approve/reject/unpublish/report; smoke each role and all service states. |
| B — Shared system/accessibility consistency | Correct small-text contrast and reuse current spacing tokens. | `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/features/provider/ProviderPage.tsx`, `src/features/provider/ServiceForm.tsx`, audited screens using muted captions | Defined text/surface pairs meet contrast target; provider screens follow existing spacing rhythm; no font is replaced; text remains readable with system font scaling. | Contrast can regress on beige/container surfaces; token substitution can change compact form fit. | Contrast calculation for used pairs; lint/typecheck; visual review at 360/390/412px and large text. |
| C — Core discovery and community journeys | Clarify search clearing/empty states/ranking and decide launch behavior for contact/report; honor sign-in return destination. | `src/features/discovery/components/DiscoveryUi.tsx`, `src/features/discovery/search.ts`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/explore.tsx`, `src/app/category/[id].tsx`, `src/app/provider/[id].tsx`, `src/app/provider/sign-in.tsx`, `src/app/(tabs)/more.tsx` | Search clear works on iOS/Android; result-empty copy reflects active filters; provider matches are not hidden by broad categories; provider/public contact controls reflect real vs demo data accurately; return navigation is consistent. | Changed sort order may alter the first visible results; launch contact actions must not use fixture numbers. | Unit cases for Arabic normalization/ranking; manual search/filter/reset/contact/back navigation on Android and iOS. |
| D — Final polish and information completeness | Remove or complete placeholder menu actions; validate motion/press feedback only where current interactions need it; run RTL/accessibility/device pass. | `src/app/(tabs)/more.tsx`, `src/app/provider/[id].tsx`, `src/features/provider/ServiceForm.tsx`, shared controls/styles | Every visible menu/action either works or is clearly unavailable without a dead-end tap; no unsupported trust copy; screen reader labels/states and safe areas are verified. | Adding incomplete info pages or extra motion increases maintenance without helping core use. | TalkBack/VoiceOver pass; reduced motion; device/simulator review at target widths; final lint/typecheck and existing tests. |

## Verification Performed

- Read the app route tree, shared UI/theme, discovery and provider flows, moderation/account/admin code, mock data, and README.
- Confirmed Expo major version **58** from `package.json` and consulted the matching versioned Expo SDK reference and Expo documentation index. No Expo API changes were proposed.
- `npm run lint` — **passed**.
- `npm run typecheck` — **failed** with **33 TypeScript diagnostics**, primarily because account/admin screens consume properties and callbacks absent from `ProviderContext`, plus one moderation `flatMap` type error.
- Automated tests — none found; no test script is defined.
- Device/simulator and screenshot validation — not performed. Visual wrapping, touch targets, keyboard behavior, TalkBack/VoiceOver, contrast in context, and the 360/390/412px layouts remain to be checked on real devices or simulators.
