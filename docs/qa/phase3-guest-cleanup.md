# Phase 3 guest cleanup — 2026-11-07

Implementation complete. Actual Android emulator verification was subsequently performed using ADB; results and remaining coverage boundaries are recorded below.

## Confirmed findings and changes

Reviewed docs/qa/guest-ux-audit.md, the referenced evidence and current source. Inspected evidence/18-explore-combined.png visually; other source/evidence text confirms the duplicated success, publication badges, address and contact metadata, and dense disclaimer still existed.

- G03: useProviderContactActions now emits title-only copy success. Feedback omits empty message nodes, joins only nonempty text for accessibility announcements, and coalesces identical active toasts. The existing single-toast model, dismissal timing and clipboard/contact operations remain intact.
- G08: public ProviderCard and Provider Details no longer show publication badges. Non-public fixture warnings remain. Details shows the existing area near identity only when useful, and the complete address once in contact details. Identical valid phone/WhatsApp numbers appear once while both sticky actions remain. Different numbers remain separately labelled; the redundant WhatsApp provider-number badge is removed.
- G09: Explore empty titles name the real trimmed query and active section; Unicode direction isolates protect mixed Arabic/English queries. The selected chip label supplies the section name. Search-only, section-only, combined and no-constraint cases have distinct copy. Existing reset behavior still clears both query and section; its label describes the active constraints. The independent search-clear control still preserves the section. Category-page query mismatches also name the category. Search matching, ranking, normalization, Firebase queries and category data are unchanged.
- G10: replaced the dense coloured disclaimer with an ordinary existing section surface headed “عن بيانات الخدمة” and separate short paragraphs. Provider-supplied data, pre-publication review, lack of identity/quality guarantees, external contact, no booking/payment, unverified WhatsApp availability and support reporting guidance are retained. Mock-number limitations remain for non-public fixtures.

## Exact Arabic copy changes

| Old | New |
| --- | --- |
| Copy title “تم نسخ الرقم” plus body “تم نسخ الرقم” | Title “تم نسخ الرقم”; no body |
| منشورة في الدليل | Removed from ordinary public cards/details |
| رقم مقدم الخدمة (WhatsApp badge) | Removed; distinct numbers still have “واتساب” label |
| مفيش نتائج مطابقة | Search: “مفيش نتائج لـ «{query}».”; combined: “مفيش نتائج لـ «{query}» ضمن قسم {section}.” |
| جرّب كلمة تانية أو اعرض كل الأقسام. | Search: “جرّب كلمة تانية أو امسح البحث.”; combined: “جرّب كلمة تانية أو غيّر القسم.”; no query: “جرّب عرض كل الأقسام.” |
| مسح الفلاتر (also cleared query) | “مسح البحث” for search-only; “مسح البحث والفلاتر” for combined; “مسح الفلاتر” without a query |
| Generic category-only mismatch | “مفيش أقسام متاحة ضمن {section} حاليًا.” |
| ملقيناش نتائج للبحث ده (category screen) | “مفيش نتائج لـ «{query}» ضمن قسم {category}.” |
| البيانات بيضيفها مقدم الخدمة وبتتراجع قبل النشر. المراجعة مش ضمان لجودة الخدمة أو هوية مقدمها. التواصل مباشر من خلال تطبيق الاتصال أو واتساب، والتطبيق مش بيدير حجز أو دفع. وجود رقم واتساب لا يضمن وجود حساب عليه. للإبلاغ عن بيانات غير صحيحة، تواصل مع الدعم واذكر اسم الخدمة. | Heading: “عن بيانات الخدمة”. Paragraph 1: “البيانات من مقدم الخدمة، والمراجعة قبل النشر مش ضمان لهويته أو جودة شغله.” Paragraph 2: “التواصل مباشر مع مقدم الخدمة. التطبيق مش بيدير حجز أو دفع، ووجود رقم واتساب مش معناه بالضرورة إن عليه حساب.” Paragraph 3: “لو لقيت بيانات غير صحيحة، تواصل مع الدعم واذكر اسم الخدمة.” |

## Files

- src/features/discovery/useProviderContactActions.ts
- src/components/ui/Feedback.tsx
- src/features/discovery/components/ProviderCard.tsx
- src/app/provider/[id].tsx
- src/features/discovery/emptyState.ts
- src/app/(tabs)/explore.tsx
- src/app/category/[id].tsx
- __tests__/provider-feedback.test.tsx
- __tests__/screen-states.test.tsx
- __tests__/phase3-copy.test.ts

## Verification and limitations

Automated checks: TypeScript PASS; ESLint PASS; all 34 suites and 325 tests PASS. Tests cover actual clipboard destination using the native Clipboard mock, single success text, same/different contact numbers, retained sticky actions, address shown once, missing publication/provider-number badges, real query and section names, reset-all and clear-search-only semantics. Existing tests exercise contact security and preceding guest UX behavior.

Actual emulator follow-up: performed on emulator-5554, 1080×2424, baseline density 420 (~411dp), font scale 1.0, and density 480 (~360dp), font scale 1.3. Original density and font scale restored; Light appearance restored to the initial selection. Inspected the running updated development app, not a signed Play build.

| Scenario | Actual result |
| --- | --- |
| Copy success/repeated copy | PASS on the public plumber: one app confirmation, no stacked duplicates; native Android clipboard preview remains separate. Captured baseline Light and small Dark. No clipboard readback. |
| Public card metadata | PASS on the plumbing category at 360dp: no publication badge; service identity, address and Call/WhatsApp retained. |
| Shared-number Details | PASS: one phone number, area near identity, full address once in details, both sticky actions. Baseline Light and 360dp/130% Light/Dark inspected. |
| Disclaimer | PASS for tested listing: separate paragraphs remain readable/scrollable and preserve qualifications, no obstruction of sticky actions. |
| Call handoff | PASS: external dialer opened with +20 10 99019685, matching displayed public number. No call placed. |
| WhatsApp handoff | PARTIAL: opened Chrome at wa.me/201099019685. Native WhatsApp/account availability unverified; no message sent. |
| Combined Explore search | PASS: actual Arabic query سباك + selected صحة appear in the empty title. Reset label includes البحث والفلاتر. Captured baseline Light/Dark and small Light/Dark. |
| Clear only search | PASS: Health remains selected and its categories reappear. |
| Reset all | PASS: query cleared, All selected, category catalogue restored. |
| Tab/theme context | PASS for tested sequence: query and Health persisted through More/Explore and Light/Dark changes. |
| Home return | PASS: returning from Provider Details restored the Home search query/results. Earlier Home category labels inspected at small size, no new changes made. |
| Keyboard | PARTIAL: entry/paste/clear worked; emulator showed floating IME toolbar, not a normal full phone keyboard. Full keyboard occlusion not established. |
| Other provider variants | Automated fixtures cover different numbers; no extra real Firebase records created. Phone-only, WhatsApp-only, missing-location and long-name/address device scenarios remain NOT TESTED. |

A development LogBox warning about linking configuration appeared after changing density/font settings; dismissed to continue the test. It was not fixed or treated as proof of a release-build defect. Display reconfiguration recreated navigation state; ordinary tab/back preservation was tested separately. No TalkBack session, contrast measurement or physical-device/Play-build pass is claimed.

After screenshots (all relative to this report):
- [Copy success, Light](evidence/phase3-copy-light.png)
- [Repeated copy](evidence/phase3-copy-repeat.png)
- [Provider baseline](evidence/phase3-provider-baseline.png)
- [Disclaimer, Light](evidence/phase3-disclaimer-light.png)
- [Dialer handoff](evidence/phase3-dialer.png)
- [WhatsApp URL handoff](evidence/phase3-whatsapp-handoff.png)
- [Home search return](evidence/phase3-home-search-return.png)
- [Combined search, Light](evidence/phase3-combined-light.png)
- [Combined search, Dark after tab return](evidence/phase3-combined-dark-return.png)
- [Combined search, 360dp Dark](evidence/phase3-combined-small-dark.png)
- [Combined search, 360dp Light](evidence/phase3-combined-small-light-confirmed.png)
- [Category, 360dp Dark](evidence/phase3-category-small-dark.png)
- [Provider, 360dp Dark](evidence/phase3-provider-small-dark.png)
- [Disclaimer, 360dp Dark](evidence/phase3-disclaimer-small-dark.png)
- [Copy, 360dp Dark](evidence/phase3-copy-small-dark.png)
- [Provider, 360dp Light](evidence/phase3-provider-small-light.png)
- [Disclaimer, 360dp Light](evidence/phase3-disclaimer-small-light.png)

Screenshots include intentionally public contact data and should remain QA evidence rather than promotional assets without a separate review.

No real calls/messages were placed, existing clipboard contents were not read, no fake public listings were created, and no Firebase records/rules were modified. No dependencies, auth/admin changes, navigation changes or unrelated redesigns were introduced. Phone/WhatsApp action behavior and previous phase logic were preserved.
