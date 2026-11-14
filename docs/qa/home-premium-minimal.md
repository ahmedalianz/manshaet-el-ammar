# Home — Premium Minimal

## Reference and implementation

The linked Stitch screen 5b118c16d2ba4340983a653b7e25a7ec is Friendly Marketplace. Per the attached brief, the companion Premium Minimal screen 800720a4803c46fc9af3af3d79ae535e supplies the layout; only the muted icon-background variation is borrowed from Friendly Marketplace.

Replaced the previous grouped Bento composition with eight actual categories selected in the existing homeCategoryIds order, compact white tiles and locally shortened display labels. Full names and IDs remain unchanged. At effective widths below 360dp the grid adapts to three columns, then two below 270dp; labels scale and wrap. Uses the semantic Petroleum Blue palette and five new category accent background tokens with muted Dark-mode equivalents. No gradients, counts, descriptions or separate arrows in category tiles.

Header: existing logo, brand, subtitle and profile/sign-in route. Search: exact brief copy, existing searchDirectory and SearchInput, clear behavior and existing discovery shortcut. Provider preview: up to three approved/public listings, existing validated contact hook, icon placeholders, wrapping identity/location, no descriptions or unsupported badges. CTA uses the requested copy and current provider/join flow. Tabs, auth, backend schema/rules/queries and registration are unchanged.

## Files

Product files:
- src/app/(tabs)/index.tsx
- src/features/discovery/components/ProviderCard.tsx
- src/theme/colors.ts

Regression coverage updated:
- __tests__/guest-clarity.test.tsx
- __tests__/guest-ux-fixes.test.tsx
- __tests__/provider-card-contact.test.tsx

Reused: SearchInput, EmptyState, LoadingState, RemoteDataNotice, ProviderCard, CategoryIcon, MotionPressable/reduced motion, existing theme hooks and contact/navigation utilities. No new dependencies.

## Verification

TypeScript and lint passed. Full suite: 42 suites / 379 tests passed. Coverage includes 360/390/411dp category sizing, 130% and 200% text adaptation, actual category order/IDs/navigation, Home account routes for guest/provider/admin states, exclusion of pending/rejected/unpublished preview records, search context/result types/clear behavior, independent Call/WhatsApp controls, unavailable contacts, and missing optional data.

Actual Android emulator checks: Light at approximately 360/390/411dp; Dark at 360/411dp; 130% text in Light and Dark at 360dp. Main captures were visually inspected. Changing emulator metrics produced an existing development linking warning; no release-build behavior was inferred from it.

Exercised category navigation to the category screen; discovery shortcut; typed nonmatching search and cleared it; provider details and Back; Call handoff to the dialer; WhatsApp handoff to Chrome (native WhatsApp is unavailable); and Add Service introduction without submitting. No calls/messages or Firebase writes were made.

Original settings restored: density 420, font_scale 1.0, app appearance Light.

Evidence: docs/qa/evidence/home-premium-light-411.png, home-premium-providers-light-411.png, home-premium-cta-light-411.png, home-premium-dark-411.png, home-premium-dark-360.png, home-premium-dark-360-large.png, home-premium-light-360.png, home-premium-light-360-large.png, home-premium-light-390.png.

## Differences and remaining QA

Real category names/order and provider data differ from mock examples. Provider data has no photo field, so category icons are used. Notification bell, official/availability/verification badges, photos and marketing subtitles are omitted. Theme colors and IBM Plex Sans Arabic follow the existing app rather than the browser reference's Arabic fallback rendering. No pixel-perfect claim.

Remaining: physical-device/iOS verification, manual guest/provider sign-in sessions (the emulator used its existing admin session), native WhatsApp-app handoff, and production release-build checks. Valid-result search retention and guest/auth routing are covered automatically; manual typed-search check in this pass used a nonmatching ASCII query.
