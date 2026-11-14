# Home — Editorial Bento reference

Reference: Stitch project 2475157814755974565, screen de761c6ea61f415e8daf19bf3f72c2a5.

Applied the featured blue category card, unequal middle columns (58% / 38%), white final category, larger provider cards with actual descriptions, and stacked Add Service panel with full-width action. Retained existing category order, first-four selection, three approved provider preview, search, contact hooks, routes and current tabs. Columns stack at larger text / narrower effective widths as before.

Adapted the reference to existing Petroleum Blue Light/Dark theme and real data. Unsupported ratings, verification, availability, photos, counts, emergency claims and the sample village announcement were omitted. No backend or dependency changes.

Validation: TypeScript and lint passed. Full suite: 41 suites passed, 1 failed; 369 tests passed, 1 failed. Failure is release-config.test.ts assuming app.android.adaptiveIcon.foregroundImage exists; app configuration was not modified by this Home change. After adding the provider-description regression check, all 25 focused Home/contact tests passed.

Manually inspected Android Light Home, category layout, provider cards and CTA, plus Dark categories. Restored the original Light preference. Screenshots: evidence/home-editorial-top.png, home-editorial-middle.png, home-editorial-bottom.png, home-editorial-dark.png.

Not manually rechecked: 360dp / 130% text matrix, search round trip, or external contact handoffs. Automated query retention, category sizing, navigation and validated contact checks pass.
