import {
  authenticate,
  boundedBody,
  type Doc,
  type Env,
  HttpError,
  id,
  Store,
} from './platform.ts';
import { type Asset, Cloudinary, jpegDimensions } from './cloudinary.ts';
const now = () => new Date().toISOString();
const future = (hours: number) =>
  new Date(Date.now() + hours * 3600000).toISOString();
const MAX_BYTES = 500000;
const RECENT_AUTH_MAX_AGE_SECONDS = 300;
const MAX_IMMEDIATE_CLOUD_DESTROYS = 6;
const candidatePath = (candidateId: string) =>
  `servicePhotos/${id(candidateId)}`;
const queuePath = (asset: Asset) =>
  `photoCleanupJobs/${asset.publicId.replaceAll('/', '_')}_${asset.deliveryType}`;
const sourceAsset = (candidate: Doc): Asset => ({
  publicId: candidate.publicId,
  deliveryType: 'authenticated',
});
const activeArchive = (archive: Doc | null) =>
  archive?.archiveStatus === 'unpublished' ? archive : null;
const publicAssets = (version: string): Asset[] =>
  ['thumbnail', 'detail'].map((kind) => ({
    publicId: `service-photos/public/${version}/${kind}`,
    deliveryType: 'upload',
  }));
function queue(
  store: Store,
  writes: any[],
  assets: Asset[],
  reason: string,
  notBefore = now(),
) {
  for (const asset of assets)
    writes.push(
      store.write(queuePath(asset), {
        ...asset,
        reason,
        status: 'pending',
        attempts: 0,
        notBefore,
        updatedAt: now(),
      }),
    );
}
function owner(
  candidate: Doc | null,
  uid: string,
  admin = false,
): asserts candidate is Doc {
  if (!candidate || (!admin && candidate.ownerId !== uid))
    throw new HttpError(404, 'Photo not found');
}
async function json(request: Request) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 4096)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid JSON');
  }
}
async function reserve(
  request: Request,
  env: Env,
  store: Store,
  uid: string,
  isAdmin = false,
) {
  if (env.UPLOADS_ENABLED !== 'true')
    throw new HttpError(503, 'Photo uploads are not enabled');
  const input = await json(request);
  const serviceId = id(input.serviceId),
    submissionId = id(input.submissionId);
  const version = input.expectedPhotoVersion ?? null;
  if (version !== null) id(version);
  const candidateId = crypto.randomUUID().replaceAll('-', '');
  await store.transaction(async (tx, writes) => {
    const provider = await store.get(`providers/${serviceId}`, tx),
      archive = activeArchive(
        await store.get(`archivedProviders/${serviceId}`, tx),
      );
    const existingRequest = await store.get(
      `serviceRequests/${submissionId}`,
      tx,
    );
    const slot = await store.get(`photoUploadSlots/${serviceId}`, tx);
    const quota = await store.get(`photoUploadQuotas/${uid}`, tx);
    const activeCandidate = slot?.candidateId
      ? await store.get(candidatePath(id(slot.candidateId)), tx)
      : null;
    const attachedRequest = activeCandidate
      ? await store.get(
          `serviceRequests/${id(activeCandidate.submissionId)}`,
          tx,
        )
      : null;
    const control = await store.get('photoSettings/control', tx);
    if (
      attachedRequest?.photoReviewStatus === 'pending' &&
      attachedRequest.photoChange?.candidateId === slot?.candidateId
    )
      throw new HttpError(409, 'An existing photo is awaiting review');
    if (control?.uploadsEnabled === false)
      throw new HttpError(503, 'Photo uploads paused');
    if (provider || archive) {
      if (!isAdmin && (provider || archive)!.ownerId !== uid)
        throw new HttpError(403, 'Not your service');
    } else {
      if (serviceId !== `provider-${submissionId}`)
        throw new HttpError(403, 'Invalid new service reservation');
      if (existingRequest && !isAdmin && existingRequest.ownerId !== uid)
        throw new HttpError(403, 'Not your submission');
    }
    if (((provider ?? archive)?.placePhoto?.version ?? null) !== version)
      throw new HttpError(409, 'Photo changed on another device');
    if (slot?.candidateId && slot.expiresAt > now())
      throw new HttpError(
        409,
        'A photo candidate already exists; remove it before replacing',
      );
    const day = now().slice(0, 10),
      attempts = quota?.day === day ? quota.attempts : 0;
    if (!isAdmin && attempts >= 10)
      throw new HttpError(429, 'Daily upload limit reached');
    const expiresAt = future(24);
    const serviceOwnerId = (provider ?? archive)?.ownerId ?? uid;
    const privatePublicId = `service-photos/private/${serviceOwnerId}/${serviceId}/${candidateId}`;
    writes.push(
      store.write(candidatePath(candidateId), {
        candidateId,
        ownerId: serviceOwnerId,
        serviceId,
        submissionId,
        expectedPhotoVersion: version,
        status: 'reserved',
        publicId: privatePublicId,
        createdAt: now(),
        updatedAt: now(),
        expiresAt,
      }),
    );
    queue(
      store,
      writes,
      [{ publicId: privatePublicId, deliveryType: 'authenticated' }],
      'expired-reservation',
      expiresAt,
    );
    writes.push(
      store.write(`photoUploadSlots/${serviceId}`, {
        ownerId: serviceOwnerId,
        candidateId,
        expiresAt,
      }),
    );
    if (!isAdmin)
      writes.push(
        store.write(`photoUploadQuotas/${uid}`, {
          day,
          attempts: attempts + 1,
          updatedAt: now(),
        }),
      );
  });
  return { candidateId };
}
async function upload(
  request: Request,
  env: Env,
  store: Store,
  uid: string,
  candidateId: string,
  isAdmin = false,
) {
  if (env.UPLOADS_ENABLED !== 'true')
    throw new HttpError(503, 'Photo uploads disabled');
  if (request.headers.get('content-type')?.split(';')[0] !== 'image/jpeg')
    throw new HttpError(415, 'JPEG images only');
  const bytes = await boundedBody(request, MAX_BYTES);
  jpegDimensions(bytes);
  const token = crypto.randomUUID();
  let candidate: Doc = {};
  await store.transaction(async (tx, writes) => {
    const data = await store.get(candidatePath(candidateId), tx);
    owner(data, uid, isAdmin);
    candidate = data;
    const control = await store.get('photoSettings/control', tx);
    if (control?.uploadsEnabled === false)
      throw new HttpError(503, 'Photo uploads paused');
    if (data.status !== 'reserved' || data.expiresAt <= now())
      throw new HttpError(409, 'Candidate cannot be uploaded');
    writes.push(
      store.write(
        candidatePath(candidateId),
        { status: 'uploading', uploadToken: token, updatedAt: now() },
        true,
      ),
    );
    // Pre-register cleanup before external upload, so process termination cannot orphan an object.
    queue(
      store,
      writes,
      [sourceAsset(data)],
      'abandoned-upload',
      data.expiresAt,
    );
  });
  const cloud = new Cloudinary(env);
  const image = await cloud.upload(candidate.publicId, bytes, 'authenticated');
  await store.transaction(async (tx, writes) => {
    const data = await store.get(candidatePath(candidateId), tx);
    owner(data, uid, isAdmin);
    if (data.status !== 'uploading' || data.uploadToken !== token)
      throw new HttpError(409, 'Upload reservation changed');
    writes.push(
      store.write(
        candidatePath(candidateId),
        {
          status: 'uploaded',
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          updatedAt: now(),
        },
        true,
      ),
    );
  });
  return {
    candidateId,
    status: 'uploaded',
    width: image.width,
    height: image.height,
  };
}
async function remove(
  store: Store,
  uid: string,
  candidateId: string,
  isAdmin = false,
) {
  await store.transaction(async (tx, writes) => {
    const data = await store.get(candidatePath(candidateId), tx);
    owner(data, uid, isAdmin);
    const request = await store.get(
      `serviceRequests/${id(data.submissionId)}`,
      tx,
    );
    const slot = await store.get(`photoUploadSlots/${id(data.serviceId)}`, tx);
    if (request?.photoChange?.candidateId === candidateId)
      throw new HttpError(409, 'Submitted photos must be reviewed first');
    if (!['reserved', 'uploaded', 'uploading'].includes(data.status))
      throw new HttpError(409, 'Candidate cannot be removed');
    writes.push(
      store.write(
        candidatePath(candidateId),
        { status: 'deleted', updatedAt: now() },
        true,
      ),
    );
    if (slot?.candidateId === candidateId)
      writes.push(
        store.write(`photoUploadSlots/${data.serviceId}`, {
          ...slot,
          expiresAt: now(),
        }),
      );
    queue(store, writes, [sourceAsset(data)], 'owner-removed');
  });
  return { removed: true };
}
async function reviewPhoto(
  request: Request,
  env: Env,
  store: Store,
  requestId: string,
  adminUid: string,
) {
  const input = await json(request);
  if (!['approved', 'rejected'].includes(input.decision))
    throw new HttpError(400, 'Invalid decision');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (input.decision === 'rejected' && (!reason || reason.length > 1000))
    throw new HttpError(
      400,
      'Rejection reason required (maximum 1000 characters)',
    );
  const lockToken = crypto.randomUUID(),
    version = crypto.randomUUID().replaceAll('-', '');
  let proposal: Doc = {},
    candidate: Doc | null = null,
    expected: string | null = null;
  const assets = input.decision === 'approved' ? publicAssets(version) : [];
  await store.transaction(async (tx, writes) => {
    const data = await store.get(`serviceRequests/${requestId}`, tx);
    if (
      !data ||
      !['replace', 'remove'].includes(data.photoChange?.action) ||
      data.photoReviewStatus !== 'pending'
    )
      throw new HttpError(409, 'Photo request is not pending');
    if (
      input.decision === 'approved' &&
      data.photoChange.action === 'replace'
    ) {
      if (env.UPLOADS_ENABLED !== 'true')
        throw new HttpError(503, 'Photo processing paused');
      const control = await store.get('photoSettings/control', tx);
      if (control?.uploadsEnabled === false)
        throw new HttpError(503, 'Photo processing paused');
    }
    const provider = await store.get(`providers/${id(data.providerId)}`, tx);
    const rawArchive = await store.get(
      `archivedProviders/${id(data.providerId)}`,
      tx,
    );
    const archive = activeArchive(rawArchive);
    const slot = await store.get(`requestSlots/${id(data.providerId)}`, tx);
    const lock = await store.get(`photoReviewLocks/${requestId}`, tx);
    candidate =
      data.photoChange.action === 'replace'
        ? await store.get(candidatePath(id(data.photoChange.candidateId)), tx)
        : null;
    if (slot?.requestId !== requestId || slot.ownerId !== data.ownerId)
      throw new HttpError(409, 'A newer request exists');
    if (lock?.expiresAt > now())
      throw new HttpError(409, 'Photo review already running');
    if (provider && provider.ownerId !== data.ownerId)
      throw new HttpError(409, 'Service ownership changed');
    if (
      candidate &&
      (candidate.ownerId !== data.ownerId ||
        candidate.submissionId !== requestId ||
        candidate.serviceId !== data.providerId ||
        candidate.status !== 'uploaded')
    )
      throw new HttpError(409, 'Candidate does not match this submission');
    if (data.photoChange.action === 'replace' && !candidate)
      throw new HttpError(404, 'Photo candidate unavailable');
    const restoreFallbackVersion =
      data.type === 'restore' &&
      provider &&
      !provider.placePhoto &&
      rawArchive?.archiveStatus === 'restored'
        ? (rawArchive.placePhoto?.version ?? null)
        : undefined;
    expected =
      restoreFallbackVersion !== undefined
        ? restoreFallbackVersion
        : ((provider ?? archive)?.placePhoto?.version ?? null);
    if (
      data.photoChange.action === 'remove' &&
      data.photoChange.expectedPhotoVersion !== expected
    )
      throw new HttpError(
        409,
        'Approved photo has changed; review the current version first',
      );
    if (candidate && candidate.expectedPhotoVersion !== expected)
      throw new HttpError(
        409,
        'Approved photo has changed; submit a new candidate',
      );
    proposal = data;
    writes.push(
      store.write(`photoReviewLocks/${requestId}`, {
        token: lockToken,
        expiresAt: future(0.17),
      }),
    );
    if (input.decision === 'approved' && candidate)
      queue(store, writes, assets, 'failed-publication', future(1));
  });
  let published: Awaited<ReturnType<Cloudinary['derivatives']>> | null = null;
  try {
    if (input.decision === 'approved' && candidate)
      published = await new Cloudinary(env).derivatives(
        (candidate as Doc).publicId,
        version,
      );
    await store.transaction(async (tx, writes) => {
      const data = await store.get(`serviceRequests/${requestId}`, tx);
      const provider = await store.get(
        `providers/${id(proposal.providerId)}`,
        tx,
      );
      const rawArchive = await store.get(
        `archivedProviders/${id(proposal.providerId)}`,
        tx,
      );
      const archive = activeArchive(rawArchive);
      const lock = await store.get(`photoReviewLocks/${requestId}`, tx);
      const slot = await store.get(
        `requestSlots/${id(proposal.providerId)}`,
        tx,
      );
      const liveCandidate = candidate
        ? await store.get(
            candidatePath(id(proposal.photoChange.candidateId)),
            tx,
          )
        : null;
      const liveRestoreFallback =
        proposal.type === 'restore' &&
        provider &&
        !provider.placePhoto &&
        rawArchive?.archiveStatus === 'restored'
          ? (rawArchive.placePhoto?.version ?? null)
          : undefined;
      const liveVersion =
        liveRestoreFallback !== undefined
          ? liveRestoreFallback
          : ((provider ?? archive)?.placePhoto?.version ?? null);
      if (
        !data ||
        data.photoReviewStatus !== 'pending' ||
        lock?.token !== lockToken ||
        slot?.requestId !== requestId ||
        liveVersion !== expected ||
        JSON.stringify(data.photoChange) !==
          JSON.stringify(proposal.photoChange)
      )
        throw new HttpError(409, 'Service or photo changed during review');
      if (candidate && liveCandidate?.status !== 'uploaded')
        throw new HttpError(409, 'Candidate changed during review');
      const photo = published?.photo ?? null;
      const update: Doc = {
        photoReviewStatus: input.decision,
        photoReviewReason: reason,
        photoReviewedBy: adminUid,
        photoReviewedAt: now(),
        ...(input.decision === 'approved' ? { approvedPlacePhoto: photo } : {}),
      };
      writes.push(store.write(`serviceRequests/${requestId}`, update, true));
      if (input.decision === 'approved' && provider) {
        writes.push(
          store.write(
            `providers/${proposal.providerId}`,
            { placePhoto: photo, updatedAt: new Date() },
            true,
          ),
        );
        if (provider.placePhoto?.version)
          queue(
            store,
            writes,
            publicAssets(provider.placePhoto.version),
            'replacement',
          );
      }
      if (input.decision === 'approved' && !provider && archive)
        writes.push(
          store.write(
            `archivedProviders/${proposal.providerId}`,
            { placePhoto: photo },
            true,
          ),
        );
      if (candidate) {
        writes.push(
          store.write(
            candidatePath(proposal.photoChange.candidateId),
            {
              status: input.decision,
              ...(photo
                ? { approvedPhoto: photo, publicAssets: published!.assets }
                : {}),
              updatedAt: now(),
              reviewedAt: now(),
            },
            true,
          ),
        );
        if (input.decision === 'rejected')
          queue(
            store,
            writes,
            [sourceAsset(candidate)],
            'rejected',
            future(24 * 7),
          );
      }
      writes.push(
        store.write(`photoReviewLocks/${requestId}`, {
          token: lockToken,
          expiresAt: now(),
        }),
      );
      // Remove pre-registered jobs only once the DB publication is committed atomically.
      if (published)
        for (const asset of published.assets)
          writes.push({ delete: store.name(queuePath(asset)) });
      if (candidate)
        writes.push(
          store.write(`photoUploadSlots/${proposal.providerId}`, {
            ownerId: proposal.ownerId,
            candidateId: proposal.photoChange.candidateId,
            expiresAt: now(),
          }),
        );
    });
    return {
      photoReviewStatus: input.decision,
      approvedPlacePhoto: published?.photo ?? null,
    };
  } catch (error) {
    await store
      .transaction(async (tx, writes) => {
        const lock = await store.get(`photoReviewLocks/${requestId}`, tx);
        if (lock?.token === lockToken)
          writes.push(
            store.write(`photoReviewLocks/${requestId}`, {
              token: lockToken,
              expiresAt: now(),
            }),
          );
      })
      .catch(() => {});
    throw error;
  }
}
async function restorePhoto(env: Env, store: Store, serviceId: string) {
  const provider = await store.get(`providers/${serviceId}`);
  if (!provider) throw new HttpError(404, 'Published service not found');
  if (provider.placePhoto !== undefined)
    return { placePhoto: provider.placePhoto };
  const archive = await store.get(`archivedProviders/${serviceId}`);
  const original = archive?.placePhoto;
  if (!original) return { placePhoto: null };
  if (env.UPLOADS_ENABLED !== 'true')
    throw new HttpError(503, 'Photo processing paused');
  const control = await store.get('photoSettings/control');
  if (control?.uploadsEnabled === false)
    throw new HttpError(503, 'Photo processing paused');
  const matches = await store.list(
    'servicePhotos',
    'approvedPhoto.version',
    'EQUAL',
    original.version,
  );
  const candidate = matches.find(
    (entry: Doc) =>
      entry.serviceId === serviceId && entry.status === 'approved',
  );
  if (!candidate) throw new HttpError(404, 'Private source unavailable');
  const version = crypto.randomUUID().replaceAll('-', ''),
    assets = publicAssets(version);
  await store.transaction(async (_tx, writes) =>
    queue(store, writes, assets, 'failed-restoration', future(1)),
  );
  const published = await new Cloudinary(env).derivatives(
    candidate.publicId,
    version,
  );
  await store.transaction(async (tx, writes) => {
    const current = await store.get(`providers/${serviceId}`, tx);
    if (!current || current.ownerId !== provider.ownerId || current.placePhoto)
      throw new HttpError(409, 'Service changed during restoration');
    const slot = await store.get(`requestSlots/${serviceId}`, tx);
    const pendingRequest = slot?.requestId
      ? await store.get(`serviceRequests/${id(slot.requestId)}`, tx)
      : null;
    const pendingCandidate =
      pendingRequest?.photoReviewStatus === 'pending' &&
      pendingRequest.photoChange?.action === 'replace' &&
      pendingRequest.photoChange.candidateId
        ? await store.get(
            candidatePath(id(pendingRequest.photoChange.candidateId)),
            tx,
          )
        : null;
    writes.push(
      store.write(
        `providers/${serviceId}`,
        { placePhoto: published.photo, updatedAt: new Date() },
        true,
      ),
    );
    writes.push(
      store.write(
        candidatePath(candidate.id),
        {
          approvedPhoto: published.photo,
          publicAssets: published.assets,
          updatedAt: now(),
        },
        true,
      ),
    );
    if (
      pendingRequest?.photoReviewStatus === 'pending' &&
      pendingRequest.photoChange?.action === 'remove' &&
      pendingRequest.photoChange.expectedPhotoVersion === original.version
    ) {
      writes.push(
        store.write(
          `serviceRequests/${slot!.requestId}`,
          {
            photoChange: {
              ...pendingRequest.photoChange,
              expectedPhotoVersion: version,
            },
          },
          true,
        ),
      );
    }
    if (
      pendingCandidate &&
      pendingCandidate.expectedPhotoVersion === original.version
    ) {
      writes.push(
        store.write(
          candidatePath(pendingCandidate.candidateId || pendingCandidate.id),
          { expectedPhotoVersion: version, updatedAt: now() },
          true,
        ),
      );
    }
    for (const asset of assets)
      writes.push({ delete: store.name(queuePath(asset)) });
  });
  return { placePhoto: published.photo };
}
async function applyServicePhoto(
  request: Request,
  env: Env,
  store: Store,
  serviceId: string,
  adminUid: string,
) {
  const input = await json(request);
  if (!['replace', 'remove'].includes(input.action))
    throw new HttpError(400, 'Invalid photo action');
  const expectedVersion = input.expectedPhotoVersion ?? null;
  if (expectedVersion !== null) id(expectedVersion);
  const candidateId =
    input.action === 'replace' ? id(input.candidateId) : undefined;
  if (input.action === 'replace') {
    if (env.UPLOADS_ENABLED !== 'true')
      throw new HttpError(503, 'Photo processing paused');
    const control = await store.get('photoSettings/control');
    if (control?.uploadsEnabled === false)
      throw new HttpError(503, 'Photo processing paused');
  }
  const version = crypto.randomUUID().replaceAll('-', '');
  const assets = input.action === 'replace' ? publicAssets(version) : [];
  let candidate: Doc | null = null;
  let expected: string | null = null;
  if (input.action === 'remove') {
    await store.transaction(async (tx, writes) => {
      const provider = await store.get(`providers/${serviceId}`, tx);
      const archive = await store.get(`archivedProviders/${serviceId}`, tx);
      const activeArchive =
        archive && archive.archiveStatus !== 'restored' ? archive : null;
      const target = provider ?? activeArchive;
      if (!target) throw new HttpError(404, 'Service not found');
      expected = target.placePhoto?.version ?? null;
      if (expected !== expectedVersion)
        throw new HttpError(409, 'Photo changed on another device');
      if (provider)
        writes.push(
          store.write(
            `providers/${serviceId}`,
            { placePhoto: null, updatedAt: new Date() },
            true,
          ),
        );
      else
        writes.push(
          store.write(
            `archivedProviders/${serviceId}`,
            { placePhoto: null },
            true,
          ),
        );
      if (expected) queue(store, writes, publicAssets(expected), 'replacement');
    });
    return { placePhoto: null };
  }
  await store.transaction(async (tx, writes) => {
    const provider = await store.get(`providers/${serviceId}`, tx);
    const archive = await store.get(`archivedProviders/${serviceId}`, tx);
    const activeArchive =
      archive && archive.archiveStatus !== 'restored' ? archive : null;
    const target = provider ?? activeArchive;
    if (!target) throw new HttpError(404, 'Service not found');
    expected = target.placePhoto?.version ?? null;
    if (expected !== expectedVersion)
      throw new HttpError(409, 'Photo changed on another device');
    candidate = await store.get(candidatePath(candidateId!), tx);
    if (
      !candidate ||
      candidate.serviceId !== serviceId ||
      candidate.status !== 'uploaded'
    )
      throw new HttpError(409, 'Photo candidate unavailable');
    queue(store, writes, assets, 'failed-publication', future(1));
  });
  const published = await new Cloudinary(env).derivatives(
    (candidate as unknown as Doc).publicId,
    version,
  );
  await store.transaction(async (tx, writes) => {
    const provider = await store.get(`providers/${serviceId}`, tx);
    const archive = await store.get(`archivedProviders/${serviceId}`, tx);
    const activeArchive =
      archive && archive.archiveStatus !== 'restored' ? archive : null;
    const target = provider ?? activeArchive;
    const liveCandidate = await store.get(candidatePath(candidateId!), tx);
    if (
      !target ||
      (target.placePhoto?.version ?? null) !== expected ||
      liveCandidate?.status !== 'uploaded'
    )
      throw new HttpError(409, 'Service or photo changed during publication');
    if (provider)
      writes.push(
        store.write(
          `providers/${serviceId}`,
          { placePhoto: published.photo, updatedAt: new Date() },
          true,
        ),
      );
    else
      writes.push(
        store.write(
          `archivedProviders/${serviceId}`,
          { placePhoto: published.photo },
          true,
        ),
      );
    writes.push(
      store.write(
        candidatePath(candidateId!),
        {
          status: 'approved',
          approvedPhoto: published.photo,
          publicAssets: published.assets,
          reviewedBy: adminUid,
          updatedAt: now(),
          reviewedAt: now(),
        },
        true,
      ),
    );
    writes.push(
      store.write(`photoUploadSlots/${serviceId}`, {
        ownerId: liveCandidate.ownerId,
        candidateId: candidateId!,
        expiresAt: now(),
      }),
    );
    for (const asset of published.assets)
      writes.push({ delete: store.name(queuePath(asset)) });
    if (expected) queue(store, writes, publicAssets(expected), 'replacement');
  });
  return { placePhoto: published.photo };
}
async function usage(env: Env, store: Store) {
  const cloudName = (env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (env.CLOUDINARY_API_SECRET || '').trim();
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
      },
    },
  );
  if (!response.ok) throw new Error('Usage unavailable');
  const data = (await response.json()) as {
    credits?: { usage?: number; limit?: number; used_percent?: number };
    last_updated?: string;
  };
  const credits = data.credits;
  if (
    !credits ||
    typeof credits.usage !== 'number' ||
    typeof credits.limit !== 'number' ||
    credits.limit <= 0
  )
    throw new Error('Usage response missing credits');
  const percent = (credits.usage / credits.limit) * 100;
  const threshold =
    percent >= 90 ? 90 : percent >= 75 ? 75 : percent >= 50 ? 50 : 0;
  const previous = await store.get('photoSettings/usage');
  await store.put('photoSettings/usage', {
    usage: credits.usage,
    limit: credits.limit,
    percent,
    threshold,
    updatedAt: now(),
  });
  if (percent >= 90)
    await store.put(
      'photoSettings/control',
      {
        uploadsEnabled: false,
        reason: 'Cloudinary usage at least 90 percent',
        updatedAt: now(),
      },
      true,
    );
  if (threshold > (previous?.threshold ?? 0)) {
    console.warn('cloudinary-usage-threshold', { threshold, percent });
    if (env.USAGE_ALERT_WEBHOOK) {
      const url = new URL(env.USAGE_ALERT_WEBHOOK);
      if (url.protocol !== 'https:')
        throw new Error('Alert webhook must use HTTPS');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'cloudinary-usage-threshold',
          threshold,
          percent,
        }),
      });
    }
  }
}
async function cleanupService(store: Store, cloud: Cloudinary, job: Doc) {
  const providerId = job.providerId ? id(job.providerId) : undefined;
  // A bounded batch is repeated hourly. Never mark an account batch complete while assets remain.
  const candidates = await store.list(
    'servicePhotos',
    providerId ? 'serviceId' : 'ownerId',
    'EQUAL',
    providerId ?? id(job.ownerId),
    job.cursor,
    3,
  );
  let remaining = false;
  for (const candidate of candidates) {
    if (candidate.status === 'deleted') continue;
    if (candidate.ownerId !== job.ownerId) continue;
    const provider = await store.get(`providers/${id(candidate.serviceId)}`);
    const archived = activeArchive(
      await store.get(`archivedProviders/${id(candidate.serviceId)}`),
    );
    if (provider) {
      continue; // Restoration or a new publication wins over a stale cleanup job.
    }
    for (const asset of candidate.publicAssets || [])
      await cloud.destroy(asset);
    if (job.reason !== 'unpublish') {
      await cloud.destroy(sourceAsset(candidate));
      await store.put(
        candidatePath(candidate.candidateId || candidate.id),
        { status: 'deleted', publicAssets: [], updatedAt: now() },
        true,
      );
    } else if (archived) {
      await store.put(
        candidatePath(candidate.candidateId || candidate.id),
        { publicAssets: [], updatedAt: now() },
        true,
      );
    } else remaining = true;
  }
  const hasMore = candidates.length === 3;
  await store.put(
    `photoServiceCleanupJobs/${job.id}`,
    {
      state: remaining || hasMore ? 'pending' : 'done',
      cursor: hasMore ? (candidates.at(-1)?.id ?? null) : null,
      updatedAt: now(),
    },
    true,
  );
}
async function cleanup(env: Env) {
  const store = new Store(env),
    cloud = new Cloudinary(env);
  await usage(env, store).catch(() =>
    console.warn('cloudinary-usage-check-failed'),
  );
  if (new Date().getUTCHours() % 2 === 0) {
    for (const job of await store.list(
      'photoServiceCleanupJobs',
      'state',
      'EQUAL',
      'pending',
      undefined,
      1,
    )) {
      try {
        await cleanupService(store, cloud, job);
      } catch {
        console.warn('service-photo-cleanup-failed', job.id);
      }
    }
    return;
  }
  const processed = await cleanupAssets(store, cloud);
  if (processed < 2) {
    await reconcileOrphans(store, cloud).catch(() =>
      console.warn('orphan-reconcile-failed'),
    );
  }
}
const RECONCILE_AGE_MS = 25 * 3600000;
export async function reconcileOrphans(store: Store, cloud: Cloudinary) {
  const checkpoint = await store.get('photoSettings/reconcileCursor');
  const deliveryType: 'authenticated' | 'upload' =
    checkpoint?.deliveryType === 'upload' ? 'upload' : 'authenticated';
  const listing = await cloud.listResources(
    deliveryType,
    checkpoint?.nextCursor ?? undefined,
    3,
  );
  const cutoff = Date.now() - RECONCILE_AGE_MS;
  for (const resource of listing.resources) {
    const publicId = resource.public_id;
    if (!publicId || !publicId.startsWith('service-photos/')) continue;
    const createdMs = resource.created_at
      ? Date.parse(resource.created_at)
      : NaN;
    if (!Number.isFinite(createdMs) || createdMs > cutoff) continue;
    const asset: Asset = { publicId, deliveryType };
    const existingJob = await store.get(queuePath(asset));
    if (existingJob?.status === 'pending') continue;
    let referenced = false;
    if (deliveryType === 'authenticated') {
      const candidateId = publicId.split('/').at(-1);
      if (candidateId && /^[A-Za-z0-9_-]{1,128}$/.test(candidateId)) {
        const candidate = await store.get(candidatePath(candidateId));
        if (candidate && candidate.status !== 'deleted') {
          const service = await store.get(
            `providers/${id(candidate.serviceId)}`,
          );
          const rawArchive = await store.get(
            `archivedProviders/${id(candidate.serviceId)}`,
          );
          const archive = activeArchive(rawArchive);
          const awaitingRestorePhoto = Boolean(
            service &&
            service.placePhoto === undefined &&
            rawArchive?.archiveStatus === 'restored' &&
            rawArchive.placePhoto?.version === candidate.approvedPhoto?.version,
          );
          const slot = await store.get(
            `requestSlots/${id(candidate.serviceId)}`,
          );
          const request = slot?.requestId
            ? await store.get(`serviceRequests/${id(slot.requestId)}`)
            : null;
          const currentRequest = slot?.requestId === candidate.submissionId;
          referenced = Boolean(
            (candidate.status === 'approved' &&
              (service?.placePhoto?.version ===
                candidate.approvedPhoto?.version ||
                archive?.placePhoto?.version ===
                  candidate.approvedPhoto?.version ||
                awaitingRestorePhoto)) ||
            (currentRequest &&
              request?.photoReviewStatus === 'pending' &&
              request.photoChange?.candidateId === candidateId) ||
            (currentRequest &&
              request?.status === 'pending' &&
              request?.approvedPlacePhoto?.version ===
                candidate.approvedPhoto?.version &&
              candidate.status === 'approved'),
          );
        }
      }
    } else {
      const version = publicId.split('/').at(-2);
      if (version && /^[A-Za-z0-9_-]{1,128}$/.test(version)) {
        const candidates = await store.list(
          'servicePhotos',
          'approvedPhoto.version',
          'EQUAL',
          version,
        );
        for (const candidate of candidates) {
          const service = await store.get(
            `providers/${id(candidate.serviceId)}`,
          );
          const slot = await store.get(
            `requestSlots/${id(candidate.serviceId)}`,
          );
          const request = slot?.requestId
            ? await store.get(`serviceRequests/${id(slot.requestId)}`)
            : null;
          if (
            service?.placePhoto?.version === version ||
            (request?.status === 'pending' &&
              request?.approvedPlacePhoto?.version === version)
          ) {
            referenced = true;
            break;
          }
        }
      }
    }
    if (!referenced) {
      await store.put(queuePath(asset), {
        ...asset,
        reason: 'orphan-reconcile',
        status: 'pending',
        attempts: 0,
        notBefore: now(),
        updatedAt: now(),
      });
    }
  }
  const nextType = listing.next_cursor
    ? deliveryType
    : deliveryType === 'authenticated'
      ? 'upload'
      : 'authenticated';
  await store.put('photoSettings/reconcileCursor', {
    deliveryType: nextType,
    nextCursor: listing.next_cursor ?? null,
    updatedAt: now(),
  });
}
export async function cleanupAssets(store: Store, cloud: Cloudinary) {
  const checkpoint = await store.get('photoSettings/cleanupCursor');
  const jobs = await store.list(
    'photoCleanupJobs',
    'status',
    'EQUAL',
    'pending',
    checkpoint?.cursor,
    2,
  );
  for (const job of jobs) {
    if (job.notBefore > now()) continue;
    try {
      // A queued public object may still be the approved image if an earlier deletion raced publication.
      if (job.deliveryType === 'authenticated') {
        const candidateId = String(job.publicId).split('/').at(-1)!;
        const candidate = await store.get(candidatePath(id(candidateId)));
        if (candidate) {
          const service = await store.get(
            `providers/${id(candidate.serviceId)}`,
          );
          const rawArchive = await store.get(
            `archivedProviders/${id(candidate.serviceId)}`,
          );
          const archive = activeArchive(rawArchive);
          const awaitingRestorePhoto = Boolean(
            service &&
            service.placePhoto === undefined &&
            rawArchive?.archiveStatus === 'restored' &&
            rawArchive.placePhoto?.version === candidate.approvedPhoto?.version,
          );
          const request = await store.get(
            `serviceRequests/${id(candidate.submissionId)}`,
          );
          const slot = await store.get(
            `requestSlots/${id(candidate.serviceId)}`,
          );
          const currentRequest = slot?.requestId === candidate.submissionId;
          if (
            !currentRequest &&
            request?.photoReviewStatus === 'pending' &&
            request.photoChange?.candidateId === candidateId
          ) {
            await store.transaction(async (tx, writes) => {
              const live = await store.get(
                `serviceRequests/${id(candidate.submissionId)}`,
                tx,
              );
              const liveSlot = await store.get(
                `requestSlots/${id(candidate.serviceId)}`,
                tx,
              );
              if (
                live?.photoReviewStatus === 'pending' &&
                liveSlot?.requestId !== candidate.submissionId
              ) {
                writes.push(
                  store.write(
                    `serviceRequests/${candidate.submissionId}`,
                    {
                      photoReviewStatus: 'rejected',
                      photoReviewReason:
                        'تم إرسال طلب أحدث. أضف الصورة للطلب الجديد.',
                      photoReviewedAt: now(),
                    },
                    true,
                  ),
                );
                writes.push(
                  store.write(
                    candidatePath(candidateId),
                    { status: 'rejected', updatedAt: now() },
                    true,
                  ),
                );
              }
            });
            await store.put(
              `photoCleanupJobs/${job.id}`,
              { notBefore: future(24 * 7), updatedAt: now() },
              true,
            );
            continue;
          }
          const retained =
            (candidate.status === 'reserved' && candidate.expiresAt > now()) ||
            (candidate.status === 'approved' &&
              (service?.placePhoto?.version ===
                candidate.approvedPhoto?.version ||
                archive?.placePhoto?.version ===
                  candidate.approvedPhoto?.version ||
                awaitingRestorePhoto)) ||
            (currentRequest &&
              request?.photoReviewStatus === 'pending' &&
              request.photoChange?.candidateId === candidateId) ||
            (currentRequest &&
              request?.status === 'pending' &&
              request?.approvedPlacePhoto?.version ===
                candidate.approvedPhoto?.version &&
              candidate.status === 'approved');
          if (retained) {
            await store.put(
              `photoCleanupJobs/${job.id}`,
              { notBefore: future(24), updatedAt: now() },
              true,
            );
            continue;
          }
          for (const asset of candidate.publicAssets || [])
            await cloud.destroy(asset);
          await cloud.destroy({
            publicId: job.publicId,
            deliveryType: job.deliveryType,
          });
          if (candidate.status !== 'deleted')
            await store.put(
              candidatePath(candidateId),
              { status: 'deleted', publicAssets: [], updatedAt: now() },
              true,
            );
          await store.put(
            `photoCleanupJobs/${job.id}`,
            { status: 'done', updatedAt: now() },
            true,
          );
          continue;
        }
      }
      if (job.deliveryType === 'upload') {
        const version = String(job.publicId).split('/').at(-2)!;
        const candidates = await store.list(
          'servicePhotos',
          'approvedPhoto.version',
          'EQUAL',
          version,
        );
        let retained = false;
        for (const candidate of candidates) {
          const provider = await store.get(
            `providers/${id(candidate.serviceId)}`,
          );
          const slot = await store.get(
            `requestSlots/${id(candidate.serviceId)}`,
          );
          const request = slot?.requestId
            ? await store.get(`serviceRequests/${id(slot.requestId)}`)
            : null;
          if (
            provider?.placePhoto?.version === version ||
            (request?.status === 'pending' &&
              request?.approvedPlacePhoto?.version === version)
          )
            retained = true;
        }
        if (retained) {
          await store.put(
            `photoCleanupJobs/${job.id}`,
            { notBefore: future(24), updatedAt: now() },
            true,
          );
          continue;
        }
      }
      await cloud.destroy({
        publicId: job.publicId,
        deliveryType: job.deliveryType,
      });
      await store.put(
        `photoCleanupJobs/${job.id}`,
        { status: 'done', updatedAt: now() },
        true,
      );
    } catch {
      await store
        .put(
          `photoCleanupJobs/${job.id}`,
          {
            attempts: (job.attempts || 0) + 1,
            notBefore: future(1),
            updatedAt: now(),
          },
          true,
        )
        .catch(() => {});
    }
  }
  await store.put('photoSettings/cleanupCursor', {
    cursor: jobs.length === 2 ? jobs.at(-1).id : null,
    updatedAt: now(),
  });
  return jobs.length;
}
function claimDocId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,260}$/.test(value))
    throw new HttpError(400, 'Invalid identifier');
  return value;
}
async function deleteAccount(
  env: Env,
  store: Store,
  user: { uid: string; admin: boolean; authTime: number },
) {
  const uid = id(user.uid);
  if (user.admin)
    throw new HttpError(403, 'Admin accounts cannot be deleted directly');
  if (Math.floor(Date.now() / 1000) - user.authTime > RECENT_AUTH_MAX_AGE_SECONDS)
    throw new HttpError(401, 'Recent login required');

  const PAGE_SIZE = 50;
  const REQUEST_PAGE_SIZE = 40;
  const [
    userDoc,
    providers,
    archivedProviders,
    photoUploadSlots,
    requestSlots,
    serviceRequests,
    reports,
    userClaims,
    supportRequests,
    servicePhotos,
    photoServiceCleanupJobs,
  ] = await Promise.all([
    store.get(`users/${uid}`),
    store.list('providers', 'ownerId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list(
      'archivedProviders',
      'ownerId',
      'EQUAL',
      uid,
      undefined,
      PAGE_SIZE,
    ),
    store.list(
      'photoUploadSlots',
      'ownerId',
      'EQUAL',
      uid,
      undefined,
      PAGE_SIZE,
    ),
    store.list('requestSlots', 'ownerId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list(
      'serviceRequests',
      'ownerId',
      'EQUAL',
      uid,
      undefined,
      REQUEST_PAGE_SIZE,
    ),
    store.list('reports', 'reporterId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list('serviceClaims', 'claimantId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list('supportRequests', 'ownerId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list('servicePhotos', 'ownerId', 'EQUAL', uid, undefined, PAGE_SIZE),
    store.list(
      'photoServiceCleanupJobs',
      'ownerId',
      'EQUAL',
      uid,
      undefined,
      PAGE_SIZE,
    ),
  ]);

  if (userDoc?.role === 'admin')
    throw new HttpError(403, 'Admin accounts cannot be deleted directly');

  const providersToDelete = providers.slice(0, 10);
  const providerClaimsBatches = await Promise.all(
    providersToDelete.map((provider: Doc) =>
      store.list(
        'serviceClaims',
        'providerId',
        'EQUAL',
        id(provider.id),
        undefined,
        PAGE_SIZE,
      ),
    ),
  );
  const providerClaims = providerClaimsBatches.flat();

  const hasMore =
    providers.length > 10 ||
    providers.length === PAGE_SIZE ||
    archivedProviders.length === PAGE_SIZE ||
    photoUploadSlots.length === PAGE_SIZE ||
    requestSlots.length === PAGE_SIZE ||
    serviceRequests.length === REQUEST_PAGE_SIZE ||
    reports.length === PAGE_SIZE ||
    userClaims.length === PAGE_SIZE ||
    supportRequests.length === PAGE_SIZE ||
    servicePhotos.length === PAGE_SIZE ||
    photoServiceCleanupJobs.length === PAGE_SIZE ||
    providerClaimsBatches.some((batch) => batch.length === PAGE_SIZE);

  const assetMap = new Map<string, Asset>();
  for (const photo of servicePhotos) {
    if (photo.status === 'deleted') continue;
    const candidates: Asset[] = [
      ...(typeof photo.publicId === 'string' && photo.publicId
        ? [sourceAsset(photo)]
        : []),
      ...(Array.isArray(photo.publicAssets) ? photo.publicAssets : []),
      ...(typeof photo.approvedPhoto?.version === 'string' &&
      photo.approvedPhoto.version
        ? publicAssets(photo.approvedPhoto.version)
        : []),
    ];
    for (const asset of candidates) {
      if (asset?.publicId && asset?.deliveryType) {
        assetMap.set(queuePath(asset), asset);
      }
    }
  }
  const assetsToDestroy = [...assetMap.values()];

  const commit1Writes: any[] = [];
  if (assetsToDestroy.length > 0) {
    queue(store, commit1Writes, assetsToDestroy, 'account-delete');
  }
  for (const provider of providersToDelete) {
    commit1Writes.push(store.deleteWrite(`providers/${id(provider.id)}`));
  }
  for (const archive of archivedProviders) {
    commit1Writes.push(store.deleteWrite(`archivedProviders/${id(archive.id)}`));
  }
  await store.commit(commit1Writes);

  const deletePaths = new Set<string>();
  for (const slot of photoUploadSlots) {
    deletePaths.add(`photoUploadSlots/${id(slot.id)}`);
  }
  for (const slot of requestSlots) {
    deletePaths.add(`requestSlots/${id(slot.id)}`);
  }
  for (const req of serviceRequests) {
    const reqId = id(req.id);
    for (const chunk of ['0', '1', '2', '3']) {
      deletePaths.add(`serviceRequests/${reqId}/scheduleValidation/${chunk}`);
    }
    deletePaths.add(`serviceRequests/${reqId}`);
  }
  for (const report of reports) {
    deletePaths.add(`reports/${id(report.id)}`);
  }
  for (const claim of [...userClaims, ...providerClaims]) {
    deletePaths.add(`serviceClaims/${claimDocId(claim.id)}`);
  }
  for (const ticket of supportRequests) {
    deletePaths.add(`supportRequests/${id(ticket.id)}`);
  }
  for (const photo of servicePhotos) {
    deletePaths.add(`servicePhotos/${id(photo.id)}`);
  }
  for (const job of photoServiceCleanupJobs) {
    deletePaths.add(`photoServiceCleanupJobs/${id(job.id)}`);
  }
  if (!hasMore) {
    deletePaths.add(`users/${uid}`);
    deletePaths.add(`serviceQuotas/${uid}`);
    deletePaths.add(`photoUploadQuotas/${uid}`);
  }
  await store.commit([...deletePaths].map((path) => store.deleteWrite(path)));

  if (
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET &&
    assetsToDestroy.length > 0
  ) {
    const cloud = new Cloudinary(env);
    const doneWrites: any[] = [];
    for (const asset of assetsToDestroy.slice(0, MAX_IMMEDIATE_CLOUD_DESTROYS)) {
      try {
        await cloud.destroy(asset);
        doneWrites.push(
          store.write(
            queuePath(asset),
            { status: 'done', updatedAt: now() },
            true,
          ),
        );
      } catch {
        /* Leave pending in photoCleanupJobs for hourly cron. */
      }
    }
    if (doneWrites.length > 0) {
      await store.commit(doneWrites).catch(() => {});
    }
  }

  return {
    deleted: !hasMore,
    hasMore,
    deletedProviderIds: providersToDelete.map((provider: Doc) => String(provider.id)),
  };
}
function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (
    origin &&
    !(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((x) => x.trim())
      .includes(origin)
  )
    throw new HttpError(403, 'Origin not allowed');
  return origin
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}
export async function handle(request: Request, env: Env): Promise<Response> {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  try {
    headers = { ...headers, ...cors(request, env) };
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
      });
    const path = new URL(request.url).pathname;
    if (path === '/health')
      return Response.json(
        { ok: true, uploadsEnabled: env.UPLOADS_ENABLED === 'true' },
        { headers },
      );
    const user = await authenticate(request, env),
      store = new Store(env);
    let result: unknown;
    if (path === '/v1/account' && request.method === 'DELETE')
      result = await deleteAccount(env, store, user);
    else if (path === '/v1/photos/reservations' && request.method === 'POST')
      result = await reserve(request, env, store, user.uid, user.admin);
    else {
      const match = path.match(
        /^\/v1\/photos\/candidates\/([A-Za-z0-9_-]+)(\/preview)?$/,
      );
      const review = path.match(/^\/v1\/photos\/reviews\/([A-Za-z0-9_-]+)$/);
      const restore = path.match(
        /^\/v1\/photos\/services\/([A-Za-z0-9_-]+)\/restore$/,
      );
      const applyPhoto = path.match(
        /^\/v1\/photos\/services\/([A-Za-z0-9_-]+)\/photo$/,
      );
      if (match && match[2] && request.method === 'GET') {
        const candidate = await store.get(candidatePath(match[1]));
        owner(candidate, user.uid, user.admin);
        if (!['uploaded', 'approved', 'rejected'].includes(candidate.status))
          throw new HttpError(404, 'Preview unavailable');
        const bytes = await new Cloudinary(env).privateBytes(
          candidate.publicId,
        );
        return new Response(bytes as BodyInit, {
          headers: {
            ...headers,
            'Content-Type': 'image/jpeg',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      if (match && !match[2] && request.method === 'PUT')
        result = await upload(
          request,
          env,
          store,
          user.uid,
          match[1],
          user.admin,
        );
      else if (match && !match[2] && request.method === 'DELETE')
        result = await remove(store, user.uid, match[1], user.admin);
      else if (restore && request.method === 'POST') {
        if (!user.admin) throw new HttpError(403, 'Administrator required');
        result = await restorePhoto(env, store, id(restore[1]));
      } else if (applyPhoto && request.method === 'POST') {
        if (!user.admin) throw new HttpError(403, 'Administrator required');
        result = await applyServicePhoto(
          request,
          env,
          store,
          id(applyPhoto[1]),
          user.uid,
        );
      } else if (review && request.method === 'POST') {
        if (!user.admin) throw new HttpError(403, 'Administrator required');
        result = await reviewPhoto(
          request,
          env,
          store,
          id(review[1]),
          user.uid,
        );
      } else throw new HttpError(404, 'Endpoint not found');
    }
    return Response.json(result, { headers });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500)
      console.error(
        'photo-worker-unexpected-error',
        error instanceof Error ? error.message : 'Unknown error',
      );
    return Response.json(
      {
        error:
          status === 500
            ? 'Service unavailable'
            : (error as Error).message,
      },
      { status, headers },
    );
  }
}
export default {
  fetch: handle,
  scheduled: (
    _event: unknown,
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) => ctx.waitUntil(cleanup(env)),
};

export {
  deleteAccount,
  reserve,
  upload,
  remove,
  reviewPhoto,
  restorePhoto,
  applyServicePhoto,
  cleanupService,
};
