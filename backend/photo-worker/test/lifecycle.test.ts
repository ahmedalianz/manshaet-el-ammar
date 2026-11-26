import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  applyServicePhoto,
  cleanupAssets,
  cleanupService,
  deleteAccount,
  reconcileOrphans,
  reserve,
  restorePhoto,
  reviewPhoto,
} from '../src/index.ts';
import { Cloudinary } from '../src/cloudinary.ts';
import { decode, type Doc, type Env, HttpError, type Store } from '../src/platform.ts';
const env:Env={FIREBASE_PROJECT_ID:'demo-ammar',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'',CLOUDINARY_API_SECRET:'',UPLOADS_ENABLED:'true'};
const req=(body:unknown)=>new Request('https://worker.test',{method:'POST',body:JSON.stringify(body)});
const conflict=(error:unknown)=>error instanceof HttpError&&error.status===409;
class MemoryStore {
  docs:Record<string,Doc>;
  constructor(docs:Record<string,Doc>={}){this.docs=structuredClone(docs);}
  name(path:string){return path;}
  async get(path:string){return structuredClone(this.docs[path]??null);}
  write(path:string,data:Doc,merge=false){return {path,data,merge};}
  deleteWrite(path:string){return {delete:path};}
  async commit(writes:any[]){for(const w of writes){if(w.delete)delete this.docs[w.delete];else await this.put(w.path,w.data,w.merge);}}
  async put(path:string,data:Doc,merge=false){this.docs[path]=merge?{...this.docs[path],...data}:data;}
  async transaction<T>(fn:(tx:string,writes:any[])=>Promise<T>){const writes:any[]=[];const result=await fn('test',writes);await this.commit(writes);return result;}
  async list(collection:string,field?:string,_op?:string,value?:unknown,cursor?:string,limit=50){return Object.entries(this.docs).filter(([path,d])=>path.startsWith(collection+'/')&&!path.slice(collection.length+1).includes('/')&&(!field||field.split('.').reduce((v:any,k)=>v?.[k],d)===value)&&(!cursor||path.split('/').at(-1)!>cursor)).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([path,d])=>({id:path.split('/').at(-1),...structuredClone(d)}));}
  asStore(){return this as unknown as Store;}
}
test('reservation rejects another service owner and does not write quota',async()=>{
 const db=new MemoryStore({'providers/shop':{ownerId:'other'}});
 await assert.rejects(reserve(req({serviceId:'shop',submissionId:'submission'}),env,db.asStore(),'owner'),e=>e instanceof HttpError&&e.status===403);
 assert.equal(db.docs['photoUploadQuotas/owner'],undefined);
});
test('reservation enforces daily limit and a single active slot',async()=>{
 const db=new MemoryStore({'providers/shop':{ownerId:'owner'},'photoUploadQuotas/owner':{day:new Date().toISOString().slice(0,10),attempts:10}});
 await assert.rejects(reserve(req({serviceId:'shop',submissionId:'submission'}),env,db.asStore(),'owner'),e=>e instanceof HttpError&&e.status===429);
 delete db.docs['photoUploadQuotas/owner'];
 await reserve(req({serviceId:'shop',submissionId:'submission'}),env,db.asStore(),'owner');
 await assert.rejects(reserve(req({serviceId:'shop',submissionId:'submission'}),env,db.asStore(),'owner'),conflict);
});
const oldPhoto={version:'old',thumbnailUrl:'https://old-thumb',detailUrl:'https://old-detail',width:640,height:480};
function reviewDb(action='replace'){
 return new MemoryStore({
 'providers/shop':{ownerId:'owner',placePhoto:oldPhoto},
 'requestSlots/shop':{ownerId:'owner',requestId:'submission'},
 'serviceRequests/submission':{ownerId:'owner',providerId:'shop',status:'pending',photoReviewStatus:'pending',photoChange:action==='replace'?{action,candidateId:'candidate'}:{action,expectedPhotoVersion:'old'}},
 'servicePhotos/candidate':{ownerId:'owner',serviceId:'shop',submissionId:'submission',candidateId:'candidate',status:'uploaded',expectedPhotoVersion:'old',publicId:'private/source'},
 });
}
test('rejected replacement preserves public photo and has separate photo decision',async()=>{
 const db=reviewDb();await reviewPhoto(req({decision:'rejected',reason:'Wrong location'}),env,db.asStore(),'submission','admin');
 assert.deepEqual(db.docs['providers/shop'].placePhoto,oldPhoto);
 assert.equal(db.docs['serviceRequests/submission'].status,'pending');assert.equal(db.docs['serviceRequests/submission'].photoReviewStatus,'rejected');
});
test('approved replacement updates only approved photo and maintains text decision',async()=>{
 const db=reviewDb();const photo={...oldPhoto,version:'new'};
 const stub=mock.method(Cloudinary.prototype,'derivatives',async()=>({photo,assets:[]}));
 try{await reviewPhoto(req({decision:'approved'}),env,db.asStore(),'submission','admin');assert.equal(db.docs['providers/shop'].placePhoto.version,'new');assert.equal(db.docs['serviceRequests/submission'].status,'pending');assert.equal(db.docs['serviceRequests/submission'].photoReviewStatus,'approved');}
 finally{stub.mock.restore();}
});
test('stale remove cannot delete a newly approved photo',async()=>{
 const db=reviewDb('remove');db.docs['providers/shop'].placePhoto={...oldPhoto,version:'newer'};
 await assert.rejects(reviewPhoto(req({decision:'approved'}),env,db.asStore(),'submission','admin'),conflict);
 assert.equal(db.docs['providers/shop'].placePhoto.version,'newer');
});
test('cleanup cursor advances past deferred objects rather than starving later jobs',async()=>{
 const db=new MemoryStore({'photoCleanupJobs/a':{status:'pending',notBefore:'2999-01-01'},'photoCleanupJobs/b':{status:'pending',notBefore:'2999-01-01'},'photoCleanupJobs/c':{status:'pending',notBefore:'2000-01-01',publicId:'public/unreferenced/detail',deliveryType:'upload'}});
 const destroyed:string[]=[];const stub=mock.method(Cloudinary.prototype,'destroy',async(asset:any)=>{destroyed.push(asset.publicId);return {};});
 try{await cleanupAssets(db.asStore(),new Cloudinary(env));assert.equal(db.docs['photoSettings/cleanupCursor'].cursor,'b');await cleanupAssets(db.asStore(),new Cloudinary(env));assert.deepEqual(destroyed,['public/unreferenced/detail']);assert.equal(db.docs['photoCleanupJobs/c'].status,'done');}
 finally{stub.mock.restore();}
});
test('cleanup rejects superseded pending photo instead of retaining forever',async()=>{
 const db=reviewDb();db.docs['requestSlots/shop'].requestId='newer';db.docs['photoCleanupJobs/source']={status:'pending',notBefore:'2000-01-01',publicId:'service-photos/private/owner/shop/candidate',deliveryType:'authenticated'};
 await cleanupAssets(db.asStore(),new Cloudinary(env));
 assert.equal(db.docs['serviceRequests/submission'].photoReviewStatus,'rejected');assert.equal(db.docs['servicePhotos/candidate'].status,'rejected');assert.ok(db.docs['photoCleanupJobs/source'].notBefore>new Date().toISOString());
});
test('photo-first approval source remains until pending text is decided',async()=>{
 const db=reviewDb();delete db.docs['providers/shop'];db.docs['servicePhotos/candidate']={...db.docs['servicePhotos/candidate'],status:'approved',approvedPhoto:oldPhoto};db.docs['serviceRequests/submission']={...db.docs['serviceRequests/submission'],photoReviewStatus:'approved',approvedPlacePhoto:oldPhoto};db.docs['photoCleanupJobs/source']={status:'pending',notBefore:'2000-01-01',publicId:'service-photos/private/owner/shop/candidate',deliveryType:'authenticated'};
 const stub=mock.method(Cloudinary.prototype,'destroy',async()=>{throw new Error('Must not delete retained original');});
 try{await cleanupAssets(db.asStore(),new Cloudinary(env));assert.equal(stub.mock.callCount(),0);assert.ok(db.docs['photoCleanupJobs/source'].notBefore>new Date().toISOString());}finally{stub.mock.restore();}
});
test('admin bypasses daily upload quotas and can reserve on foreign services',async()=>{
 const today=new Date().toISOString().slice(0,10);
 const db=new MemoryStore({
  'photoUploadQuotas/admin':{day:today,attempts:10},
  'providers/shop':{ownerId:'owner',placePhoto:oldPhoto},
 });
 const created=await reserve(req({serviceId:'provider-sub4',submissionId:'sub4'}),env,db.asStore(),'admin',true);
 assert.equal(db.docs[`servicePhotos/${created.candidateId}`].ownerId,'admin');
 assert.equal(db.docs['photoUploadQuotas/admin'].attempts,10);
 const foreign=await reserve(req({serviceId:'shop',submissionId:'sub-edit',expectedPhotoVersion:'old'}),env,db.asStore(),'admin',true);
 assert.equal(db.docs[`servicePhotos/${foreign.candidateId}`].ownerId,'owner');
});
test('admin direct photo replace and remove update provider and queue old public assets',async()=>{
 const db=new MemoryStore({
  'providers/shop':{ownerId:'owner',placePhoto:oldPhoto},
  'servicePhotos/candidate':{ownerId:'owner',serviceId:'shop',submissionId:'sub',candidateId:'candidate',status:'uploaded',expectedPhotoVersion:'old',publicId:'private/source'},
 });
 const nextPhoto={...oldPhoto,version:'new'};
 const stub=mock.method(Cloudinary.prototype,'derivatives',async()=>({photo:nextPhoto,assets:[]}));
 try{
  const replaced=await applyServicePhoto(req({action:'replace',candidateId:'candidate',expectedPhotoVersion:'old'}),env,db.asStore(),'shop','admin');
  assert.equal(replaced.placePhoto?.version,'new');
  assert.equal(db.docs['providers/shop'].placePhoto.version,'new');
  assert.equal(db.docs['servicePhotos/candidate'].status,'approved');
  assert.equal(db.docs['photoCleanupJobs/service-photos_public_old_detail_upload'].reason,'replacement');
  const removed=await applyServicePhoto(req({action:'remove',expectedPhotoVersion:'new'}),env,db.asStore(),'shop','admin');
  assert.equal(removed.placePhoto,null);
  assert.equal(db.docs['providers/shop'].placePhoto,null);
  assert.equal(db.docs['photoCleanupJobs/service-photos_public_new_detail_upload'].reason,'replacement');
 }finally{stub.mock.restore();}
});

test('restore request supports photo-first and text-first orders (before and after restorePhoto)', async () => {
  const newPhoto = { ...oldPhoto, version: 'restored-new' };
  const stub = mock.method(Cloudinary.prototype, 'derivatives', async (_id: string, version: string) => ({
    photo: { ...newPhoto, version },
    assets: [
      { publicId: `service-photos/public/${version}/thumbnail`, deliveryType: 'upload' as const },
      { publicId: `service-photos/public/${version}/detail`, deliveryType: 'upload' as const },
    ],
  }));
  try {
    // 1. Photo-first on unpublished archive
    const dbPhotoFirst = new MemoryStore({
      'archivedProviders/shop': { ownerId: 'owner', archiveStatus: 'unpublished', placePhoto: oldPhoto },
      'requestSlots/shop': { ownerId: 'owner', requestId: 'sub1' },
      'serviceRequests/sub1': { ownerId: 'owner', providerId: 'shop', type: 'restore', status: 'pending', photoReviewStatus: 'pending', photoChange: { action: 'replace', candidateId: 'cand1' } },
      'servicePhotos/cand1': { ownerId: 'owner', serviceId: 'shop', submissionId: 'sub1', candidateId: 'cand1', status: 'uploaded', expectedPhotoVersion: 'old', publicId: 'private/cand1' },
    });
    const res1 = await reviewPhoto(req({ decision: 'approved' }), env, dbPhotoFirst.asStore(), 'sub1', 'admin');
    assert.equal(res1.photoReviewStatus, 'approved');
    assert.equal(dbPhotoFirst.docs['providers/shop'], undefined);
    assert.equal(dbPhotoFirst.docs['archivedProviders/shop'].placePhoto.version, res1.approvedPlacePhoto?.version);

    // 2. Text-first with restorePhoto running before photo review
    const dbTextThenRestore = new MemoryStore({
      'providers/shop': { ownerId: 'owner' },
      'archivedProviders/shop': { ownerId: 'owner', archiveStatus: 'restored', placePhoto: oldPhoto },
      'requestSlots/shop': { ownerId: 'owner', requestId: 'sub2' },
      'serviceRequests/sub2': { ownerId: 'owner', providerId: 'shop', type: 'restore', status: 'approved', photoReviewStatus: 'pending', photoChange: { action: 'replace', candidateId: 'cand2' } },
      'servicePhotos/cand2': { ownerId: 'owner', serviceId: 'shop', submissionId: 'sub2', candidateId: 'cand2', status: 'uploaded', expectedPhotoVersion: 'old', publicId: 'private/cand2' },
      'servicePhotos/orig': { ownerId: 'owner', serviceId: 'shop', submissionId: 'old-sub', candidateId: 'orig', status: 'approved', approvedPhoto: oldPhoto, publicId: 'private/orig' },
    });
    const restored = await restorePhoto(env, dbTextThenRestore.asStore(), 'shop');
    assert.ok(restored.placePhoto);
    assert.equal(dbTextThenRestore.docs['servicePhotos/cand2'].expectedPhotoVersion, restored.placePhoto.version);
    const res2 = await reviewPhoto(req({ decision: 'approved' }), env, dbTextThenRestore.asStore(), 'sub2', 'admin');
    assert.equal(res2.photoReviewStatus, 'approved');
    assert.equal(dbTextThenRestore.docs['providers/shop'].placePhoto.version, res2.approvedPlacePhoto?.version);

    // 3. Text-first when restorePhoto has not yet run (archiveStatus === 'restored' and provider has no placePhoto)
    const dbTextNoRestore = new MemoryStore({
      'providers/shop': { ownerId: 'owner' },
      'archivedProviders/shop': { ownerId: 'owner', archiveStatus: 'restored', placePhoto: oldPhoto },
      'requestSlots/shop': { ownerId: 'owner', requestId: 'sub3' },
      'serviceRequests/sub3': { ownerId: 'owner', providerId: 'shop', type: 'restore', status: 'approved', photoReviewStatus: 'pending', photoChange: { action: 'remove', expectedPhotoVersion: 'old' } },
    });
    const res3 = await reviewPhoto(req({ decision: 'approved' }), env, dbTextNoRestore.asStore(), 'sub3', 'admin');
    assert.equal(res3.approvedPlacePhoto, null);
    assert.equal(dbTextNoRestore.docs['providers/shop'].placePhoto, null);
    assert.equal(dbTextNoRestore.docs['archivedProviders/shop'].placePhoto.version, 'old');
  } finally {
    stub.mock.restore();
  }
});

test('photo-first approval followed by text rejection destroys orphaned publicAssets and marks candidate deleted', async () => {
  const thumbAsset = { publicId: 'service-photos/public/v1/thumbnail', deliveryType: 'upload' as const };
  const detailAsset = { publicId: 'service-photos/public/v1/detail', deliveryType: 'upload' as const };
  const db = new MemoryStore({
    'requestSlots/shop': { ownerId: 'owner', requestId: 'sub1' },
    'serviceRequests/sub1': { ownerId: 'owner', providerId: 'shop', status: 'rejected', photoReviewStatus: 'approved', approvedPlacePhoto: oldPhoto },
    'servicePhotos/cand1': { ownerId: 'owner', serviceId: 'shop', submissionId: 'sub1', candidateId: 'cand1', status: 'approved', approvedPhoto: oldPhoto, publicAssets: [thumbAsset, detailAsset], publicId: 'service-photos/private/owner/shop/cand1' },
    'photoCleanupJobs/src': { status: 'pending', notBefore: '2000-01-01', publicId: 'service-photos/private/owner/shop/cand1', deliveryType: 'authenticated' },
  });
  const destroyed: string[] = [];
  const stub = mock.method(Cloudinary.prototype, 'destroy', async (asset: any) => {
    destroyed.push(asset.publicId);
    return { result: 'ok' };
  });
  try {
    await cleanupAssets(db.asStore(), new Cloudinary(env));
    assert.deepEqual(destroyed, [
      'service-photos/public/v1/thumbnail',
      'service-photos/public/v1/detail',
      'service-photos/private/owner/shop/cand1',
    ]);
    assert.equal(db.docs['servicePhotos/cand1'].status, 'deleted');
    assert.deepEqual(db.docs['servicePhotos/cand1'].publicAssets, []);
    assert.equal(db.docs['photoCleanupJobs/src'].status, 'done');
  } finally {
    stub.mock.restore();
  }
});

test('stale restored archivedProviders record does not block reserve or retain obsolete assets in cleanupAssets', async () => {
  const db = new MemoryStore({
    'archivedProviders/provider-sub1': { ownerId: 'owner', archiveStatus: 'restored', placePhoto: oldPhoto },
    'servicePhotos/cand1': { ownerId: 'owner', serviceId: 'provider-sub1', submissionId: 'sub1', candidateId: 'cand1', status: 'approved', approvedPhoto: oldPhoto, publicId: 'service-photos/private/owner/provider-sub1/cand1' },
    'photoCleanupJobs/src': { status: 'pending', notBefore: '2000-01-01', publicId: 'service-photos/private/owner/provider-sub1/cand1', deliveryType: 'authenticated' },
  });
  const reserved = await reserve(req({ serviceId: 'provider-sub1', submissionId: 'sub1' }), env, db.asStore(), 'owner');
  assert.ok(reserved.candidateId);
  const destroyed: string[] = [];
  const stub = mock.method(Cloudinary.prototype, 'destroy', async (asset: any) => {
    destroyed.push(asset.publicId);
    return { result: 'ok' };
  });
  try {
    await cleanupAssets(db.asStore(), new Cloudinary(env));
    assert.deepEqual(destroyed, ['service-photos/private/owner/provider-sub1/cand1']);
    assert.equal(db.docs['servicePhotos/cand1'].status, 'deleted');
  } finally {
    stub.mock.restore();
  }
});

test('cleanupService paginates delete jobs with cursor and preserves assets for active providers', async () => {
  const db = new MemoryStore({
    'providers/active-svc': { ownerId: 'owner' },
    'servicePhotos/c0': { ownerId: 'owner', serviceId: 'active-svc', candidateId: 'c0', status: 'approved', publicId: 'service-photos/private/owner/active-svc/c0', publicAssets: [{ publicId: 'service-photos/public/v1/detail', deliveryType: 'upload' }] },
    'servicePhotos/c1': { ownerId: 'owner', serviceId: 'deleted-svc', candidateId: 'c1', status: 'uploaded', publicId: 'service-photos/private/owner/deleted-svc/c1', publicAssets: [] },
    'servicePhotos/c2': { ownerId: 'owner', serviceId: 'deleted-svc', candidateId: 'c2', status: 'uploaded', publicId: 'service-photos/private/owner/deleted-svc/c2', publicAssets: [] },
    'servicePhotos/c3': { ownerId: 'owner', serviceId: 'deleted-svc', candidateId: 'c3', status: 'uploaded', publicId: 'service-photos/private/owner/deleted-svc/c3', publicAssets: [] },
    'servicePhotos/c4': { ownerId: 'owner', serviceId: 'deleted-svc', candidateId: 'c4', status: 'uploaded', publicId: 'service-photos/private/owner/deleted-svc/c4', publicAssets: [] },
    'photoServiceCleanupJobs/active-job': { id: 'active-job', providerId: 'active-svc', ownerId: 'owner', reason: 'delete', state: 'pending' },
    'photoServiceCleanupJobs/del-job': { id: 'del-job', providerId: 'deleted-svc', ownerId: 'owner', reason: 'delete', state: 'pending' },
  });
  const destroyed: string[] = [];
  const stub = mock.method(Cloudinary.prototype, 'destroy', async (asset: any) => {
    destroyed.push(asset.publicId);
    return { result: 'ok' };
  });
  try {
    await cleanupService(db.asStore(), new Cloudinary(env), { ...db.docs['photoServiceCleanupJobs/active-job'], id: 'active-job' });
    assert.deepEqual(destroyed, []);
    assert.equal(db.docs['servicePhotos/c0'].status, 'approved');
    assert.equal(db.docs['photoServiceCleanupJobs/active-job'].state, 'done');

    await cleanupService(db.asStore(), new Cloudinary(env), { ...db.docs['photoServiceCleanupJobs/del-job'], id: 'del-job' });
    assert.deepEqual(destroyed, [
      'service-photos/private/owner/deleted-svc/c1',
      'service-photos/private/owner/deleted-svc/c2',
      'service-photos/private/owner/deleted-svc/c3',
    ]);
    assert.equal(db.docs['photoServiceCleanupJobs/del-job'].state, 'pending');
    assert.equal(db.docs['photoServiceCleanupJobs/del-job'].cursor, 'c3');

    await cleanupService(db.asStore(), new Cloudinary(env), { ...db.docs['photoServiceCleanupJobs/del-job'], id: 'del-job' });
    assert.deepEqual(destroyed, [
      'service-photos/private/owner/deleted-svc/c1',
      'service-photos/private/owner/deleted-svc/c2',
      'service-photos/private/owner/deleted-svc/c3',
      'service-photos/private/owner/deleted-svc/c4',
    ]);
    assert.equal(db.docs['servicePhotos/c4'].status, 'deleted');
    assert.equal(db.docs['photoServiceCleanupJobs/del-job'].state, 'done');
    assert.equal(db.docs['photoServiceCleanupJobs/del-job'].cursor, null);
  } finally {
    stub.mock.restore();
  }
});

test('reconcileOrphans queues unreferenced assets older than 25h and skips recent or referenced assets', async () => {
  const oldIso = new Date(Date.now() - 26 * 3600000).toISOString();
  const freshIso = new Date(Date.now() - 2 * 3600000).toISOString();
  const db = new MemoryStore({
    'providers/shop': { ownerId: 'owner', placePhoto: oldPhoto },
    'requestSlots/shop': { ownerId: 'owner', requestId: 'sub1' },
    'serviceRequests/sub1': { ownerId: 'owner', providerId: 'shop', status: 'pending', photoReviewStatus: 'pending', photoChange: { action: 'replace', candidateId: 'activeCand' } },
    'servicePhotos/activeCand': { ownerId: 'owner', serviceId: 'shop', submissionId: 'sub1', candidateId: 'activeCand', status: 'uploaded', publicId: 'service-photos/private/owner/shop/activeCand' },
  });
  const stub = mock.method(Cloudinary.prototype, 'listResources', async () => ({
    resources: [
      { public_id: 'service-photos/private/owner/shop/activeCand', created_at: oldIso },
      { public_id: 'service-photos/private/owner/shop/freshCand', created_at: freshIso },
      { public_id: 'service-photos/private/owner/shop/orphanCand', created_at: oldIso },
    ],
  }));
  try {
    await reconcileOrphans(db.asStore(), new Cloudinary(env));
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_shop_activeCand_authenticated'], undefined);
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_shop_freshCand_authenticated'], undefined);
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_shop_orphanCand_authenticated'].reason, 'orphan-reconcile');
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_shop_orphanCand_authenticated'].status, 'pending');
    assert.equal(db.docs['photoSettings/reconcileCursor'].deliveryType, 'upload');
  } finally {
    stub.mock.restore();
  }
});

test('Cloudinary.derivatives enforces exact 80KB thumbnail and 300KB detail size limits', async () => {
  const cloud = new Cloudinary(env);
  const fetchStub = mock.method(cloud, 'privateBytes', async (_id: string, transform: string) => {
    if (transform.includes('w_480')) return new Uint8Array(90_000);
    if (transform.includes('w_400')) return new Uint8Array(60_000);
    if (transform.includes('q_82')) return new Uint8Array(320_000);
    return new Uint8Array(250_000);
  });
  const uploadStub = mock.method(cloud, 'upload', async (publicId: string, bytes: Uint8Array, _type: 'authenticated' | 'upload', maxBytes = 500_000) => {
    assert.ok(bytes.byteLength <= maxBytes);
    return {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
      width: publicId.endsWith('thumbnail') ? 400 : 1280,
      height: publicId.endsWith('thumbnail') ? 300 : 960,
      bytes: bytes.byteLength,
    };
  });
  try {
    const result = await cloud.derivatives('private/source', 'v99');
    assert.equal(result.photo.version, 'v99');
    assert.equal(uploadStub.mock.calls[0].arguments[3], 80_000);
    assert.equal(uploadStub.mock.calls[1].arguments[3], 300_000);
  } finally {
    fetchStub.mock.restore();
    uploadStub.mock.restore();
  }
});

test('restorePhoto enforces processing pause while retaining private source during cleanup and reconcile, and allows removals while paused', async () => {
  const pausedEnv: Env = { ...env, UPLOADS_ENABLED: 'false' };
  const oldIso = new Date(Date.now() - 26 * 3600000).toISOString();
  const db = new MemoryStore({
    'photoSettings/control': { uploadsEnabled: false },
    'providers/shop': { ownerId: 'owner' },
    'archivedProviders/shop': {
      ownerId: 'owner',
      archiveStatus: 'restored',
      placePhoto: oldPhoto,
    },
    'servicePhotos/cand1': {
      ownerId: 'owner',
      serviceId: 'shop',
      submissionId: 'old-sub',
      candidateId: 'cand1',
      status: 'approved',
      approvedPhoto: oldPhoto,
      publicId: 'service-photos/private/owner/shop/cand1',
    },
    'photoCleanupJobs/src': {
      status: 'pending',
      notBefore: '2000-01-01',
      publicId: 'service-photos/private/owner/shop/cand1',
      deliveryType: 'authenticated',
    },
  });

  const derivStub = mock.method(
    Cloudinary.prototype,
    'derivatives',
    async () => ({
      photo: { ...oldPhoto, version: 'restored-v2' },
      assets: [
        {
          publicId: 'service-photos/public/restored-v2/thumbnail',
          deliveryType: 'upload' as const,
        },
      ],
    }),
  );
  const destroyStub = mock.method(Cloudinary.prototype, 'destroy', async () => {
    throw new Error('Must not destroy private source awaiting paused restore');
  });
  const listStub = mock.method(
    Cloudinary.prototype,
    'listResources',
    async () => ({
      resources: [
        {
          public_id: 'service-photos/private/owner/shop/cand1',
          created_at: oldIso,
        },
      ],
    }),
  );

  try {
    await assert.rejects(
      restorePhoto(env, db.asStore(), 'shop'),
      (error) => error instanceof HttpError && error.status === 503,
    );
    await assert.rejects(
      restorePhoto(pausedEnv, { ...db.asStore(), get: async (p: string) => (p === 'photoSettings/control' ? null : db.get(p)) } as unknown as Store, 'shop'),
      (error) => error instanceof HttpError && error.status === 503,
    );
    assert.equal(derivStub.mock.callCount(), 0);
    assert.equal(
      Object.keys(db.docs).some((key) =>
        db.docs[key]?.reason === 'failed-restoration',
      ),
      false,
    );

    // Source remains protected during cleanupAssets and reconcileOrphans while restore awaits processing resume.
    await cleanupAssets(db.asStore(), new Cloudinary(env));
    assert.equal(destroyStub.mock.callCount(), 0);
    assert.ok(db.docs['photoCleanupJobs/src'].notBefore > new Date().toISOString());

    await reconcileOrphans(db.asStore(), new Cloudinary(env));
    assert.equal(
      db.docs[
        'photoCleanupJobs/service-photos_private_owner_shop_cand1_authenticated'
      ],
      undefined,
    );

    // Lifting pause lets restorePhoto generate derivatives cleanly.
    db.docs['photoSettings/control'] = { uploadsEnabled: true };
    const restored = await restorePhoto(env, db.asStore(), 'shop');
    assert.equal(restored.placePhoto.version, 'restored-v2');
    assert.equal(derivStub.mock.callCount(), 1);

    // Explicit removal (placePhoto: null) never regenerates archived photo even if restored earlier.
    db.docs['providers/shop'].placePhoto = null;
    const explicitRemoved = await restorePhoto(env, db.asStore(), 'shop');
    assert.equal(explicitRemoved.placePhoto, null);
    assert.equal(derivStub.mock.callCount(), 1);

    // Paused control blocks replace approval (503) while still allowing remove approval.
    db.docs['photoSettings/control'] = { uploadsEnabled: false };
    const replaceDb = reviewDb('replace');
    replaceDb.docs['photoSettings/control'] = { uploadsEnabled: false };
    await assert.rejects(
      reviewPhoto(
        req({ decision: 'approved' }),
        env,
        replaceDb.asStore(),
        'submission',
        'admin',
      ),
      (error) => error instanceof HttpError && error.status === 503,
    );

    const removeDb = reviewDb('remove');
    removeDb.docs['photoSettings/control'] = { uploadsEnabled: false };
    const removed = await reviewPhoto(
      req({ decision: 'approved' }),
      env,
      removeDb.asStore(),
      'submission',
      'admin',
    );
    assert.equal(removed.photoReviewStatus, 'approved');
    assert.equal(removed.approvedPlacePhoto, null);
  } finally {
    derivStub.mock.restore();
    destroyStub.mock.restore();
    listStub.mock.restore();
  }
});

test('deleteAccount rejects admins and stale authentication without modifying records', async () => {
  const db = new MemoryStore({
    'users/admin1': { displayName: 'مشرف', role: 'admin' },
    'users/owner': { displayName: 'صاحب خدمة' },
    'providers/p1': { ownerId: 'owner' },
  });
  const freshAuthTime = Math.floor(Date.now() / 1000);
  await assert.rejects(
    deleteAccount(env, db.asStore(), { uid: 'owner', admin: true, authTime: freshAuthTime }),
    (error) => error instanceof HttpError && error.status === 403,
  );
  await assert.rejects(
    deleteAccount(env, db.asStore(), { uid: 'admin1', admin: false, authTime: freshAuthTime }),
    (error) => error instanceof HttpError && error.status === 403,
  );
  await assert.rejects(
    deleteAccount(env, db.asStore(), { uid: 'owner', admin: false, authTime: freshAuthTime - 600 }),
    (error) => error instanceof HttpError && error.status === 401 && error.message === 'Recent login required',
  );
  assert.ok(db.docs['users/owner']);
  assert.ok(db.docs['providers/p1']);
  assert.ok(db.docs['users/admin1']);
});

test('deleteAccount removes all owned records and photos even when uploads are disabled while preserving other users data', async () => {
  const pausedEnv: Env = {
    ...env,
    UPLOADS_ENABLED: 'false',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  };
  const db = new MemoryStore({
    'photoSettings/control': { uploadsEnabled: false },
    'users/owner': { displayName: 'أحمد' },
    'users/other': { displayName: 'سارة' },
    'serviceQuotas/owner': { serviceIds: ['p1'] },
    'serviceQuotas/other': { serviceIds: ['p-other'] },
    'photoUploadQuotas/owner': { day: '2026-11-19', attempts: 2 },
    'providers/p1': { ownerId: 'owner', placePhoto: oldPhoto },
    'providers/p-other': { ownerId: 'other' },
    'archivedProviders/a1': { ownerId: 'owner', archiveStatus: 'unpublished' },
    'archivedProviders/a-other': { ownerId: 'other', archiveStatus: 'unpublished' },
    'photoUploadSlots/p1': { ownerId: 'owner', candidateId: 'cand1' },
    'requestSlots/p1': { ownerId: 'owner', requestId: 'r1' },
    'serviceRequests/r1': { ownerId: 'owner', providerId: 'p1', status: 'approved' },
    'serviceRequests/r1/scheduleValidation/0': { ownerId: 'owner' },
    'serviceRequests/r1/scheduleValidation/1': { ownerId: 'owner' },
    'serviceRequests/r1/scheduleValidation/2': { ownerId: 'owner' },
    'serviceRequests/r1/scheduleValidation/3': { ownerId: 'owner' },
    'serviceRequests/r-other': { ownerId: 'other', providerId: 'p-other', status: 'pending' },
    'reports/rep1': { reporterId: 'owner', providerId: 'p-other', reason: 'بلاغ' },
    'reports/rep-other': { reporterId: 'other', providerId: 'p1', reason: 'بلاغ من غيره' },
    'serviceClaims/p-other_owner': { claimantId: 'owner', providerId: 'p-other', status: 'pending' },
    'serviceClaims/p1_stranger': { claimantId: 'stranger', providerId: 'p1', status: 'pending' },
    'serviceClaims/p-other_stranger': { claimantId: 'stranger', providerId: 'p-other', status: 'pending' },
    'supportRequests/sup1': { ownerId: 'owner', kind: 'support', message: 'مساعدة' },
    'supportRequests/sup-other': { ownerId: 'other', kind: 'support', message: 'أخرى' },
    'servicePhotos/cand1': {
      ownerId: 'owner',
      serviceId: 'p1',
      candidateId: 'cand1',
      status: 'approved',
      publicId: 'service-photos/private/owner/p1/cand1',
      approvedPhoto: oldPhoto,
      publicAssets: [
        { publicId: 'service-photos/public/old/thumbnail', deliveryType: 'upload' },
        { publicId: 'service-photos/public/old/detail', deliveryType: 'upload' },
      ],
    },
    'servicePhotos/cand-other': {
      ownerId: 'other',
      serviceId: 'p-other',
      candidateId: 'cand-other',
      status: 'uploaded',
      publicId: 'service-photos/private/other/p-other/cand-other',
    },
    'photoServiceCleanupJobs/job1': { ownerId: 'owner', providerId: 'p1', reason: 'unpublish', state: 'pending' },
  });
  const destroyed: string[] = [];
  const stub = mock.method(Cloudinary.prototype, 'destroy', async (asset: any) => {
    destroyed.push(asset.publicId);
    return { result: 'ok' };
  });
  try {
    const result = await deleteAccount(pausedEnv, db.asStore(), {
      uid: 'owner',
      admin: false,
      authTime: Math.floor(Date.now() / 1000),
    });
    assert.deepEqual(result, {
      deleted: true,
      hasMore: false,
      deletedProviderIds: ['p1'],
    });
    assert.deepEqual(destroyed.sort(), [
      'service-photos/private/owner/p1/cand1',
      'service-photos/public/old/detail',
      'service-photos/public/old/thumbnail',
    ]);
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_p1_cand1_authenticated'].status, 'done');
    assert.equal(db.docs['photoCleanupJobs/service-photos_public_old_thumbnail_upload'].status, 'done');
    assert.equal(db.docs['photoCleanupJobs/service-photos_public_old_detail_upload'].status, 'done');

    for (const deletedPath of [
      'users/owner',
      'serviceQuotas/owner',
      'photoUploadQuotas/owner',
      'providers/p1',
      'archivedProviders/a1',
      'photoUploadSlots/p1',
      'requestSlots/p1',
      'serviceRequests/r1',
      'serviceRequests/r1/scheduleValidation/0',
      'serviceRequests/r1/scheduleValidation/3',
      'reports/rep1',
      'serviceClaims/p-other_owner',
      'serviceClaims/p1_stranger',
      'supportRequests/sup1',
      'servicePhotos/cand1',
      'photoServiceCleanupJobs/job1',
    ]) {
      assert.equal(db.docs[deletedPath], undefined, `${deletedPath} should be deleted`);
    }

    for (const preservedPath of [
      'users/other',
      'serviceQuotas/other',
      'providers/p-other',
      'archivedProviders/a-other',
      'serviceRequests/r-other',
      'reports/rep-other',
      'serviceClaims/p-other_stranger',
      'supportRequests/sup-other',
      'servicePhotos/cand-other',
    ]) {
      assert.ok(db.docs[preservedPath], `${preservedPath} should be preserved`);
    }

    // Idempotent second call when nothing remains
    const repeat = await deleteAccount(pausedEnv, db.asStore(), {
      uid: 'owner',
      admin: false,
      authTime: Math.floor(Date.now() / 1000),
    });
    assert.deepEqual(repeat, { deleted: true, hasMore: false, deletedProviderIds: [] });
  } finally {
    stub.mock.restore();
  }
});

test('deleteAccount caps immediate Cloudinary destroys at 6, leaves failed/overflow pending, and paginates multi-pass deletion', async () => {
  const cloudEnv: Env = {
    ...env,
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  };
  const docs: Record<string, Doc> = {
    'users/owner': { displayName: 'أحمد' },
    'serviceQuotas/owner': { serviceIds: [] },
    'photoUploadQuotas/owner': { day: '2026-11-19', attempts: 1 },
  };
  for (let i = 0; i < 12; i += 1) {
    docs[`providers/p${String(i).padStart(2, '0')}`] = { ownerId: 'owner' };
  }
  for (let i = 0; i < 8; i += 1) {
    docs[`servicePhotos/c${i}`] = {
      ownerId: 'owner',
      serviceId: 'p00',
      candidateId: `c${i}`,
      status: 'uploaded',
      publicId: `service-photos/private/owner/p00/c${i}`,
    };
  }
  const db = new MemoryStore(docs);
  let calls = 0;
  const stub = mock.method(Cloudinary.prototype, 'destroy', async () => {
    calls += 1;
    if (calls === 2) throw new Error('cloudinary transient error');
    return { result: 'ok' };
  });
  try {
    const authTime = Math.floor(Date.now() / 1000);
    const pass1 = await deleteAccount(cloudEnv, db.asStore(), { uid: 'owner', admin: false, authTime });
    assert.equal(pass1.deleted, false);
    assert.equal(pass1.hasMore, true);
    assert.equal(pass1.deletedProviderIds.length, 10);
    assert.ok(db.docs['users/owner'], 'user profile retained until final pass');
    assert.ok(db.docs['serviceQuotas/owner']);
    assert.equal(calls, 6);
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_p00_c0_authenticated'].status, 'done');
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_p00_c1_authenticated'].status, 'pending');
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_p00_c6_authenticated'].status, 'pending');
    assert.equal(db.docs['photoCleanupJobs/service-photos_private_owner_p00_c7_authenticated'].status, 'pending');

    const pass2 = await deleteAccount(cloudEnv, db.asStore(), { uid: 'owner', admin: false, authTime });
    assert.equal(pass2.deleted, true);
    assert.equal(pass2.hasMore, false);
    assert.equal(pass2.deletedProviderIds.length, 2);
    assert.equal(db.docs['users/owner'], undefined);
    assert.equal(db.docs['serviceQuotas/owner'], undefined);
    assert.equal(db.docs['photoUploadQuotas/owner'], undefined);
  } finally {
    stub.mock.restore();
  }
});
