# Local Firebase authorization checks

Run `npm run test:rules` with Node 24.12+ and Java 21+. The runner uses
`JAVA_HOME` when it points to Java 21+, otherwise it checks Android Studio's
bundled JDK on macOS and then Java on `PATH`. The first run downloads Google's
Firestore emulator. No Firebase login, credentials, real project, deployment,
or paid service is required.

The project ID is fixed to `demo-manshaet`. Auth and Firestore bind to
`127.0.0.1:9099` and `127.0.0.1:8080`. Test files reject any other host. Each run
clears this demo project's emulator data; run it separately from a manual
emulator session whose contents you want to retain.

The rules suite verifies public category/provider reads, private owner queries,
custom admin claims, profile field validation, immutable requests, consent,
canonical category/phone validation and rejection of obsolete area fields, protected reporting, and atomic request
slots including concurrent transactions. A separate integration suite uses the
actual Firebase Auth SDK to register/sign in and save a Firestore profile; reset
emails are inspected in the local emulator outbox and never sent.

## Request-slot lifecycle

Providers submit one new `serviceRequests/{requestId}` document and update
`requestSlots/{providerId}` in the same transaction. `getAfter` binds the two
writes. The stable provider ID and owner never change, and owners cannot update
or delete submitted request documents. Pending proposals cannot be replaced.

An administrator reviews the referenced request by setting its status and review
metadata. The slot is retained unchanged. A later owner transaction reads that
historical request to establish that review completed, then points the slot to a
new pending request. A rejected create can be resubmitted with the same stable
provider ID. Approved create history or any update history prevents recreating
the same provider after it is unpublished. Slots and request history cannot be
deleted through these client rules, including by custom-claim administrators.

The `providers` collection contains only published, approved snapshots. Removing
a provider document unpublishes it; preserve its request slot and history. When
reviewing manually, use an administrator batch/transaction to apply the approved
snapshot and request review metadata together. Custom-claim administrators are
trusted to maintain these publication records; owner clients cannot write them.
Console/Admin SDK access bypasses rules and must preserve the same invariants.

## Emulator limits

The shipped index definitions cover the app's bounded category, public provider,
and owner-history queries. The Firestore emulator does not verify every
production composite-index requirement, so passing local authorization tests is
not evidence that indexes have been created in a real project. Nothing here
deploys rules or indexes.
