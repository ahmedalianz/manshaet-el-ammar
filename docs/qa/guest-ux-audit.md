# Guest UX audit — منشأة العمار — بلدنا أقرب

Audit date: 7 November 2026. Scope: guest browsing only. No fixes applied.

## A. Executive Summary

An ordinary resident can browse without signing in, find the available plumber, open the listing, and reach the phone dialer or WhatsApp browser landing page. The tested contact actions work. Search recognizes the tested Arabic profession synonyms, extra spaces, and an Arabic spelling variation. Guest navigation shows Home, Explore, and More; My Services is correctly hidden.

This is a **conditional readiness assessment, not a public-release sign-off**. The most material confirmed problem is category readability at 360dp with 130% system text: the four-column Home grid breaks Arabic words and clips parts of labels. Home search also clears its query after opening a result, making comparison harder. The design repeatedly spends space explaining the directory instead of helping residents choose a provider. Provider Details renders a large, effectively empty “عن الخدمة” section for the tested listing.

Fix the small-screen category labels before release. Preserve search context next. Simplifying Home and Provider Details would improve speed without adding features. No P0 was observed; the tested online plumber task was not blocked. Uncached network failure, a production build, native WhatsApp, and screen-reader operation remain release-verification gaps.

## B. Testing Method

### Actual UI testing

Used the running Android development app through ADB taps, swipes, hardware Back events, accessibility hierarchy dumps, and screenshots. Arabic queries were pasted through the emulator's write-only clipboard interface; no dependencies were installed. Findings below come from rendered UI, not a code review. No source-inferred product findings are included.

- Emulator: `emulator-5554`, Android 17 / API 37; package `com.anonymous.manshaetelammar`.
- Baseline: 1080 × 2424 physical pixels, density 420, approximately 411 logical pixels wide; system font scale 1.0; three-button navigation.
- Accessibility stress configuration: density 480, approximately 360dp wide, font scale 1.3. This is an emulator approximation, not a second physical device.
- Appearance: existing petroleum-blue palette, Dark and Light modes. Returned to Dark afterward.
- Session: already signed out. Restarted the app, but did not clear storage or perform a fresh installation.
- Public listing inspected in depth: “سباك الفتح”, service title “سباك صحي”. Its optional description was absent. No provider records were created or edited.
- Wi-Fi and mobile data were briefly disabled, then restored. Cached category content remained readable during the check. No uncached failure or retry outcome was established.
- Restored density 420 and font scale 1.0; hardware-keyboard IME setting ended at 0. The keyboard remained an emulator-specific floating toolbar during testing, not a representative full phone keyboard.

### Evidence and interpretation

Screenshots and corresponding visible-text/bounds JSON files are in [evidence](evidence/). The search matrix is [search-observations.json](evidence/search-observations.json). Screenshots contain intentionally public provider contact information; avoid publishing them beyond the QA audience without checking that sharing is appropriate.

**Confirmed** means directly observed in the app. **UX recommendation** means an evidenced design judgment, not a broken implementation. **Partial / not tested** means no pass is claimed. Failed automation taps, stale captures, Android clipboard overlays, and development LogBox overlays are not counted as production defects.

No application source, dependencies, Firebase records, authentication flows, provider-management flows, or admin flows were changed or tested. No phone call was placed and no WhatsApp message was sent.

## C. Guest Journey Results

| Scenario                     | Result                      | Actual outcome and boundary                                                                                                                                                                                    |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — First-time impression    | Partial                     | Cold restart as an existing guest. Purpose is clear and search is visible without scrolling at baseline. True first installation was not tested. Header repetition slows scanning.                             |
| B — Find a plumber           | Pass                        | Home → plumbing category → provider → dialer. Two taps to details, three to dialer. Category cards also expose contact actions, although that shorter contact path was not activated.                          |
| C — Arabic search            | Pass for tested matrix      | Profession synonyms, partial/full available provider name, spaces, spelling variation, and zero results exercised. Relevance assessed against the one known available plumber, not assumed provider coverage.  |
| D — Discover categories      | Partial                     | Home grid and Explore category list exercised. Labels become difficult at 360dp/130% text. Full catalogue coverage and ordering research not established.                                                      |
| E — Explore/filter           | Pass for exercised controls | Health filter, search plus Health, clear search, All, and reset-all exercised. Selection is visibly highlighted. Area filtering was not available in the tested one-provider plumbing category.                |
| F — Provider details/contact | Partial                     | One real listing reviewed in both themes; phone dialer, copy feedback, WhatsApp HTTPS landing page exercised. Multiple listings and native WhatsApp not verified.                                              |
| G — Empty/error/offline      | Partial                     | Empty electricity category, zero search, conflicting filter, missing provider, and cached offline category exercised. Uncached errors, slow network, retry, and live unpublishing not tested.                  |
| H — Navigation/usability     | Partial                     | Tabs, provider/category hardware Back, return to Home search, scrolling, text entry and clearing, Light/Dark, 360dp/large text checked. Edge gestures, full keyboard, TalkBack, and reduced motion not tested. |

### Search observations

Each query was entered into the actual Home field. Category suggestions are not proof of available providers.

| Query        | Observed response                                         |
| ------------ | --------------------------------------------------------- |
| سباك         | Available plumber plus plumbing category                  |
| سباكة        | Plumbing category plus available plumber                  |
| كهربائي      | Electricity category                                      |
| كهربا        | Electricity category                                      |
| دكتور        | Doctors category                                          |
| طبيب         | Doctors category                                          |
| تصليح غسالات | “مفيش نتائج مطابقة”; no matching availability assumed     |
| الفتح        | Available plumber plus plumbing category                  |
| سباك الفتح   | Available plumber plus plumbing category                  |
| `  سباك  `   | Same relevant plumber/category despite surrounding spaces |
| كهربائى      | Electricity category                                      |
| ززززز        | “مفيش نتائج مطابقة”                                       |

Search clearing was available through a labelled X. Explore with Health + “سباك” correctly showed no matches; “مسح الفلاتر” returned the all-categories state. Clearing only the query retained Health. Switching away from Explore and returning retained its search/filter state during the session.

## D. Confirmed Functional Issues

### G01 — P1 — Home category labels break at accessible text sizes

- **Screen/current behavior:** At approximately 360dp and 130% system text, Home retains four narrow category columns. Words split across lines, including “الصيدليات” and “المضخات”; parts of longer labels are visually clipped at tile sides. Icons remain recognizable, but category choice depends on incomplete text.
- **Expected / exact recommendation:** Use two columns at this configuration, permit natural card height and complete Arabic labels, and retain comfortable text size. Do not solve by reducing text scale or hiding meaningful label content.
- **Why:** Older residents and users enlarging text cannot reliably scan categories, a core guest entry point.
- **Reproduction/evidence:** Set 360dp/1.3 text, restart, scroll to Home categories. [37-small-home-clean.png](evidence/37-small-home-clean.png). The development warning covers the bottom tab region; it does not cause the category-label clipping above it.
- **Verification:** Confirmed visually in the running app after a clean restart. Not a claim about every device or all text scales.
- **Estimated effort:** Small–medium, approximately half a day including layout verification.

### G02 — P2 — Returning from a Home search result loses the query

- **Screen/current behavior:** Search Home for “سباك الفتح”, open its provider result, then press hardware Back. Home returns with the placeholder and no query/results.
- **Expected / exact recommendation:** Preserve the query and result context when opening a result. Clear only through the existing clear control or an explicit user reset.
- **Why:** Comparing results requires retyping and repeating the task. Explore already preserves context across tab changes, so the experiences differ.
- **Evidence:** [12-provider-from-search.json](evidence/12-provider-from-search.json), [13-search-back.json](evidence/13-search-back.json), and the search matrix. These record the typed query before entry and the empty field afterward.
- **Verification:** Confirmed actual UI behavior; classified as a journey defect, not an assertion of an implementation contract.
- **Estimated effort:** Small, approximately 1–2 hours plus navigation retest.

### G03 — P3 — Copy success repeats the same sentence twice

- **Screen/current behavior:** Copying the provider phone number displays both title and body as “تم نسخ الرقم”.
- **Expected / exact recommendation:** Show that sentence once; omit the identical body. Keep existing success feedback.
- **Why:** The large repeated notification interrupts reading without adding information.
- **Evidence:** [04-copy-phone.png](evidence/04-copy-phone.png). Android's separate clipboard preview is OS UI and is not this defect.
- **Verification:** Confirmed visually. Copy feedback and the OS preview appeared; clipboard contents were not independently read back.
- **Estimated effort:** Very small, under an hour including verification.

## E. UX Friction and Confusing Interactions

The following are design recommendations, not additional functional failures.

### G04 — P2 — Home introduction competes with the task

- **Screen/current:** Brand/location, welcome/location, hero eyebrow, large headline, then explanatory text precede search. Location appears twice. Search is visible at baseline, but providers begin below the first viewport. Enlarged text makes the introduction much taller.
- **Recommendation / exact change:** Keep one compact brand/location header, one short purpose sentence, then search. Remove the second location line and hero eyebrow; reduce the hero's prominence. Keep categories next and provider content after them.
- **Why:** Less reading and scrolling before finding help; no new feature needed.
- **Evidence/status:** Observed hierarchy, subjective recommendation. [48-final-home.png](evidence/48-final-home.png), [32-small-largefont-category.png](evidence/32-small-largefont-category.png) — the latter is actually Home despite its historical capture name.
- **Effort:** Small–medium, half a day including both themes and large-text checks.

### G05 — P2 — Search makes users infer result type

- **Screen/current:** “سباك” produces a service-title row (“سباك صحي”, followed by provider name) alongside a category row. Their destination types are communicated mainly through different icons and text hierarchy.
- **Recommendation / exact change:** Use existing result content with explicit “أصحاب الخدمات” / “الأقسام” grouping or a short type label. Put the provider name first and service title below it for provider results.
- **Why:** Residents can choose a person versus a whole category without interpreting unfamiliar icons.
- **Evidence/status:** [10-search-plumber-keyboard.png](evidence/10-search-plumber-keyboard.png), search matrix. Confirmed mixed results; confusion is a design assessment, not measured user-research evidence.
- **Effort:** Small–medium, half a day.

### G06 — P2 — Explore wording promises a broader view than its initial content

- **Screen/current:** “استكشف الخدمات” and “كل الخدمات اللي ممكن تحتاجها في مكان واحد” introduce a list of categories. Users must choose another category before seeing a provider list. Home's provider section also has a generic “عرض الكل”.
- **Recommendation / exact change:** Clarify the existing destination as category browsing: “استكشف أقسام الخدمات”, with “اختار القسم وشوف الخدمات المتاحة”. Label category-section links “كل الأقسام”. Verify and name the provider-section link according to its actual destination before changing it; that specific link was not followed in this audit.
- **Why:** Avoids promising a flat all-provider list and makes the extra decision predictable. This does not recommend adding another browsing mode.
- **Evidence/status:** [14-explore.png](evidence/14-explore.png), [22b-explore-all.png](evidence/22b-explore-all.png). Observed content; recommendation is subjective.
- **Effort:** Small, 1–2 hours for copy and journey check.

### G07 — P2 — Optional missing description still occupies a large section

- **Screen/current:** The tested provider has an “عن الخدمة” card with no descriptive body, just a category chip and substantial blank space. The identity card above already supplies name/title.
- **Recommendation / exact change:** Omit the section when no description exists. Keep the category near the title, and show a description section only when useful body text exists.
- **Why:** Makes contact/address easier to reach and avoids an unfinished impression. Sticky contact actions are already visible, so this is scrolling friction rather than a contact blocker.
- **Evidence/status:** [29-light-provider.png](evidence/29-light-provider.png), [03-provider-plumber-dark.png](evidence/03-provider-plumber-dark.png). Confirmed empty presentation; proposed removal is a design judgment.
- **Effort:** Small, 1–2 hours including absent/present-description checks.

### G08 — P3 — Public status and duplicated contact labels add noise

- **Screen/current:** Cards/details repeat “منشورة في الدليل”; the address appears in identity and again in contact details. When phone and WhatsApp match, the same number appears twice and WhatsApp gets an extra “رقم مقدم الخدمة” badge.
- **Recommendation / exact change:** Remove the publication badge from ordinary public listings and the redundant WhatsApp badge. Keep the detailed address once; the identity can retain the shorter area. Preserve both clear contact actions and distinguish numbers if they differ.
- **Why:** Publication is already implied by visibility. Less repeated metadata helps users identify the service and location.
- **Evidence/status:** [28-light-category.png](evidence/28-light-category.png), [29-light-provider.png](evidence/29-light-provider.png), [40-small-provider-bottom.png](evidence/40-small-provider-bottom.png). Observed; recommendation.
- **Effort:** Small–medium, half a day including differing-number cases.

### G09 — P2 — Combined-filter empty copy does not identify the constraint

- **Screen/current:** Health + “سباك” produces “مفيش نتائج مطابقة” and “جرّب كلمة تانية أو اعرض كل الأقسام.” Health remains visibly selected; “مسح الفلاتر” works, but it also clears the text.
- **Recommendation / exact change:** Say “مفيش نتائج لـ «سباك» ضمن قسم الصحة.” Keep the existing reset action and label it “مسح البحث والفلاتر” when it clears both. Do not silently discard only one constraint.
- **Why:** Explains that the combination, rather than the whole directory, is empty and accurately describes the reset action.
- **Evidence/status:** [52-combined-empty.json](evidence/52-combined-empty.json), [53-clear-all.json](evidence/53-clear-all.json). Correct filtering observed; copy improvement is subjective.
- **Effort:** Small, 1–2 hours.

### G10 — P3 — Provider disclaimer is too dense for its location

- **Screen/current:** The footer combines review limitations, identity, quality, direct contact, booking/payment, WhatsApp availability, and reporting instructions into one long paragraph. At enlarged text it dominates the scroll area.
- **Recommendation / exact change:** Keep the existing facts, divided into short paragraphs: a concise caution near contact, and clearly separated contact/reporting guidance below. Do not remove qualifications or imply verification. Suggested wording is in section G.
- **Why:** Residents are more likely to read the limitations and find the next step when they are scannable.
- **Evidence/status:** [40-small-provider-bottom.json](evidence/40-small-provider-bottom.json) and screenshot. Observed text; recommendation.
- **Effort:** Small, 1–2 hours plus copy review.

## F. Screen-by-Screen Review

| Screen                 | What works                                                                                                                                      | What should change / limits                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                   | Clear local purpose; working guest search; recognizable icons; guest-only three-tab layout                                                      | G01, G04. Two generic “عرض الكل” links need contextual naming. Do not claim search is hidden: it was visible at both tested widths, though much lower with large text.                                                      |
| Explore                | Clear selected-chip color; Health reduces the list to relevant categories; clear/reset work; context survives tab switching                     | G06 and G09. Category-first hierarchy should be named honestly. No area selector was exercised.                                                                                                                             |
| Category/provider list | Service name/title/location and enabled contact actions are easy to identify; hardware Back returns to Explore/Home as entered                  | Header and introductory card repeat the category title. Prefer one title and short explanatory line. Empty electricity category has a useful “استكشف الأقسام” action; that particular empty-state action was not activated. |
| Search                 | Tested synonyms and spelling normalization help; clear X has a label; no-result message avoids technical jargon                                 | G02 and G05. Home and Explore context retention differ. Full keyboard visibility/scroll avoidance unverified.                                                                                                               |
| Provider Details       | Name prominent; phone LTR; back arrow points appropriately for RTL; sticky phone/WhatsApp actions present in both themes; lower content scrolls | G07, G08, G10. Optional description missing; no second real provider inspected, so long-name/long-description robustness is unknown.                                                                                        |
| Empty/missing states   | Search empty and empty category remain navigable; nonexistent public ID shows “الخدمة غير موجودة”, short guidance, working Explore recovery     | Missing-ID test does not prove handling of a listing removed while open. Cached offline content survives, but error/retry quality is unverified.                                                                            |
| Guest More             | Explicitly says browsing needs no account; appearance accessible; no My Services tab                                                            | Only guest browsing/appearance reviewed. Login and account actions intentionally not opened.                                                                                                                                |

### Contact and navigation details

- Dialer opened with the provider number populated. No call was placed. One Back moved to the dialer home and another returned to Provider Details: this is external-app history, not a demonstrated directory defect.
- WhatsApp opened an HTTPS landing page offering “Open app” / download. No native WhatsApp account or messaging session was tested. One Back remained within browser history; app was brought foreground for the next independent scenario.
- Copy produced feedback; its duplicate title/body is G03. No prior clipboard contents were read. Automatic approval review rejected an initial clipboard-backup approach; testing proceeded using write-only query input.
- Hardware Back from Provider Details returned to category, then Home, including after the clean 360dp restart. Home retained its prior category-grid scroll position in that path. Home search text was not retained in the separate search path.
- At baseline, three tabs and detail action bars appeared above Android system navigation. No app-content overlap defect was established. Some development warnings covered controls; they are excluded from production conclusions.
- Light and Dark appearance were inspected visually; no quantified contrast or WCAG conformance claim is made. Both retained readable hierarchy at baseline. Petroleum-blue colors remained consistent.

## G. Arabic Copy Improvements

These are proposed changes, not edits. Preserve clear existing copy such as “اتصال”, “واتساب”, “مسح البحث”, “الخدمة غير موجودة”, and “تقدر تتصفح خدمات البلد من غير حساب.” Do not rewrite provider-authored names or addresses as though they were app labels.

| Location                 | Current Arabic                                                                                                                                                                                                                                                                    | Suggested Arabic                                                                                                                                                                                                                                   | Why                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Home introduction        | Repeated “منشأة العمار، طوخ، القليوبية” below welcome and in header                                                                                                                                                                                                               | Keep once in compact header                                                                                                                                                                                                                        | Removes repetition without losing location                                              |
| Home category heading    | اختار المجال اللي بتدور عليه في البلد                                                                                                                                                                                                                                             | بتدور على خدمة إيه؟                                                                                                                                                                                                                                | Shorter and easier to scan                                                              |
| Category section link    | عرض الكل                                                                                                                                                                                                                                                                          | كل الأقسام                                                                                                                                                                                                                                         | Names what opens                                                                        |
| Explore title            | استكشف الخدمات                                                                                                                                                                                                                                                                    | استكشف أقسام الخدمات                                                                                                                                                                                                                               | Describes current category-first screen                                                 |
| Explore subtitle         | كل الخدمات اللي ممكن تحتاجها في مكان واحد                                                                                                                                                                                                                                         | اختار القسم وشوف الخدمات المتاحة                                                                                                                                                                                                                   | Avoids implying comprehensive provider availability                                     |
| Category listing heading | أهل الخبرة في السباكة والمضخات                                                                                                                                                                                                                                                    | خدمات السباكة والمضخات                                                                                                                                                                                                                             | Avoids suggesting an assessed level of expertise                                        |
| Public badge             | منشورة في الدليل                                                                                                                                                                                                                                                                  | Remove                                                                                                                                                                                                                                             | Status does not help guest selection                                                    |
| WhatsApp extra badge     | رقم مقدم الخدمة                                                                                                                                                                                                                                                                   | Remove                                                                                                                                                                                                                                             | Already identified by WhatsApp label and number                                         |
| Copy notice              | تم نسخ الرقم / تم نسخ الرقم                                                                                                                                                                                                                                                       | تم نسخ الرقم                                                                                                                                                                                                                                       | Single clear confirmation                                                               |
| Combined empty state     | مفيش نتائج مطابقة                                                                                                                                                                                                                                                                 | مفيش نتائج لـ «سباك» ضمن قسم الصحة.                                                                                                                                                                                                                | Identifies query and active constraint; use actual values                               |
| Combined reset action    | مسح الفلاتر                                                                                                                                                                                                                                                                       | مسح البحث والفلاتر                                                                                                                                                                                                                                 | Describes observed clearing of both                                                     |
| Provider disclaimer      | البيانات بيضيفها مقدم الخدمة وبتتراجع قبل النشر. المراجعة مش ضمان لجودة الخدمة أو هوية مقدمها. التواصل مباشر من خلال تطبيق الاتصال أو واتساب، والتطبيق مش بيدير حجز أو دفع. وجود رقم واتساب لا يضمن وجود حساب عليه. للإبلاغ عن بيانات غير صحيحة، تواصل مع الدعم واذكر اسم الخدمة. | البيانات من مقدم الخدمة، والمراجعة قبل النشر مش ضمان لهويته أو جودة شغله. [new paragraph] التواصل مباشر؛ التطبيق مش بيدير حجز أو دفع، ورقم واتساب ممكن ما يكونش عليه حساب. [new paragraph] لو البيانات غير صحيحة، تواصل مع الدعم واذكر اسم الخدمة. | Retains qualifications while separating caution, contact limits, and reporting guidance |

## H. Proposed Layout and Navigation Changes

These simplify existing presentation; no new feature or separate browse mode is proposed.

**Home:** Compact logo/name/location → short purpose line → search/results → categories with responsive columns → provider section → secondary participation/support content. Current welcome, repeated location, eyebrow, and oversized hero become one concise introduction. Benefit: less reading before the first decision, especially with enlarged text.

**Explore:** Explicit category-browsing title → search → existing group chips → category results → existing brief directory note. Keep the current order; rename it, clarify result type, and explain query/filter conflicts. Benefit: users know whether they are selecting a category or a person.

**Category:** Single category header plus short description → search/available filters → provider list or compact empty state → brief caution separated from content. Avoid repeating the title in a large introduction and list heading. Keep existing card contacts. Benefit: first provider appears sooner.

**Search:** Query/clear control → clearly labelled provider and category groups using existing results → concise empty explanation with accurate existing reset action. Return restores query/results. Benefit: easier comparison and predictable Back behavior.

**Provider Details:** Compact identity with category/area → description only when present → contact/address details once → short separated limitations/reporting text; retain sticky phone/WhatsApp controls and scroll clearance. Benefit: optional missing content does not create a blank panel, and contact stays reachable.

**Empty/offline/missing states:** Keep the working missing-provider recovery. Keep empty category and filtered-empty messages distinct. No redesign of error/retry is recommended without reproducing those states first. Benefit: avoids changing an untested interaction based on assumptions.

## I. Top 10 Improvements

Ranked by task impact, then implementation effort. These are three confirmed issues plus seven evidenced UX recommendations, not ten claimed bugs. Effort estimates exclude unrelated work.

| Rank | ID  | Improvement                                        | Impact / effort                                     |
| ---- | --- | -------------------------------------------------- | --------------------------------------------------- |
| 1    | G01 | Make category labels complete at 360dp/large text  | Core accessibility; small–medium                    |
| 2    | G02 | Preserve Home search on return                     | Comparison and repeat use; small                    |
| 3    | G04 | Compress Home introduction and repeated location   | Faster start for every guest; small–medium          |
| 4    | G07 | Hide absent-description section                    | Shorter useful details; small                       |
| 5    | G05 | Identify provider versus category search results   | Fewer ambiguous decisions; small–medium             |
| 6    | G09 | Explain filter conflict and accurately name reset  | Prevent false “nothing available” conclusion; small |
| 7    | G06 | Name Explore's category-first behavior clearly     | Predictable browsing destination; small             |
| 8    | G08 | Remove public status and duplicated metadata       | Less noise; small–medium                            |
| 9    | G10 | Split dense contact disclaimer into readable parts | Clearer limitations; small                          |
| 10   | G03 | Remove repeated copy success sentence              | Minor interruption removed; very small              |

## J. Must Fix Before Production

1. **G01:** Category selection must remain readable at small width/enlarged text. Retest all category labels without shrinking accessible text.
2. **G02:** Preserve the guest's Home query/results through a provider visit. Retest clear behavior separately.

Before a release sign-off, also verify the unresolved environments below. These are verification gates, not invented defects: uncached offline/error/retry; production-build navigation after recreation; full phone keyboard; native WhatsApp fallback/return; TalkBack; and a second listing with long content. No P0 or baseline contact blocker was observed.

## K. Nice to Have After Launch

Prioritize G04/G07 next because they remove the most unnecessary scrolling. G05/G06/G09 improve understanding using current UI, and can follow without adding features. G08/G10/G03 are lower-risk cleanup. Preserve the working guest access, enabled real contact actions, missing-provider recovery, Arabic search matching, and safe spacing at baseline.

## L. Limitations and Untested Scenarios

- One emulator and one public provider inspected in depth. No second real provider with a populated/long description was verified; no data was added to create one. Electricity was empty during this run, not proof of catalogue-wide coverage.
- Fresh installation, startup permissions, onboarding, and splash duration were not tested. A cold restart of an existing guest installation is different.
- Native WhatsApp was not available in the exercised handoff. Chat delivery, number ownership, provider responsiveness, actual calls, and WhatsApp account existence were not tested.
- Clipboard backup was blocked by automatic approval review because it could expose prior private clipboard content. No clipboard readback was performed; write-only test queries were used instead.
- Full phone keyboard could not be reproduced reliably: the emulator used a floating hardware-keyboard toolbar even when on-screen IME was requested. Text entry, clearing, and query navigation were exercised, but tapping outside, full-keyboard occlusion, and scrolling with a normal phone keyboard are unverified.
- Briefly disabling Wi-Fi and mobile data demonstrated cached category continuity only. The screenshots did not establish a stale/offline indicator, but the test is insufficient to call that a defect. Slow network, uncached failure, timeout, retry, permission denial, and recovery synchronization were not verified.
- A deliberately nonexistent provider ID produced safe UI and working Explore recovery. No record was unpublished while its details were open. Those are different cases.
- Density/font changes caused development activity recreation and one red error: “The imperative router is unavailable before the first render has finished.” [35-small-category.png](evidence/35-small-category.png). After force-stop/relaunch at the same configuration, category/provider navigation and hardware Back worked. Treat this as a **development-build configuration-change observation requiring a release-build reproduction**, not a confirmed general production navigation failure.
- Development LogBox warnings sometimes covered tabs/actions and interfered with automation. They were dismissed for baseline checks; their presence in some large-text screenshots is documented and not counted as a production spacing issue.
- Baseline approximately 411dp and stress 360dp/130% text were tested; 390dp, landscape, tablets, iOS, maximum text size, physical devices, and mixed-script/long-provider data were not verified.
- No TalkBack session, switch access, focus-order audit, measured touch-target inventory, contrast-ratio analysis, or reduced-motion test was performed. Accessibility labels appeared in hierarchy dumps, but this does not establish screen-reader usability. Private-use icon glyphs appeared in some grouped labels; spoken output remains unverified.
- Android three-button hardware Back was exercised. Left/right edge gestures, predictive Back, root exit behavior, and all possible deep-link histories were not exhaustively tested.
- Home's provider-section “عرض الكل”, category empty-state Explore action, report/support actions, and every category were not individually followed. Do not infer their destinations or success from adjacent tested controls.
- Approximate effort estimates are planning guidance, not implementation commitments. No code-quality, architecture, Firebase implementation, auth, provider, or admin review was performed.
