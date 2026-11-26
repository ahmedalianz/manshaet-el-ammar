# Service photo Worker

This is the server-only Cloudinary integration for منشأة العمار. It is intentionally **not deployed** and uploads default to **disabled**. Firebase remains on Spark; no Firebase Storage is used.

## Local checks

Node 24 is supported. From this directory run `npm install`, `npm run typecheck`, and `npm test`. The package uses `jose` for verified Firebase RS256 tokens and service-account OAuth. `npm run dev` uses Wrangler; it does not enable uploads. Copy `.dev.vars.example` to ignored `.dev.vars` and enter credentials locally, never in the mobile `.env`.

The repo root checks can run the backend with:

```
node node_modules/typescript/bin/tsc -p backend/photo-worker/tsconfig.json --noEmit
node --experimental-strip-types --test backend/photo-worker/test/*.test.ts
```

## Secrets and production setup

1. Cloudinary Console → Settings → API Keys → reveal **API secret**. Set encrypted Worker secret `CLOUDINARY_API_SECRET`. The cloud name and API key in wrangler.jsonc are configuration; the secret is server-only. Do not put the `CLOUDINARY_URL` containing a secret in any Expo config or browser code.
2. Create a dedicated Google Cloud service account for this Worker in project `manshyat-amar`, with the Firestore access required for photo records, quotas, approved-photo updates, and cleanup. Use `roles/datastore.user` rather than Owner/Editor; this role still bypasses client rules, so keep this key private. Set encrypted `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` secrets. Firebase Console → Project settings → Service accounts links to Google Cloud service-account management. Do not commit/download a key into this repository. Prefer managed key rotation; revoke replaced keys.
3. Set `ALLOWED_ORIGINS` to the comma-separated exact HTTPS web origins if web is used. Native requests have no Origin. Unlisted web origins are rejected.
4. Disable Cloudinary unsigned upload presets for this feature. Verify authenticated originals/derivatives are unavailable without a signature. Public approved photos intentionally have ordinary immutable URLs.
5. Optional encrypted `USAGE_ALERT_WEBHOOK` is an HTTPS endpoint you control; it receives only `{event,threshold,percent}` when 50/75/90% usage is crossed. Without it, thresholds appear in Worker logs and `photoSettings/usage`, not email. Configure host monitoring and failure notifications before production.
6. Deploy Firestore rules and the Worker only after review/approval. Set Expo public `EXPO_PUBLIC_PHOTO_API_URL` to the deployed HTTPS Worker URL. Set `UPLOADS_ENABLED=true` only after a disposable-data smoke test and billing/CPU/request-limit verification. Also set Firestore `photoSettings/control.uploadsEnabled=true` if previously disabled.

The runtime reads both its environment gate and server-owned Firestore `photoSettings/control`. At >=90% Cloudinary credit usage, the hourly task disables uploads and photo processing. It never automatically re-enables them. Alerts and upload gating **cannot cap already-public CDN downloads**. Cloudinary usage API failures are logged and should be monitored. Verify account-specific authenticated delivery, API quotas, and current free-tier availability before enabling production.

Cloudflare Free has CPU and external-subrequest limits. The hourly task alternates service cleanup and two-object cleanup batches to stay bounded; load-test JWT/OAuth, uploads and review on the actual deployed Free runtime. Do not assume production performance is proven by Node tests.

## HTTP contract

Every API requires `Authorization: Bearer <Firebase ID token>` except `/health` and CORS OPTIONS. Admin routes require the verified custom `admin === true` claim. Errors return `{error: string}` with 400/401/403/404/409/413/415/422/429/502/503 statuses. No raw host error, token, private key, or secret is returned.

- `POST /v1/photos/reservations` JSON `{serviceId,submissionId,expectedPhotoVersion?: string|null}` → `{candidateId}`. New service IDs must equal `provider-${submissionId}`. Existing service/archive ownership and the existing active service quota are checked. Transactional daily owner limit is ten reservations; only one active candidate per service is allowed.
- `PUT /v1/photos/candidates/:candidateId` raw JPEG body, Content-Type `image/jpeg` → `{candidateId,status:'uploaded',width,height}`. Streaming hard limit 500,000 bytes; dimensions <=1280; no overwriting/re-uploading. Cloudinary decodes and normalizes the authenticated source. Retrying an uncertain upload requires checking/replacing the reservation, not blindly uploading again.
- `GET /v1/photos/candidates/:candidateId/preview` → JPEG bytes, no-store. Owner/admin only. Never persist an authenticated preview URL or token in Firestore/public image cache.
- `DELETE /v1/photos/candidates/:candidateId` → `{removed:true}`. Owner only, before submission; queues cleanup. Submitted candidates cannot be removed under an admin's review.
- `POST /v1/photos/reviews/:requestId` JSON `{decision:'approved'|'rejected',reason?:string}` → `{photoReviewStatus,approvedPlacePhoto}`. Admin only. Handles replacement and removal using the request's `photoChange`. A rejection requires a reason, maximum 1000 characters. Public photo data is committed independently from text approval and compared against the expected previous version.
- `POST /v1/photos/services/:serviceId/restore` → `{placePhoto}`. Admin only. Call after restoring a service **without** copying archived public photo URLs, because unpublish cleanup may have invalidated them. Republishes from the private approved source. If this fails, the service uses the category fallback; retry explicitly.
- `DELETE /v1/account` → `{deleted,hasMore,deletedProviderIds}`. Authenticated non-admin users only; requires a fresh login (`auth_time` within 5 minutes). Deletes all user-owned Firestore records across bounded passes, removes published/archived services first, and queues/destroys owned Cloudinary photo assets even when uploads are disabled. Repeat while `hasMore` is `true`, then delete the Firebase Auth user on the client.

## Records and lifecycle

`servicePhotos/{candidateId}` stores ownerId, serviceId, submissionId, expectedPhotoVersion, status, private publicId, timestamps, and actual host dimensions/bytes. Approved records also contain approvedPhoto and publicAssets. Clients may read only their private metadata; server writes are required. `photoUploadSlots/{serviceId}` and `photoUploadQuotas/{uid}` are server-only reservation/rate controls.

Requests contain `photoChange: {action:'keep'|'replace'|'remove',candidateId?}`, `photoReviewStatus`, `photoReviewReason`, and server-written `approvedPlacePhoto` (null means approved removal). For photo-first approval, the private request retains the approved reference until text approval creates the public service. For text-first approval, the existing public reference stays unchanged until photo review. Text approval must preserve current public photo metadata when updating an existing provider.

Sources are Cloudinary authenticated assets under `service-photos/private/{uid}/{serviceId}/{candidateId}`. Approved JPEG copies are `service-photos/public/{version}/{thumbnail|detail}`. Only two fixed image variants are generated: <=80KB thumbnail and <=300KB detail. Small simple photos may be below target ranges; these are upper limits, not padding requirements. Public IDs are immutable; versions change on replacement/restoration.

`photoCleanupJobs` holds individual `{publicId,deliveryType,reason,status:'pending',attempts,notBefore,updatedAt}` tasks. Jobs are registered before external writes so crashes leave a cleanup record. A saved cursor advances through deferred jobs to prevent starvation. Referenced approved/private pending sources are retained; superseded pending requests are rejected with an Arabic reason and retained seven days before source deletion.

`photoServiceCleanupJobs` accepts admin-created `{providerId,ownerId,reason:'unpublish'|'delete',state:'pending',createdAt}`. Unpublish removes public images and retains private sources. Delete removes all related objects. Jobs process three records per batch with a persistent cursor; restore/new publication wins over a stale deletion job.

### Immediate self-service account deletion

Signed-in non-admin users reauthenticate on the client (Email/Password or Google) and call `DELETE /v1/account` in passes until `{deleted: true, hasMore: false}`. The Worker validates the recent `auth_time`, hides published/archived services, registers `photoCleanupJobs` before removing `servicePhotos` records, deletes all owned Firestore records (`providers`, `archivedProviders`, `photoUploadSlots`, `requestSlots`, `serviceRequests` + `scheduleValidation`, `reports`, `serviceClaims`, `supportRequests`, `servicePhotos`, `photoServiceCleanupJobs`, and finally `users/{uid}`, `serviceQuotas/{uid}`, `photoUploadQuotas/{uid}`), and performs best-effort immediate Cloudinary deletion for up to 6 assets per pass (leaving any remaining or failed assets in `photoCleanupJobs` for the hourly scheduled cleanup). The client then deletes the Firebase Auth account and clears local drafts/caches. Admin accounts are refused (`403`).

When the asset cleanup queue is idle (`processed < 2`), the scheduled task runs a bounded `reconcileOrphans` pass over Cloudinary `authenticated` and `upload` resources under `service-photos/` older than 25 hours, queuing unreferenced assets for cleanup. Public copies already cached on devices cannot be recalled. Do not promise instant CDN invalidation.

## Verification limitations

Unit checks cover identifier validation, bounded bodies, JPEG dimension/type gates, Firestore codecs/timestamps, authentication failure, CORS, derivative byte limits, dual-order restore lifecycles, cleanup cursor wrap-around, and orphan reconciliation logic against in-memory mocks. They do not claim a live Cloudinary account, Firebase IAM, deployed Worker CPU budget, or CDN invalidation has been verified. Before enablement:
1. Reveal and configure encrypted Worker secrets (`CLOUDINARY_API_SECRET`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, optional `USAGE_ALERT_WEBHOOK`) via Cloudflare dashboard or `wrangler secret put`.
2. Verify Cloudinary account quotas and Cloudflare Free CPU/subrequest budgets.
3. Deploy `firestore.rules` and the Worker with `UPLOADS_ENABLED="false"`.
4. Set `EXPO_PUBLIC_PHOTO_API_URL` to the deployed HTTPS Worker URL and rebuild the native Expo development client (`expo-image`, `expo-image-picker`, `expo-image-manipulator`).
5. Validate end-to-end on disposable services (owner isolation, concurrent edits/reviews, both moderation orders, restoration, deletion, and 90% gating) before enabling a small provider pilot.
