// Default is a read-only inventory. --apply deletes only the named legacy fields.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import {
  legacyAreaRemovalPlan,
  fingerprint,
  deletionMask,
} from './legacy-area-removal.mjs';
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const args = process.argv.slice(2);
const option = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const project = option('--project');
if (!project || project.startsWith('--'))
  throw new Error('Specify --project <project ID>.');
const apply = args.includes('--apply');
const backup = option('--backup');
if (apply && (!backup || backup.startsWith('--')))
  throw new Error('--apply requires --backup <private JSON path>.');
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Firebase CLI login is required.');
await requireAuth({ project, user: account.user, tokens: account.tokens });
const client = new Client({
  urlPrefix: 'https://firestore.googleapis.com',
  apiVersion: 'v1',
});
const root = `projects/${project}/databases/(default)/documents`;
async function collectionIds(parent) {
  const ids = [];
  let token;
  do {
    const result = await client.request({
      method: 'POST',
      path: `${parent}:listCollectionIds`,
      body: { pageSize: 1000, ...(token ? { pageToken: token } : {}) },
    });
    ids.push(...(result.body.collectionIds ?? []));
    token = result.body.nextPageToken;
  } while (token);
  return ids;
}
async function inventory(parent) {
  const found = [];
  let scanned = 0;
  for (const collection of await collectionIds(parent)) {
    let token;
    do {
      const result = await client.request({
        method: 'GET',
        path: `${parent}/${encodeURIComponent(collection)}`,
        queryParams: {
          pageSize: 300,
          showMissing: true,
          ...(token ? { pageToken: token } : {}),
        },
      });
      for (const document of result.body.documents ?? []) {
        scanned++;
        const plan = legacyAreaRemovalPlan(document.fields);
        if (plan.removed.length)
          found.push({
            name: document.name,
            updateTime: document.updateTime,
            fields: plan.removed,
            fingerprint: plan.fingerprint,
          });
        const children = await inventory(document.name);
        scanned += children.scanned;
        found.push(...children.found);
      }
      token = result.body.nextPageToken;
    } while (token);
  }
  return { scanned, found };
}
const before = await inventory(root);
console.log(
  JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    project,
    scanned: before.scanned,
    documents: before.found.length,
    fields: before.found.reduce((n, d) => n + d.fields.length, 0),
  }),
);
if (apply) {
  // Recovery data contains only document paths and removed field values, never credentials.
  await writeFile(
    backup,
    JSON.stringify(
      { project, createdAt: new Date().toISOString(), documents: before.found },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  for (const document of before.found) {
    const result = await client.request({
      method: 'PATCH',
      path: document.name,
      queryParams: deletionMask(document.fields, document.updateTime),
      body: { fields: {} },
    });
    if (fingerprint(result.body.fields ?? {}) !== document.fingerprint)
      throw new Error(
        'Unexpected non-area field change. Stop and inspect the backup.',
      );
  }
  const after = await inventory(root);
  if (after.found.length)
    throw new Error(
      'Legacy fields remain or concurrent writes reintroduced them; run another dry-run.',
    );
  console.log(
    JSON.stringify({
      verifiedRemaining: 0,
      documentsUpdated: before.found.length,
    }),
  );
}
