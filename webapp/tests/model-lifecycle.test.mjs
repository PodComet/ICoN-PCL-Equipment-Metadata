import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyModelLifecycle,newerModel,LIFECYCLE_FIELDS} from '../app/model-lifecycle.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const record=id=>seed.records.find(r=>r.equipment_id===id);
const hydrate=r=>applyModelLifecycle(r,seed.model_lifecycle);
const plan=rows=>buildPlan(csvUpdateText(rows),seed.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);

test('reviewed newer models hydrate old saved records while preserving custom fields',()=>{
 const old={...record('M15-04'),notes:'My local notes',manual_url:'https://example.org/my-manual.pdf'};
 for(const key of LIFECYCLE_FIELDS)delete old[key];
 const refreshed=hydrate(old);
 assert.equal(newerModel(refreshed).name,'Sartorius Vivaflow SU');
 assert.equal(refreshed.notes,old.notes);assert.equal(refreshed.manual_url,old.manual_url);
 assert.match(newerModel(refreshed).scope,/does not extend to Vivaflow 50R or 200/);
});

test('evidence is tied to one model identity rather than a family or inherited variant',()=>{
 const original=record('M15-04');
 for(const changes of [{equipment_id:'USER-CLONE'},{model_name:'Different model'},{manufacturer:'Other maker'}]){
  const r=hydrate({...original,...changes});assert.equal(newerModel(r),null);
  assert.ok(LIFECYCLE_FIELDS.every(key=>r[key]===''));
 }
 assert.equal(newerModel(hydrate(record('M15-05'))),null);
 assert.equal(newerModel(hydrate({...original,manufacturer:'  SARTORIUS  '})).name,'Sartorius Vivaflow SU');
});

test('parallel, unresolved and unreviewed products never gain badges from saved claims',()=>{
 for(const id of ['REQ-EQ-005','REQ-EQ-010','REQ-EQ-015','M13-05','M16-06','M15-01']){
  const forged={...record(id),...Object.fromEntries(LIFECYCLE_FIELDS.map(key=>[key,record('M15-04')[key]]))};
  assert.equal(newerModel(hydrate(forged)),null,id);
 }
});

test('display requires complete evidence, safe links, a real date and a distinct newer model',()=>{
 const r=record('M15-04');assert.ok(newerModel(r));
 for(const patch of [{lifecycle_status:'no_successor_confirmed'},{successor_relationship:''},{successor_product_url:'javascript:alert(1)'},{successor_evidence_url:''},{successor_scope:''},{successor_model_name:r.model_name},{successor_checked_date:'2026-02-30'},{successor_checked_date:'bad-date'}])assert.equal(newerModel({...r,...patch}),null);
});

test('CSV clones and model identity changes clear lifecycle metadata, ordinary edits keep it',()=>{
 const clone=plan([{operation:'add_variant',equipment_id:'TEST-NO-SUCCESSOR',parent_equipment_id:'M15-04',model_name:'A different cassette',variant_label:'Test variant'}]);
 assert.deepEqual(clone.errors,[]);assert.equal(newerModel(clone.changes[0].after),null);
 for(const changes of [{model_name:'Different model'},{manufacturer:'Different brand'}]){
  const p=plan([{operation:'update',equipment_id:'M15-04',...changes}]);
  assert.deepEqual(p.errors,[]);assert.equal(newerModel(p.changes[0].after),null);
 }
 const edited=plan([{operation:'update',equipment_id:'M15-04',notes:'Keep model identity'}]);
 assert.ok(newerModel(edited.changes[0].after));
});

test('the full review has complete confirmed updates and never marks newer targets as old by inheritance',()=>{
 const confirmed=seed.records.filter(r=>r.catalog_scope!=='mit_class_expansion'&&newerModel(r));assert.equal(confirmed.length,26);
 assert.equal(newerModel(record('CAT-LABX-BUCHI-R215')).name,'BUCHI Rotavapor R-300');
 for(const r of confirmed){assert.deepEqual(hydrate(r),r);assert.match(newerModel(r).url,/^https:\/\//)}
 for(const id of ['M15-01','M51-01','M08-01','M42-02'])assert.equal(newerModel(hydrate(record(id))),null);
});

test('screening coverage remains distinct from a confirmed successor or latest-model certification',()=>{
 assert.equal(seed.model_lifecycle.length,seed.records.length);
 const unresolved=seed.records.filter(r=>r.lifecycle_status==='model_unresolved');
 assert.equal(unresolved.filter(r=>['core_example','requested_supplement'].includes(r.catalog_scope)).length,103);assert.ok(unresolved.every(r=>!newerModel(r)));
 assert.equal(record('M26-02').manufacturer,'Elmarco');assert.equal(record('M26-02').lifecycle_status,'no_successor_confirmed');assert.equal(newerModel(record('M26-02')),null);
 assert.equal(newerModel(record('M57-05')).name,'Gamry Reference 3020');
 assert.equal(newerModel(record('M39-09')),null);
});
