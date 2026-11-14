# Android release candidate — 2026-11-04

Overall: BLOCKED. No signed AAB was built, uploaded, submitted, or published. No production Firebase data, rules, or providers were changed.

## Identity and architecture

| Item | Status | Evidence |
| --- | --- | --- |
| Architecture | PASS | Expo 58.0.23, React Native 0.88.1, Expo Router, npm/package-lock.json. CNG with locally generated Android directory ignored by Git. |
| Name/version | PASS | منشأة العمار, version 1.0.0, Android versionCode 1 in app.json and local Gradle. Confirm code 1 is unused in Play before first upload. |
| Package consistency | PASS | com.ahmedalianz.manshaetelammar matches app.json, Gradle, and google-services.json. Identifier was preserved; owner should confirm this permanent identity before first Play upload. |
| Icons | PASS | app-icon.png exists, square 1254×1254; adaptive foreground references this asset. Splash asset exists, 941×1672. Visual safe-zone/cropping NOT TESTED. |
| Orientation/RTL | PASS | Portrait, Arabic locale and forced RTL in Expo config; local native supportsRtl and adjustResize. Device behavior NOT TESTED. |
| Build profile | PASS | Existing eas.json production: store distribution, production environment, app-bundle, remote credentials, local version source. |
| Native configuration | BLOCKED | Ignored local Android directory is stale: allowBackup=true and storage/overlay/vibration permissions conflict with current app.json. Do not use that local directory as the release source. EAS archive must exclude android/ so CNG regenerates native settings from app.json. Final merged release manifest and SDK levels NOT TESTED. |
| Signing | BLOCKED | EAS whoami now succeeds for ahmedalianz. project:info and env:list fail because the repository is not linked to an EAS project. No owner-approved keystore verified or generated. Local Gradle release uses debug signing and is unsuitable for Play as-is. EAS injects managed release signing during its build. |
| AAB | BLOCKED | No artifact/build URL. JS export is not an AAB or native compilation proof. |

## Executed preflight

| Check | Status | Result |
| --- | --- | --- |
| npm run typecheck | PASS | Exit 0 |
| npm run lint | PASS | Exit 0 |
| npm test -- --silent | PASS | 28 suites, 260 tests |
| npm run test:rules | PASS | 35 tests, including real Auth emulator integration, isolated demo-manshaet project |
| npx expo config --type public --json | PASS | Config resolved successfully |
| npx expo export --platform android --output-dir /private/tmp/ammar-rc-export | PASS | Hermes Android bundle and assets exported |
| npx eas-cli@latest whoami | PASS | Authenticated as ahmedalianz |
| EAS project:info / production env:list | BLOCKED | EAS project not configured |
| Native compilation/release installation | NOT TESTED | No signed build |
| npx expo-doctor | PASS | 20/20 checks; cloud native validation remains NOT TESTED |

## Firebase and security audit

Firebase project: manshyat-amar. Local Firebase project, app ID and API key match google-services.json; Android registration matches the package. Required local public Firebase and Google web-client variables are present. Values were not printed. Production vs staging ownership/purpose remains BLOCKED pending owner confirmation. Remote EAS production variables and deployed Firebase settings were NOT TESTED.

| Requirement | Status | Evidence / limitation |
| --- | --- | --- |
| Admin authority | PASS | Rules use signed custom admin claims, not editable profile fields. Profile hasOnly prevents self-assigned roles. Emulator escalation tests pass. |
| Ownership and moderation | PASS | Owners cannot publish, approve, update another owner’s history, or mutate submitted requests. Admin-only public writes; request slots bound atomically. Tests pass. |
| Private proposals | PASS | Pending/rejected serviceRequests are private to owner/admin. Published providers is a deliberately public projection, and unpublish deletes the public document. Admin SDK/console bypasses rules; operators must preserve this invariant. |
| Public data projection | PASS | Admin publication explicitly copies approved service fields, intentionally public phone/address, ownerId and timestamps. Private profile/email/review metadata is not copied. Owner UID is public in published provider records; confirm this intended exposure. |
| Public document invariant | NOT TESTED | Rules allow every providers document to be read; protection relies on only publishing approved snapshots. Trusted admins can write arbitrary documents. No production document inspection was performed. |
| Account deletion | BLOCKED | In-app deletion route and public page link exist. App opens an email request; no automatic Auth/data deletion. In-app text says retention and processing timeline are not approved. Verify ownership checks, Auth deletion and associated published/private-data handling using a disposable account before declaring the flow functional. |
| Mock shortcuts/contact fallbacks | PASS | Production source scan found no mock admin/provider data fallback. Contact code validates published Firestore data; prior tests cover action behavior. Real-device intents NOT TESTED. |
| Secrets | PASS | No firebase-admin imports/private-key markers found under src. Admin SDK is used outside client code; dependency alone does not prove bundling. Emulator routing and diagnostics are __DEV__ gated. No production mutations made. |
| Production Auth/Google OAuth | BLOCKED | Native Google Sign-In is present. Verify enabled providers in Firebase Console and register release signing SHA fingerprints for Google sign-in. Email/password does not require a signing SHA. For Play-distributed app use Play App Signing certificate fingerprints, not only the upload certificate. |
| Production rules/index parity | NOT TESTED | Emulator verifies repository rules, not the currently deployed version. Owner must verify deployed rules/indexes, including address-only submissions. Do not deploy as part of this audit. |

Rule audit summary: no non-admin privilege bypass found in reviewed paths and tested cases. Remaining concerns are trusted-admin public collection invariants, public owner UID exposure, and unverified deployed parity. This is a focused audit, not a security guarantee.

## Environment and permissions

- PASS: production profile selects EAS production environment. Local .env is ignored, so local success does not establish cloud configuration.
- BLOCKED: confirm EAS production variables: EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_APP_ID, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. These client values are public; never put Admin credentials/private keys in EXPO_PUBLIC variables.
- PASS: .gitignore excludes generated native directories, .env files and common private-key formats; this audit additionally excludes credentials.json, service-account*.json and Android artifacts.
- PASS: app.json blocks direct-call, contacts, storage, overlay and vibration permissions and disables backup. Final merged manifest NOT TESTED.
- NOT TESTED: final target/compile SDK, installed Android back navigation, edge-to-edge, safe areas, keyboard and external tel/WhatsApp intents.
- NOT TESTED: public legal pages. URLs are configured, but the research browser could not retrieve their contents. Owner confirms hosting; verify reachability/content on a real device.

## Owner actions and build

Authentication now succeeds; project linkage is required and the requested build was not started. From the project root:

```sh
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest env:list --environment production
npx eas-cli@latest credentials --platform android
```

If the project is not linked, run `npx eas-cli@latest init` interactively under the correct owner account, selecting the intended project. Do not change the package ID. Review the production variables privately. In the credentials flow inspect existing credentials; stop before creating a new keystore until the owner explicitly approves creation. Never commit exported signing files. Confirm certificate fingerprints and Google OAuth configuration. Authentication, account/project ownership and signing remain owner actions.

Before starting: resolve deletion-operation readiness, confirm Firebase environment/deployed parity, inspect the EAS archive to ensure generated android/ and private files are excluded and google-services.json is included, then rerun the preflight commands above against a frozen source revision. Existing profile requires no replacement.

```sh
npx expo-doctor
npx eas-cli@latest build --platform android --profile production
```

Expected output is a completed EAS build page with a signed `.aab` download. Record build ID, source commit, resolved production environment, certificate fingerprint, versionCode and artifact checksum here after completion. Native compilation/signing failures must be resolved and reported separately. Do not run eas submit.

## Manual Google Play Internal Testing (NOT TESTED)

1. Create or select the correct application in Play Console; confirm permanent package com.ahmedalianz.manshaetelammar before upload.
2. Complete required account/app declarations and review Play App Signing. Download signing-certificate SHA fingerprints and register them for Firebase Google sign-in; verify the Play-installed build.
3. Open Test and release → Testing → Internal testing. Create a release and manually upload the completed AAB. Confirm package/versionCode and enter honest release notes.
4. Add a tester email list or Google Group. Owner reviews and starts only the internal testing release manually. No public production release is authorized.
5. Share the opt-in link with those testers. They must opt in with the invited Google account and install from Google Play. An AAB is not directly installable like an APK.
6. Capture version/build, device/OS, reproduction steps and redacted screenshots for failures. Review Android vitals/available crash evidence; no Crashlytics setup is assumed.

## Android device checklist (all NOT TESTED)

Use dedicated test users/listings only. Record actual device, Android version, app versionCode and outcomes; never delete or moderate real provider data for QA.

- [ ] Register/login/logout; wrong password; reset; authenticated restart; offline authentication; Google login with Play signing.
- [ ] Request deletion from in-app/web flow; verify owner identity and actual removal of disposable Auth account and associated data, with documented retained data/timeline.
- [ ] Submit service with address text and no area; verify pending state; repeated taps and network interruption do not create duplicate submissions.
- [ ] Edit a published service; verify old public snapshot remains while edit awaits review; inspect My Services statuses and rejection reason; retry rejected request.
- [ ] Admin account reviews pending requests, approves/rejects, manages reports and unpublishes. Non-admin accounts cannot perform those operations via SDK.
- [ ] On another account/device, approved service appears; pending/rejected proposals and unpublished records remain inaccessible. Verify private profile and requests are protected.
- [ ] Home/Explore/search/category filters/provider details; call, WhatsApp, copy; unavailable/unpublished provider contact revalidation.
- [ ] Arabic RTL, light/dark/system (only Emerald currently implemented), small screen, large fonts, 360/390/412dp, keyboard open, Android back and deep link, status/navigation bars and safe areas.
- [ ] Start offline; lose/restore connection during reads/submission; actionable errors and retries; no loss of form data and no duplicate requests.
- [ ] Privacy/deletion/support links open on device; no sensitive information appears in logs/screenshots.

## Ranked blockers and next actions

1. BLOCKED — EAS authenticated as ahmedalianz; project linkage is missing, production environment and signing remain unverified. Run interactive EAS init first. No new keys authorized.
2. BLOCKED — deletion operations/timeline/retention are unapproved and unverified; finish and verify using a disposable user.
3. BLOCKED — confirm Firebase project purpose, deployed rules/indexes/Auth/OAuth configuration; do not assume emulator results prove deployed protection.
4. NOT TESTED — native build/merged manifest/SDK compatibility, Play-signed Google sign-in and complete Android QA.
5. NOT TESTED — legal-page contents and branding crop/safe zone, permanent package owner confirmation.

## References

- Expo Android build/signing process: https://docs.expo.dev/build-reference/android-builds/
- EAS production environment: https://docs.expo.dev/eas/environment-variables/
- Google Play Internal Testing: https://support.google.com/googleplay/android-developer/answer/9845334
- Google Play deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111

## EAS linkage follow-up

PASS: project:info confirms @ahmedalianz/manshaet-el-ammar, project ID e2f0e241-c1d3-46f8-b356-e1e21ba04740.
BLOCKED: production env:list succeeds but reports no variables. Confirm manshyat-amar is the intended production Firebase project before configuring public client values. Signing remains unverified; no AAB build started.

## Production environment confirmation

PASS: owner confirmed manshyat-amar for production. All five required Firebase/OAuth public client variables were successfully configured in the project-scoped EAS production environment.
BLOCKED: EAS credentials command confirms no Android credentials are set up for com.ahmedalianz.manshaetelammar. No keystore created; explicit owner approval is required before generating the first upload key. No AAB build started.

## Signing approval and build attempt

PASS: owner explicitly approved first upload keystore creation. EAS created JKS credentials “Android production upload”, selected as default for com.ahmedalianz.manshaetelammar. No private signing material was downloaded or committed.
Upload certificate SHA-1: D6:4F:E7:D5:D5:7E:FC:02:83:08:A1:08:7C:B3:69:28:E1:22:7B:1D.
Upload certificate SHA-256: EE:16:77:EE:17:A3:16:4E:38:71:34:83:33:D5:FE:57:2F:59:5A:48:9D:9A:E6:AC:4D:2F:C5:65:4A:09:B5:D3.
Production build command started using remote default signing and all five EAS production variables. Artifact result pending. Manual QA and deletion-operation verification remain release gates.

## Submitted cloud build

PASS: EAS accepted production Android build 4e52c080-89ee-4196-964a-8be6d627f681 with remote default upload keystore and configured production variables.
Build URL: https://expo.dev/accounts/ahmedalianz/projects/manshaet-el-ammar/builds/4e52c080-89ee-4196-964a-8be6d627f681
Status at last check: IN_QUEUE. Signed AAB artifact remains BLOCKED pending cloud compilation completion. No Google Play upload/submission/publication performed.
To recheck: `npx eas-cli@latest build:view 4e52c080-89ee-4196-964a-8be6d627f681`.

## Approved Android package migration

Owner approved package com.ahmedalianz.manshaetelammar. Firebase app registered in existing manshyat-amar project: 1:289986720924:android:89fe100ebd8c6f0584a959. app.json, google-services.json, local .env, .env.example, EAS production app ID and release-config test were updated. Existing Firebase database/users unchanged. Old-package build 4e52c080-89ee-4196-964a-8be6d627f681 was canceled.
New package default EAS JKS created; SHA-1 C5:86:E2:24:8D:F6:57:15:AE:48:34:CB:48:4C:E7:DB:CE:53:21:73 and SHA-256 8C:FD:91:F1:C6:5B:6B:1C:51:4B:45:9D:AB:E5:E8:7E:17:9C:28:77:EE:2D:B0:85:BE:D3:CD:BD:D0:FE:8E:2A were registered with Firebase. Prior certificate entries were retained; register Play App Signing fingerprints before testing Play Google login.
PASS: typecheck, lint, 2 release-config tests.
Replacement build accepted: https://expo.dev/accounts/ahmedalianz/projects/manshaet-el-ammar/builds/6fc081c6-e9a1-4c18-92bc-0a8a6b7d91de . Artifact completion not yet verified. No Play submission performed. Historical sections above describe previous attempts; this section supersedes their identity/signing/build details.

## Completed AAB verified — 2026-11-05

PASS: EAS build 6fc081c6-e9a1-4c18-92bc-0a8a6b7d91de reports FINISHED. Version 1.0.0, versionCode 1.
AAB: https://expo.dev/artifacts/eas/cNWUXTYoPZpnjgeeFfLjztUNwo_58gfmJUIVrvTQv7k.aab
No Google Play submission performed. Device QA and Play-signed Google login remain NOT TESTED.
