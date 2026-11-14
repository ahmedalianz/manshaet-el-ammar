# Home — Elevated Bento refresh

Reference: Stitch project 2475157814755974565, screen 3ea7e82bd27946a496271b26683929a4.

Updated the header with a functional account/sign-in action, new search headline, equal middle category cards, separated card action rows, a featured-category link label, and compact responsive Add Service panel. Existing category order, first-four selection, provider data/cards, validated contacts, search logic and routes remain unchanged. The existing effective-width threshold stacks cards and CTA for large text / narrow layouts. No dependencies or Firebase changes.

The mockup's unsupported notification indicator, official/verification claims, ratings, availability counts, sample announcement and emergency service promises are omitted.

Verification: TypeScript and lint passed. All 42 suites / 371 tests passed. Updated Home headline and responsive sizing assertions. Actual Android Light-mode screenshots inspected: evidence/home-elevated-top.png, home-elevated-middle.png, home-elevated-bottom.png, home-elevated-cta.png. The top capture contains the development warning overlay; the final CTA capture has it dismissed.

Not manually repeated for this revision: Dark mode, 360dp/130% text matrix, guest account routing, search round trips and external contact handoffs. Existing automated search, navigation, responsive layout and contact coverage passes.
