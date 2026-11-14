// Read-only unless both explicit write flags are supplied. Uses existing CLI login.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const args = process.argv.slice(2);
const project = args[args.indexOf('--project') + 1];
if (!args.includes('--project') || !project || project.startsWith('--'))
  throw new Error('Specify --project <firebase-project-id>.');
const apply = args.includes('--apply');
if (apply && !args.includes('--confirm-maintenance'))
  throw new Error(
    'Pause submissions and moderation, then pass --confirm-maintenance.',
  );
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Run npx firebase-tools login first.');
await requireAuth({ project, user: account.user, tokens: account.tokens });
const client = new Client({
  urlPrefix: 'https://firestore.googleapis.com',
  apiVersion: 'v1',
});
const root = `projects/${project}/databases/(default)/documents`;
async function list(collection) {
  const documents = [];
  let pageToken;
  do {
    const result = await client.request({
      method: 'GET',
      path: `${root}/${collection}`,
      queryParams: { pageSize: 300, ...(pageToken ? { pageToken } : {}) },
    });
    documents.push(...(result.body.documents ?? []));
    pageToken = result.body.nextPageToken;
  } while (pageToken);
  return documents;
}
const [users, providers, requests, quotas] = await Promise.all(
  ['users', 'providers', 'serviceRequests', 'serviceQuotas'].map(list),
);
const id = (document) => document.name.split('/').at(-1);
const active = new Map(users.map((user) => [id(user), new Set()]));
for (const document of [
  ...providers,
  ...requests.filter(
    (request) =>
      request.fields?.type?.stringValue === 'create' &&
      request.fields?.status?.stringValue === 'pending',
  ),
]) {
  const ownerId = document.fields?.ownerId?.stringValue;
  const serviceId = document.name.includes('/providers/')
    ? id(document)
    : document.fields?.providerId?.stringValue;
  if (!ownerId || !serviceId)
    throw new Error('Invalid service ownership; audit migration input.');
  if (!active.has(ownerId)) active.set(ownerId, new Set());
  active.get(ownerId).add(serviceId);
}
const previous = new Map(quotas.map((document) => [id(document), document]));
let overLimit = 0;
for (const [uid, ids] of active) {
  const old = previous.get(uid);
  const limit = Number(old?.fields?.limit?.integerValue ?? 3);
  if (ids.size > limit) overLimit++;
  if (apply)
    await client.request({
      method: 'PATCH',
      path: `${root}/serviceQuotas/${encodeURIComponent(uid)}`,
      queryParams: old
        ? { 'currentDocument.updateTime': old.updateTime }
        : { 'currentDocument.exists': false },
      body: {
        fields: {
          serviceIds: {
            arrayValue: {
              values: [...ids].sort().map((value) => ({ stringValue: value })),
            },
          },
          ...(old?.fields?.limit ? { limit: old.fields.limit } : {}),
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      },
    });
}
console.log(
  JSON.stringify({
    mode: apply ? 'applied' : 'dry-run',
    accounts: active.size,
    overLimit,
  }),
);
