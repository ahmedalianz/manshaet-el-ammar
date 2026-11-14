# Firebase backend setup

Project: `manshyat-amar`. Android app: `1:289986720924:android:dbf9da44d350c33a84a959` (`com.anonymous.manshaetelammar`).

The default Firestore database uses **Standard edition, europe-west3 (Frankfurt)**. Email/password and Google sign-in providers are enabled. Rules and composite indexes are deployed. The thirteen service categories are configured; mock providers and mock accounts were not uploaded.

## Local configuration

`.env` contains the Firebase client configuration and Google OAuth WEB client ID downloaded from the existing project. It is ignored by Git. `google-services.json` is the Android client configuration, referenced by `app.json`. These are public client identifiers, not Admin SDK credentials. Do not add service-account keys to the app.

The app uses Firebase JS Auth with AsyncStorage persistence on native platforms and Firestore repository reads/writes. Registration creates an owner-only profile. Public discovery queries the published `providers` collection; private submissions use `serviceRequests` plus atomic `requestSlots` and explicit publication consent. Pending/rejected submissions never become public merely by being submitted. Claimed administrators can review submissions, publish/unpublish services and close reports through More → إدارة الخدمات; do not treat email/display name as permission to moderate. A trusted server/Admin SDK can assign an `admin` custom claim when an authenticated administrator is selected.

## Google sign-in and Android build

The web app uses Firebase's Google popup. Native sign-in obtains Google's ID token and exchanges it for Firebase credentials. Cancellation does not create a session or show a fake success. The SDK is loaded only when requested, allowing email/password to remain usable in Expo Go. Google native sign-in requires a development/release build.

**Registered local Android certificate:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, extracted from `android/app/debug.keystore`. Firebase registration was verified and `google-services.json` refreshed with the matching Android OAuth client. The current generated Android configuration uses this certificate for both debug and release builds; use production signing credentials before distribution.

For a future EAS or Play build signed with another certificate, obtain its actual SHA-1 and register it:

```sh
npx -y firebase-tools@latest apps:android:sha:create 1:289986720924:android:dbf9da44d350c33a84a959 SHA1_FINGERPRINT --project manshyat-amar
npx -y firebase-tools@latest apps:sdkconfig ANDROID 1:289986720924:android:dbf9da44d350c33a84a959 --project manshyat-amar
```

After a certificate change, refresh `google-services.json` with the downloaded client configuration. For an existing generated Android project, sync the configuration with `npx expo prebuild --platform android`, then rebuild with `npm run android`, or create an EAS development build. Register release/Play App Signing fingerprints separately before distributing. Do not use a fabricated certificate fingerprint. Native iOS Google sign-in additionally requires a Firebase iOS app and matching iOS OAuth configuration; the provided app registration covers Android only.

## Data and security

Firestore rules default to deny. Profiles and request history are owner-scoped; requests require canonical validated fields, consent/server timestamps and a matching atomic slot. Owners cannot publish or approve their own submissions. Published provider documents are public by design, so only information explicitly intended for the public directory belongs there. Profiles and reports remain private. Remove a provider document from the published collection to unpublish it; keep request/slot history.

The deployed rules passed the local emulator authorization suite, including permission-escalation and cross-owner checks. These checks do not replace review before public release.

`node scripts/seed-categories.mjs` adds missing categories only, using the logged-in Firebase CLI administrator. It never uploads sample provider records or overwrites existing category documents. It targets this project explicitly.

## Verification

```sh
npm run typecheck
npm run lint
npm test -- --silent
npm run test:rules
```

The rules/Auth integration suite uses only `demo-manshaet` local emulators and does not send emails or create production users. Google adapter tests mock the native provider and popup; they are not a device Google account login test.

## Configuration checks and evidence boundary

The project/deployment information above records separate project setup work.
The local emulator verification described below loaded the workspace's
`firestore.rules`; it did not fetch or independently verify the rules, indexes,
categories, billing state, or provider settings currently deployed to
`manshyat-amar`. Confirm these in the intended project's Console before operating
on real data. This documentation update performs no production operations.

1. Select the intended existing project in Firebase Console and confirm its
   project ID. Keep the project on Spark; this phase needs no paid service,
   Storage, Functions, SMS authentication, or billing upgrade.
2. Confirm Authentication → Sign-in method enables Email/Password. Review the
   password policy and reset email template. Firebase makes the final password
   acceptance decision; the app implements no password database.
3. Confirm the default Firestore database, reviewed rules and required indexes
   match this repository. The code targets the default database. Index creation
   must finish before the matching queries can succeed.
4. Copy `.env.example` to ignored `.env`, retrieve the public API key from the
   matching client configuration, and retain the matching project/app identifiers.
   The client requires API key, project ID and app ID; the auth domain is also
   used by the web Google flow. Never mix client files from different projects.
5. Leave `EXPO_PUBLIC_FIREBASE_USE_EMULATORS=false` for the real project. Restart
   Expo after environment changes. Missing client values produce a setup message
   and disabled authentication/submission; they do not load mock business data.

All `EXPO_PUBLIC_` values and OAuth client IDs are bundled public identifiers.
Security comes from Authentication and Firestore Rules. Do not put an Admin SDK
service-account key, OAuth client secret, password, or private signing key into
the app's environment or source. Google native configuration changes need a
development/release rebuild; a JavaScript reload does not apply a config plugin.

For web Google sign-in, add the actual hostname to Authentication → Settings →
Authorized domains without a protocol or port. The native Web client ID is the
type-3 OAuth client, not an Android type-1 client. The iOS client environment
value alone does not complete iOS app registration or URL-scheme configuration.
See [Expo Firebase integration](https://docs.expo.dev/guides/using-firebase/),
[Expo Google authentication](https://docs.expo.dev/guides/google-authentication/),
and [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth).

## Isolated local emulators

The installed rules tooling requires Node **24.12+** and Java **21+**. Run:

```sh
npm install
npm run test:rules
```

The runner selects a Java 21+ `JAVA_HOME`, Android Studio's bundled JDK on macOS,
or supported Java on `PATH`. The first run downloads Google's Firestore emulator.
It fixes the project ID to `demo-manshaet`, starts Auth on `127.0.0.1:9099` and
Firestore on `127.0.0.1:8080`, clears the demo emulator data, runs the tests, and
stops the emulators. No Firebase login or real credentials are needed. Do not
share a test run with a manual emulator session whose data you need to retain.

For manual app testing, select Java 21+ and start a separate local session:

```sh
npx firebase emulators:start --only auth,firestore --project demo-manshaet
```

Use an ignored `.env.local` for the app:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=demo-emulator-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-manshaet.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-manshaet
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:local-only
EXPO_PUBLIC_FIREBASE_USE_EMULATORS=true
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2
EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT=9099
EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
```

`10.0.2.2` reaches the host computer from Android Studio's emulator. Use
`127.0.0.1` on web or the iOS simulator. For an Android device attached with ADB,
forward `tcp:9099` and `tcp:8080` with `adb reverse` and use `127.0.0.1` in the
app. The supplied emulator config binds to loopback, not the LAN. Emulator
routing is development-only (`__DEV__`). Restart the app/server when switching
targets and remove or disable `.env.local` before using the real project.

Email/password test accounts and reset emails remain local. Reset links can be
inspected in the Auth emulator outbox. Google OAuth configuration and actual
Google account login are not verified by these emulator tests.

## Exact Firestore schema

Timestamps below are Firestore **Timestamp** values, not strings. Owner client
writes use `serverTimestamp()`; request/profile timestamps must equal server
request time. Omit optional fields when absent; do not send `undefined`, empty
WhatsApp values, or extra proposed-data fields.

| Collection/document           | Fields                                                                                                                                                                       | Access                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                 | `displayName`, `createdAt`, `updatedAt`                                                                                                                                      | Own profile read/create/update; admin read. No client role/admin fields or profile deletion.              |
| `categories/{categoryId}`     | `name`, `description`, `icon`, numeric `order`, boolean `active`                                                                                                             | Public reads require `active: true`; trusted admin maintains catalog.                                     |
| `providers/{providerId}`      | Approved service fields below, `ownerId`, `publishedAt`, `updatedAt`                                                                                                         | Entire document public; admin-only writes/removal. Presence means published.                              |
| `serviceRequests/{requestId}` | `ownerId`, stable `providerId`, `type: create/update/restore`, `status: pending/approved/rejected`, `proposedData`, `createdAt`, `updatedAt`, `consent: true`, `consentedAt` | Owner creates a pending request and reads own history; never owner update/delete.                         |
| `requestSlots/{providerId}`   | `ownerId`, `providerId`, latest `requestId`, `updatedAt`                                                                                                                     | Own read and atomic advancement after review. No client deletion, including custom-claim admins.          |
| `reports/{reportId}`          | `providerId`, `reason`, `reporterId`, `createdAt`                                                                                                                            | Authenticated creation with own UID; admin-only reads/management. No complete reporting UI in this phase. |

Admin review metadata belongs only to requests: `rejectionReason` (nonempty,
maximum 1000 characters on rejection), `reviewedAt`, and `reviewedBy`. Request
owners cannot add these fields when submitting or set their own review status.

Approved service fields and request `proposedData` share this shape:

```text
displayName: required string, 1–100 characters
categoryId: required active category document ID
serviceTitle: required string, 1–160 characters
description: string, up to 2000 characters; empty allowed
phone: canonical Egyptian mobile, 01[0125] followed by 8 digits
whatsapp: optional canonical Egyptian mobile; omit when absent
address: required string, 1–500 characters
location: optional { latitude: number [-90,90], longitude: number [-180,180] }
```

Required text cannot consist only of whitespace. Input accepts Arabic/Persian
digits, spaces, parentheses, hyphens and `+20`/`0020` prefixes, then stores a
local eleven-digit phone number. Location is supported by the schema; the form
still has no map picker and requests no GPS permission.

| Area ID   | Arabic label  |
| --------- | ------------- |
| `center`  | وسط البلد     |
| `dayr`    | داير الناحية  |
| `toukh`   | مدخل طريق طوخ |
| `west`    | غرب السكة     |
| `station` | محطة القطار   |

The category catalog should retain these established IDs:

| ID             | Name                        | Icon                     | Order |
| -------------- | --------------------------- | ------------------------ | ----- |
| `plumbing`     | السباكة والمضخات            | `pipe-wrench`            | 1     |
| `electricity`  | الكهرباء والطاقة            | `lightning-bolt-outline` | 2     |
| `clinics`      | الأطباء والعيادات           | `stethoscope`            | 3     |
| `pharmacies`   | الصيدليات والعلاج           | `medical-bag`            | 4     |
| `carpentry`    | النجارة والأثاث والألوميتال | `hammer-wrench`          | 5     |
| `shops`        | المحلات والبقالة            | `storefront-outline`     | 6     |
| `transport`    | المواصلات ونقل البضائع      | `car-outline`            | 7     |
| `construction` | البناء والتشطيب             | `hammer-screwdriver`     | 8     |
| `appliances`   | تصليح الأجهزة المنزلية      | `washing-machine`        | 9     |
| `education`    | تعليم ودروس                 | `book-open-variant`      | 10    |

Additional categories: `tailoring` (الخياطة والتطريز), `laundry` (مغسلة), and `sewage-trucks` (عربات الكسح), with catalog order values 10–12. The stable `carpentry` ID also includes الألوميتال.

Each category also needs a concise `description` and `active: true` to appear.
Known IDs retain their existing search/group metadata; unsupported icons use a
generic fallback. Public category queries must include `active == true`.

## Manual review, publication and recovery

The app supports real approve/reject operations for accounts with the admin claim.
After sign-in, admins open the dashboard directly, or use More → إدارة الخدمات.
The dashboard loads up to 100 pending requests, 100 most recently published services,
and 100 most recent reports, refreshes every 30 seconds, and supports pull to refresh.
Approvals atomically update request status and the public provider projection;
rejections retain published data. Transactions reject stale/already-reviewed requests.
Loading, errors, retry, empty states and duplicate-action guards are handled.
Use authorized Console access for manual recovery or records outside these limits.
The app never assigns administrator claims. The
rules recognize only Auth custom claim `admin: true` for privileged client
operations; profile fields, email addresses and UID spelling cannot grant it.
Claim assignment belongs in a separately authorized trusted Admin SDK
environment, never inside this app. See
[Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

### New-service approval or rejection

1. Open the pending request and confirm the owner exists in Authentication.
   Confirm its stable `providerId`, that the matching request slot points to
   this request/owner, and that consent, contact/address data and category are
   appropriate. Do not review a superseded/already-reviewed request as pending.
2. On approval, create `providers/{providerId}` using **the same ID**. Copy only
   the reviewed `proposedData` fields, add the request's `ownerId`, and set
   `publishedAt`/`updatedAt` as Timestamp values. Do not copy consent, rejection,
   review metadata, email or private notes into public provider data.
3. After the approved snapshot is present, update the request with
   `status: approved`, `reviewedAt`, `reviewedBy`, and `updatedAt`.
4. On rejection, leave the public provider absent and instead set
   `status: rejected`, a clear `rejectionReason`, `reviewedAt`, `reviewedBy`, and
   `updatedAt`. A rejected create can be resubmitted with the same provider ID.
5. Retain the original request and slot. The next owner transaction sees the
   reviewed status and advances the slot to a new immutable request. No manual
   slot clearing is necessary.

### Edit review, unpublishing and reports

- An update targets an existing provider belonging to the same owner. Compare
  published values to the proposal, apply only reviewed changes, preserve
  `ownerId` and `publishedAt`, update `updatedAt`, then mark the request approved
  with review metadata. Rejection updates only the request; the published
  provider stays unchanged.
- Unpublish by removing the public provider document while preserving all
  request/slot history. Reject pending updates with an explanation. Never apply
  a pending update by recreating a removed provider. Approved create/update
  history prevents owner recreation under that same stable ID.
- An admin may mark a report `status: closed` and add a `closedAt` Timestamp.
  Closing it does not alter publication. Reporting users cannot read reports,
  including their own.

Never overwrite submitted `proposedData`, change owner/type/provider IDs, delete
history/slots to unlock a service, or publish without an originating request
and retained slot. Pending proposals cannot be replaced by the owner. Review
first; a correction is a new request after rejection.

The Console cannot commit an atomic cross-document review. Write the approved
provider snapshot **before** marking the request reviewed so an interrupted
operation retains the pending lock. After interruption, inspect both records
and finish the review metadata only when the snapshot is correct; do not create
a second provider ID. Future trusted moderation should use a transaction or
batch for snapshot/review writes. Console/Admin SDK access bypasses rules and
must preserve these invariants operationally. See
[Firebase transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

### Account and submission failures

- If account creation succeeds but its profile write fails, sign in with the
  same email/password after fixing connectivity/rules. Sign-in retries a missing
  profile. Do not create another account to recover that failure.
- Account name edits update `users/{uid}.displayName`; they do not rename
  published service display names. Email/password remain in Firebase Auth.
- Retry an uncertain submission within the same form session: it retains its
  submission ID and recognizes an identical stored request instead of writing
  another. A changed payload reports a mismatch. After reopening/reloading,
  refresh My Services before adding again.
- Concurrent requests for a stable provider contend on the same slot; one
  pending request wins. A request and its slot must be written atomically.
- For `permission-denied`, check the signed-in UID, deployed rules, owner query
  filter, active category, slot/review status, consent and normalized fields.
  Do not loosen rules or add profile role fields as a workaround.
- For missing-index errors, compare the query to `firestore.indexes.json` and
  have the intended project's administrator create the reviewed index. Do not
  replace private owner queries with unrestricted collection reads.

## Query and feature limits

- Public feed: newest **100** by `publishedAt`; category feed: newest **50** for
  that category. Owner providers and owner requests: newest **100** each.
  Categories: up to **100** active entries ordered by `order`.
- Search/filtering covers fetched records, not the entire database. These
  limits are not pagination. Public providers have a five-minute query stale
  period and categories thirty minutes. Refresh/retry after manual moderation;
  there is no realtime moderation notification.
- Repository reads use the server; submission transactions need connectivity.
  No durable offline draft/outbox is provided. Native Auth session persistence
  uses AsyncStorage; application passwords are not stored by the app.
- Every published provider field, including `ownerId`, is public. User profiles,
  requests and reports are private. Keep private coordinator notes, credentials,
  identity documents and profile emails out of provider documents.
- Native iOS Google setup/device sign-in, image
  uploads, professional verification, ratings, map selection, GPS discovery and
  push notifications are outside the current verification. Provider Details contact actions now support eligible published records; see
  [contact behavior and verification](contact-actions.md). Signed-in users can submit private in-app reports from provider details; the existing admin report queue receives them.
- Former demo accounts/fixtures are not migrated or silently mixed with Firebase
  business records. Empty/configuration/error states reflect the configured
  backend instead of falling back to demo records.

## Actual local verification

`npm run test:rules` passed **35 tests across five suites**: 32 authorization,
schema and atomic-slot checks plus three real Firebase SDK Auth/profile/reset
checks. Tests include guest privacy, owner scoping, forged admin claims,
profile validation, self-approval denial, valid/invalid fields, immutable
requests, rejected-create resubmission, create-after-unpublish denial, retained
history, stale/concurrent slots and the repository's exact bounded queries.

These results do not verify deployed project configuration, production index
readiness, Google OAuth, actual email delivery, iOS or physical-device network
behavior. The Firestore emulator does not prove production composite indexes
exist. See [the emulator test guide](../rules-tests/README.md).

### Admin service removal (2026-11-08)

A read-only comparison found that production rules lack the `serviceQuotas`
permissions used by the current unpublish transaction. Repository rules now
include admin-only deletion of `serviceRequests` and `requestSlots`; providers
and guests remain unable to delete those records.

The admin service screen offers separate confirmations:

- **إلغاء نشر الخدمة** removes the public provider and releases its quota
  reservation, retaining submission and slot history.
- **حذف الخدمة نهائيًا** removes the provider, request slot and all associated
  service submissions atomically, releasing the quota reservation. Reports
  remain private admin review records. Accounts and other services are retained.

Concurrent submissions abort deletion until the admin refreshes. Histories over
400 requests require Console handling rather than partial deletion.

Verification: typecheck, lint, 353 app tests, 43 Firebase emulator tests and
Firebase rules deployment dry run passed. No production service was deleted or
unpublished for testing. Production deployment remains pending explicit approval:
automatic approval review rejected the production access-control deployment.

### Production rules and workflow verification — 2026-11-12

This deployment supersedes the pending-deployment note above. The user explicitly
approved deployment of both the reviewed quota/removal rules and the latest
archive/restore rules after concurrent workspace changes were detected.

- Project: `manshyat-amar`; database: `(default)`.
- Ruleset: `projects/manshyat-amar/rulesets/6288a788-d324-4082-9693-31abba35fe1e`.
- Release timestamp (UTC): `2026-11-12T17:48:03.569440Z`.
- Deployed source exactly matched the frozen reviewed snapshot. SHA-256:
  `103cc47a139f1d0d63f4640a27f324300dfba0a977fe73380f2eb82c74da747a`.
- Both required archive composite indexes reached **READY**.
- Initialized **two missing quota documents** for existing active service owners
  using Firestore transactions. Existing quota records were preserved; no
  existing service record was changed by migration or verification.

Production verification used the actual application repository functions from a
frozen source snapshot and Firebase client SDK sessions against production, so
the workflow writes were subject to Security Rules. Two temporary Auth accounts
provided owner and claimed-admin sessions; an unauthenticated session checked
public visibility. Administrative OAuth access was used only for temporary
account setup, ownership-checked cleanup, deployment checks, and quota migration.
No firebase-admin dependency was installed.

Verification run: `smoke-1794514034615-2f59c96f`.

- Temporary owner and claimed-admin client sessions established
- Owner can read missing quota and create own profile
- Production submission is pending, private, and reserves quota atomically
- Guest private reads, owner self-approval and quota escalation are denied
- Claimed admin approval publishes public service and updates private request
- Owner cannot delete published service, submissions or slots
- Admin unpublish hides service, preserves history and releases quota
- Archive is visible to its owner/admin but private from guests; owner cannot forge restoration
- Admin restoration republishes service and reserves quota
- Owner correction/resubmission requires admin approval; private archive metadata stays private
- Admin permanent deletion also removes previously unpublished service history
- Admin permanent deletion removes published service and pending edit atomically

The verification briefly published two clearly labeled technical test services.
No calls, WhatsApp messages, support emails, or actual customer interactions were
triggered. Temporary test users, claims, profiles, quotas, submissions, slots,
public providers and archives were removed; their absence was checked with
production server reads and Auth lookup. An earlier failed run caused by
concurrent archive changes was also fully cleaned up before this successful run.

Local Firebase emulator verification passed **46 tests across nine suites**,
including archive privacy and consent/quota requirements for restore requests.
This verifies production backend authorization and repository behavior; it is not
a new Android/iOS UI or release-build test.

### Unpublished archive and recovery

See [unpublished-service-recovery.md](unpublished-service-recovery.md) for the new private archive schema, owner correction/admin restore workflow, rollout requirements, legacy-data limitations and manual checks. The recovery implementation supersedes the earlier remove-public-document-only unpublish behavior. Include `archivedProviders` in account-data deletion handling. Deployment of the archive rules and indexes is still required before shipping this update.

Final app-wide verification after concurrent edits settled: **403 tests across
45 suites passed**, lint passed, and the final typecheck passed. The transient
Explore style type error encountered during concurrent editing was absent on
the final typecheck.

### In-app service reports — 2026-11-12

Provider details open `/provider/report/[id]`. The service ID is fixed to the
selected service and shown alongside its name. Guests sign in and return to that
same report; browsing remains available without an account. The reason must be
nonblank and no longer than 1,000 characters. The server is checked for current
service existence before saving.

The existing `reports` create schema is unchanged: `providerId`, `reporterId`,
trimmed `reason`, and `createdAt` using a server timestamp. New reports are mapped
as open by the admin repository. Confirmation and the report reference appear
only after Firebase acknowledges the write. Repeated taps are blocked while
sending; failed writes retain the reason for retry. Reports remain admin-readable
only, including after submission; submission does not unpublish the service.
No Security Rules change or deployment was required for this feature.
