# منشأة العمار

**بلدنا أقرب**

Arabic-first community services app for residents of Manshaet El Ammar, Qalyubia, Egypt. Includes public discovery and local demo provider registration and service management based on the Stitch designs.

## Stack

Expo SDK 58, React Native, TypeScript (strict), Expo Router, Firebase JavaScript SDK (Auth and Firestore), TanStack React Query, and Expo native modules.

## Requirements

- Node.js 22 LTS (Expo SDK 58 supported Node versions)
- npm
- Android Studio and Android SDK for a local Android build
- Expo Go for a compatible SDK, or an Android emulator/device for a local native build

## Install and run

```sh
npm install
npm start
```

To build and launch the Android app locally (required to apply native RTL configuration):

```sh
npm run android
```

For Expo Go, start with `npm start` and scan the QR code only when the installed Expo Go supports this SDK. If it does not, use the local Android command above.

Working-hours fields use the system time picker (`@react-native-community/datetimepicker`). After pulling this dependency into an existing development build, rebuild with `npx expo run:ios` or `npx expo run:android`; a JavaScript reload alone cannot add the native module.

## Firebase environment

Copy `.env.example` to `.env` and set the Firebase client configuration values from a Firebase project you create manually. Expo exposes these `EXPO_PUBLIC_` values to the client bundle; they are not secrets. Never place service account credentials or private keys in this app. Restart Expo after changing environment values. Without the required values, the placeholder app still starts and Firebase exports remain `null`.

Firebase is prepared for Authentication and Cloud Firestore only. No Firebase project is created or connected by default. Stay within the Firebase Spark free plan; do not enable paid Firebase services without explicit approval.

## RTL and fonts

Arabic RTL is enabled in the Expo Localization config plugin. Rebuild the native app after changing RTL plugin settings; Expo Go may reset RTL preferences. The app uses bundled IBM Plex Sans Arabic in Regular, Medium, SemiBold, and Bold weights.

## Phase 2 local provider flows

Home’s registration action opens Join → demo sign-in → the shared two-step Add/Edit form → local submission confirmation → My Services. The four tabs remain available on main screens; forms and detail screens use the root stack.

In development, sign-in offers an empty profile and a profile containing pending, approved, rejected, and approved-with-proposed-edits examples. My Services offers profile switching and guest mode. This is not real authentication or authorization. Sign-in and submission are blocked outside `__DEV__`; no password, Firebase request, or durable account is created. All session/listing changes reset when the JavaScript app reloads. Profile switching within one session retains each profile’s local records.

New and resubmitted rejected listings remain pending and private. Approved edits are stored separately; public search and previews keep the approved version. Existing proposals can be compared and explicitly replaced without duplicating listings. Every submission requires fresh privacy consent. Contact buttons remain inert even when a real-looking number is entered. Map selection is coming soon and requests no location permission.

The mock session and repository boundary is `src/features/provider/ProviderContext.tsx`; fixtures and pure moderation transitions are separate. Later Firebase work must replace this boundary with authenticated ownership, private proposed edits, approved-only public reads, server-enforced moderation, consent records, and restrictive Security Rules. The present local checks are not a security boundary. No real moderation occurs in this phase.

## Project structure

```text
src/
  app/                 # Expo Router tabs, public details and provider flows
  features/            # Discovery and local provider management
  components/ui/       # Shared placeholder screen for future features
  lib/                 # Firebase setup and QueryClient
  theme/               # Colors, spacing, typography tokens
assets/                # Splash artwork and app icon
```

Planned Firestore collections: `users`, `categories`, `providers`, and `reports`. Provider status values will be `pending`, `approved`, or `rejected`. Future security rules must allow public reads only for approved provider listings; prevent providers from approving themselves or bypassing moderation when editing; keep private user data private; require explicit consent before publishing contact information; and keep reports unreadable to other users. Rules and collections are not implemented yet.

## Scripts

- `npm start` — start Expo
- `npm run android` — build and launch Android locally
- `npm run ios` — regenerate the iOS project from app config, then build/install it. Use this after changing icons, splash artwork, or native plugins; reopening or reinstalling an older build keeps its bundled native assets.
- `npm run web` — start web
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check
- `npm test` — Jest unit and React Native component integration tests
- `npm run format` — format with Prettier

## Next steps

Phases 4 and 5 add shared local moderation, role-aware More, account profile editing, and informational pages. Services, request history, reports, and demo accounts share one in-memory context; public discovery reads only its published projection. Admin tools and simulated sign-in are development-only. Password reset is disabled; contact configuration and final policy content remain unavailable.

1. Review the local demo flows on target devices.
2. Implement real authentication, moderation, and restrictive Firestore Security Rules in a later approved phase.
3. Replace local state only after the ownership and public/private data boundaries are reviewed.

## Phase A shared mock state

`ProviderContext` mounts the single `MockState` from `moderation.ts`. Development sign-in offers two provider accounts (`demo-empty`, `demo-listings`) and one administrator (`demo-admin`). Switching accounts/signing out retains records until JS reload, but private request/listing selectors follow the current owner and reports/admin queues are admin-only. Roles come from fixture accounts. All mutation callbacks remain development-only.

Provider submissions create private pending requests; approval publishes one listing, edits preserve the public version until approved, rejected requests retain history, and unpublished services remain visible to their owner. Identical pending new submissions are rejected, pending edits require explicit replacement, and unpublishing blocks subsequent edit approval. Report closure preserves the listing and report history. Account name changes do not alter service display names.

Run `npm run typecheck`, `npm run lint`, and `npm test`. Jest uses its Node file crawler rather than Watchman so tests can run in restricted development environments. Domain and context tests cover moderation transitions, ownership, session isolation, and public/private synchronization. Native device smoke testing is still required before release.

## App feedback

`FeedbackProvider` is mounted under the safe-area and mock-state providers. Use `useFeedback().show(title, message)` for dismissible notifications; pass buttons for a queued themed confirmation. Destructive callbacks run only after explicit confirmation; system back chooses cancellation. Use a stable `key` option for guarded prompts that may be requested repeatedly (such as unsaved-form navigation). Notices remain available until dismissed for screen reader users and use the shared reduced-motion-safe animation components.

App feedback is themed locally. Android's system clipboard preview belongs to the operating system and is not styled or disabled by the app.

## Appearance

The app defaults to **حسب إعدادات الجهاز** and also supports **فاتح** and **داكن** in More for every role, including guests. `AppThemeProvider` owns the preference independently from mock authentication. AsyncStorage stores only `system`, `light`, or `dark` under `manshaet-el-ammar.appearance`; reads are guarded against stale restoration and rapid writes are serialized. Storage failures keep the current choice active and explain the persistence problem beside the selector.

`src/theme/colors.ts` defines the existing light identity and a semantic dark palette. Screen/component styles use `useAppTheme` and memoized `useThemedStyles` factories; reusable provider/admin styles use their corresponding hooks. Do not import the light palette into UI components or mutate palette objects. Expo Router's built-in navigation theme, native status bar, keyboards, root view background, and app feedback use the resolved appearance. Brand icon/splash artwork retains its original treatment.

Expo SDK 58 requires `expo-system-ui` for native Android appearance support; it was installed using `expo install`. `app.json` enables automatic appearance and its config plugin. Rebuild the development app to apply native configuration changes; a JavaScript reload alone does not apply the plugin. Theme tests use the installed AsyncStorage package's official Jest mock and real theme providers rather than theme stubs.

## Connected Firebase project

The app is configured for `manshyat-amar` with Standard Firestore in Frankfurt (`europe-west3`). Email/password and Google providers are enabled; the category catalog, security rules, and indexes are deployed. The earlier mock-phase descriptions above are historical; production sessions and requests now use Firebase rather than simulated sign-in.

## Android launch readiness

The launch-readiness pass does **not** declare the app production-ready. Support and privacy links use owner-supplied values in `src/features/support/config.ts`.
In-app account deletion requires confirmation and reauthentication (Password or
Google), deletes user-owned Firestore records and Cloudinary photos via
`DELETE /v1/account`, and deletes the Firebase Auth account immediately.
Production data was not deleted, and no signed release, Play upload,
signing-key creation or rules deployment was performed.
