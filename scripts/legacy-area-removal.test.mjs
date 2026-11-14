import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyAreaRemovalPlan,
  fingerprint,
  deletionMask,
} from './legacy-area-removal.mjs';
it('deletes only legacy fields at root and in proposals, preserving address and coverage', () => {
  const retained = {
    phone: { stringValue: '01012345678' },
    address: { stringValue: 'public address' },
    coverageAreas: { arrayValue: { values: [{ stringValue: 'all' }] } },
  };
  const original = {
    ...retained,
    areaId: { stringValue: 'center' },
    proposedData: {
      mapValue: { fields: { ...retained, areadId: { stringValue: 'old' } } },
    },
  };
  const plan = legacyAreaRemovalPlan(original);
  assert.deepEqual(
    plan.removed.map((field) => field.path),
    ['`areaId`', '`proposedData`.`areadId`'],
  );
  assert.equal(
    plan.fingerprint,
    fingerprint({
      ...retained,
      proposedData: { mapValue: { fields: retained } },
    }),
  );
  assert.ok(original.areaId);
});
it('uses separate update masks and a concurrency precondition rather than replacing a document', () => {
  const params = deletionMask(
    [{ path: '`areaId`' }, { path: '`proposedData`.`areaId`' }],
    'revision',
  );
  assert.deepEqual(params.getAll('updateMask.fieldPaths'), [
    '`areaId`',
    '`proposedData`.`areaId`',
  ]);
  assert.equal(params.get('currentDocument.updateTime'), 'revision');
});
it('fails closed on legacy fields inside arrays', () => {
  assert.throws(
    () =>
      legacyAreaRemovalPlan({
        items: {
          arrayValue: {
            values: [
              { mapValue: { fields: { areaId: { stringValue: 'x' } } } },
            ],
          },
        },
      }),
    /dedicated migration/,
  );
});
