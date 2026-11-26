// Administrative seed: only adds missing categories, never mock providers/accounts.
import { createRequire } from 'node:module';
import { categories } from '../src/features/discovery/data/categories.ts';
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const project = 'manshyat-amar';
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Run npx -y firebase-tools@latest login first.');
await requireAuth({ project, user: account.user, tokens: account.tokens });
const client = new Client({
  urlPrefix: 'https://firestore.googleapis.com',
  apiVersion: 'v1',
});
for (const [order, category] of categories.entries()) {
  const path = `projects/${project}/databases/(default)/documents/categories/${category.id}`;
  try {
    await client.request({ method: 'GET', path });
    console.log(`Kept ${category.id}`);
    continue;
  } catch (error) {
    if (error.status !== 404 && error.context?.response?.statusCode !== 404)
      throw error;
  }
  const fields = Object.fromEntries(
    Object.entries({
      name: category.name,
      description: category.description,
      icon: category.icon,
    }).map(([key, value]) => [key, { stringValue: value }]),
  );
  await client.request({
    method: 'POST',
    path: `projects/${project}/databases/(default)/documents/categories`,
    queryParams: { documentId: category.id },
    body: {
      fields: {
        ...fields,
        active: { booleanValue: true },
        order: { integerValue: String(category.id === 'other' ? 999 : order) },
      },
    },
  });
  console.log(`Created ${category.id}`);
}
