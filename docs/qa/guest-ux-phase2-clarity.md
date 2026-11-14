# Guest UX Phase 2 — simplification and clarity

7 November 2026. Scope: G04, G05, and G06 from [the original audit](guest-ux-audit.md). No Phase 3 implementation.

## Changes / before and after

| Finding       | Before                                                                                                               | After                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G04 — Home    | Brand/location, repeated welcome/location, eyebrow, oversized headline, explanatory paragraph, then search.          | Existing compact identity/location, one short prompt, then prominent search. Removed the duplicate welcome/location, eyebrow, and paragraph; retained the existing petroleum-blue search container, logo, font, categories, provider content, and secondary content.                                            |
| G05 — Search  | Provider service title appeared before provider name; result type depended mainly on the icon.                       | Provider name is primary and service title secondary. A compact “مقدم خدمة” or “قسم” label identifies each destination. Existing icons/routes remain. Provider names and service titles are not line-limited.                                                                                                   |
| G06 — Explore | Title/subtitle suggested an all-services view, although the page starts with categories. Home links said “عرض الكل”. | “أقسام الخدمات” with “اختار القسم وشوف الخدمات المتاحة”. Both Home links now say “كل الأقسام”, because both actually open Explore's category list. The short link is right-aligned and kept together with a nonbreaking space so Arabic words remain visible; its accessibility label retains ordinary spacing. |

Compact result labels were chosen instead of regrouping because the existing mixed ranked sequence can remain exactly intact. No sorting, matching, normalization, synonyms, limits, filters, or data-source logic changed. No empty group containers were introduced.

### Files touched by this phase

- `src/app/(tabs)/index.tsx`: introduction, result hierarchy/type labels, category-navigation labels, associated styles.
- `src/app/(tabs)/explore.tsx`: title/subtitle only.
- `src/features/discovery/components/DiscoveryUi.tsx`: SectionTitle action text alignment, keeping the short label together, explicit accessible action label. Phase 1 responsive grid logic unchanged.
- `__tests__/guest-clarity.test.tsx`: targeted clarity/navigation/order/empty/long-text coverage.
- `__tests__/guest-ux-fixes.test.tsx`: updated Home input-label expectations for the intentionally changed placeholder; Phase 1 assertions retained.
- This report and screenshots under `docs/qa/evidence/phase2/`.

Other work appeared concurrently in Provider Details and shared provider presentation while this task was running. It was preserved. Those changes are not part of this phase's implementation or claimed as its fixes.

## Exact Arabic copy changes

| Location                            | Old                                                | New                                     |
| ----------------------------------- | -------------------------------------------------- | --------------------------------------- |
| Welcome                             | أهلًا بيك في بلدك 👋                               | Removed                                 |
| Duplicate location under welcome    | منشأة العمار، طوخ، القليوبية                       | Removed there; retained in brand header |
| Hero eyebrow                        | أهلنا وجيرانا سند لبعض                             | Removed                                 |
| Hero heading                        | كل اللي محتاجه... قريب منك                         | بتدور على خدمة إيه؟                     |
| Introductory paragraph              | اعرف الخدمات القريبة منك وتواصل مع أصحابها بسهولة. | Removed                                 |
| Home search placeholder             | بتدور على إيه؟ سباك، دكتور، نجار...                | ابحث بالخدمة أو اسم مقدمها...           |
| Both Home category-navigation links | عرض الكل                                           | كل الأقسام                              |
| Search provider type                | No explicit text label                             | مقدم خدمة                               |
| Search category type                | No explicit text label                             | قسم                                     |
| Explore title                       | استكشف الخدمات                                     | أقسام الخدمات                           |
| Explore subtitle                    | كل الخدمات اللي ممكن تحتاجها في مكان واحد          | اختار القسم وشوف الخدمات المتاحة        |

Search buttons also expose destination labels to accessibility tools: `مقدم خدمة: {name}، {serviceTitle}` or `قسم: {categoryName}`. The bottom tab remains “استكشف”. Existing empty copy, filters, category names, and unrelated Arabic copy were not rewritten by this phase.

## Automated verification

- New clarity tests were run against the previous UI and failed before implementation. Phase 1 regressions were then run alongside the new tests.
- Full installed Jest suite: **35 suites / 330 tests passed**.
- TypeScript and ESLint: passed.
- Installed Prettier used for changed source, tests, and report.
- Tests cover destination-specific links, one location, removed introduction, exact ranked result order, both result destinations, preserved query, category-only/zero results, clear action, Explore filtering, and untruncated long Arabic provider-name/service-title fixtures.
- Existing Phase 1 tests remain passing: adaptive tile widths/scaling, query preservation/current-data recomputation, and missing/present/long descriptions.

## Actual emulator verification

Android 17/API 37, Pixel_10 / emulator-5554, current debug package `com.ahmedalianz.manshaetelammar`, guest session. Used ADB taps/swipes/hardware Back, visible UI dumps, screenshots, and write-only Arabic clipboard input. No prior clipboard contents were read. No public records were created or changed.

The current debug APK was installed to load the current source through Metro; no native source/configuration or dependency change was needed. Baseline: 1080 × 2424 pixels, density 420 (~411dp), font scale 1.0. Large-text configuration: density 480 (~360dp), scale 1.3. Both Light and Dark were exercised. Display settings were restored after checks.

| Journey/check                                                   | Actual result / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Home → “سباك” → provider → hardware Back                    | Passed after clean app restart. Correct provider opened; “سباك” and both result types remained on return. [Provider](evidence/phase2/clean-provider.png), [Back](evidence/phase2/passed-back-provider.json).                                                                                                                                                                                                                                                                                                                                                                                                            |
| B — Home category grid/result → category list → provider → Back | Passed. The category result opened plumbing, its card opened the provider, and two Back actions restored Home's query/results. [Category](evidence/phase2/passed-category.png), [provider](evidence/phase2/passed-category-provider.png), [return](evidence/phase2/passed-back-home.json). The direct grid path was also exercised after final restoration: [grid category](evidence/phase2/final-grid-category.png), [provider](evidence/phase2/final-grid-provider.png), [Back to Home](evidence/phase2/final-grid-back-home.json). Grid ordering/readability separately inspected at normal and enlarged text sizes. |
| C — Home “كل الأقسام” → Explore → filter → category → Back      | Passed. New title/subtitle displayed; selected “مهن وحرف” remained selected after the category visit. [Explore](evidence/phase2/explore-light-411.png), [return/filter](evidence/phase2/explore-return-filter.json).                                                                                                                                                                                                                                                                                                                                                                                                    |
| D — Mixed result types                                          | Both “مقدم خدمة” and “قسم” visible; provider name before profession; existing destinations opened. [411dp](evidence/phase2/clean-mixed-411.png), [360dp Dark](evidence/phase2/mixed-dark-360-no-keyboard.png), [360dp Light](evidence/phase2/mixed-light-360.png).                                                                                                                                                                                                                                                                                                                                                      |
| E — Empty search and clear                                      | “ززززز” displayed only the existing empty message, no empty type headings; clear restored the field/categories. [Empty](evidence/phase2/empty-home-search.png), [cleared](evidence/phase2/clear-empty-home.json).                                                                                                                                                                                                                                                                                                                                                                                                       |
| Home content hierarchy                                          | Search directly below identity; categories/provider content higher than original audit. [Final Light baseline](evidence/phase2/final-home-light-411.png). Compare [audited Home](evidence/48-final-home.png).                                                                                                                                                                                                                                                                                                                                                                                                           |
| Explore appearance                                              | New title describes categories in Light/Dark, including wrapping at 360dp/130%. [Dark large text](evidence/phase2/explore-dark-360.png), [Light large text](evidence/phase2/explore-light-360.png).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Phase 1 visual preservation                                     | Two-column large-text tiles retained with full Arabic category words and natural wrapping; baseline four columns retained. [Large-text categories](evidence/phase2/categories-light-360.png). No font-scaling cap or meaningful-name truncation added.                                                                                                                                                                                                                                                                                                                                                                  |

Screenshots may include other chats' completed provider-presentation changes. They are evidence of the integrated workspace, not attribution of those edits to this task. The original audit/Phase 1 captures supply the before comparison; early captures in this folder showing setup errors, an old installed build, or startup are not passing regression evidence.

Final full-label checks: [360dp Light](evidence/phase2/final-home-light-360.png), [360dp Dark](evidence/phase2/final-home-dark-360-confirmed.png). The emulator ended at density 420 / font scale 1.0 in Light mode.

## Limitations and scope confirmation

- One Android emulator, not a physical device or iOS. No release-build, TalkBack, predictive/edge-gesture, or exhaustive touch-target/contrast certification.
- The emulator used a floating hardware-keyboard toolbar. Arabic entry/paste, clearing, tapping results with input active, and hardware keyboard dismissal were exercised; a full phone keyboard's occlusion/layout remains unverified.
- Long provider names/professions were tested in isolated component fixtures, not injected into public data. Actual mixed results used the available plumber; category labels supplied the long Arabic device-layout cases.
- A Fast Refresh session initially produced “The imperative router is unavailable before the first render has finished.” That attempt was not counted as passing. Clean force-stop/relaunch navigation passed. Router initialization was not changed as part of this UX scope; release-build reproduction remains outside these results.
- Development warning overlays were dismissed where possible; Android clipboard notifications are OS UI. Neither is treated as a production UI finding.
- No Firebase writes/rules, authentication/admin/provider-management implementation, new dependencies, all-provider browsing mode, search API, ranking changes, palette replacement, or bottom-navigation change was introduced by this phase.
- This phase did not implement G03, G08, G09, or G10. Concurrent changes belonging to another chat were preserved, not reverted or expanded. No Phase 3 work was undertaken.
