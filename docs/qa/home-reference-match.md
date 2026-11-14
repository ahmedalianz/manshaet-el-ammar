# Home — screenshot correction

Reference: Stitch screen 3ea7e82bd27946a496271b26683929a4 and the user's attached screen.png.

Rebuilt Home around the actual composition: fixed compact brand header, small eyebrow and search title, local pale-blue palette, gradient health feature with circle decoration and divided footer, equal maintenance/transport tiles, full-width education row, compact two-provider preview and horizontal Add Service CTA. Uses existing Arabic font family with Home-specific sizes and spacing. Search matching/query retention, real provider contact validation, consent/auth/submission flow and other screen styles are preserved. SearchInput only gains an optional textStyle override; default callers retain their appearance.

Four static navigation shortcuts open real Explore filters. Explore consumes and reapplies the validated filter parameter on focus, including an already mounted tab. These shortcuts do not claim any provider availability and remain available when data is temporarily offline.

User explicitly requested omitting ratings, verification badges, live availability and the medical-event announcement. No sample provider photos, official badge, unsupported notification control or emergency service promises were added. Real names, descriptions and contact details remain the source for provider cards.

Validation: TypeScript and lint passed; full suite 42 suites / 372 tests passed. Tests cover shortcut destinations, narrow/large-text stacking, search regressions and updating an existing Explore tab's incoming filter. Android Light layout and the real health shortcut were manually verified after repairing emulator DNS. Dark mode and the full font-size/device matrix were not repeated manually.

Screenshots: evidence/home-reference-match-online-top.png, home-reference-match-online-providers.png, home-reference-match-online-cta.png. Earlier offline screenshots are diagnostic only.
