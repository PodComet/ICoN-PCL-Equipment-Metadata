import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalizeEquipment} from '../app/category-policy.ts';
import {matches,filterRows} from '../app/catalog-lib.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
import {attachInventory,inventoryFor} from '../app/inventory-lib.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const byId=new Map(seed.records.map(r=>[r.equipment_id,r]));
const normalize=r=>canonicalizeEquipment(r,byId,seed.categories,seed.category_aliases);
const rows=seed.records.map(record=>({record,revision:0}));
const plan=text=>buildPlan(text,seed.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);

test('wet and dry etching share M61 while method filters remain disjoint',()=>{
 const base={query:'',category:['M61'],material:[],process:[],manufacturer:[],manualOnly:false,requestedOnly:false};
 const wet=filterRows(rows,{...base,process:['P13']}),dry=filterRows(rows,{...base,process:['P14']});
 assert.equal(filterRows(rows,base).length,11);
 assert.deepEqual(wet.map(r=>r.record.equipment_id),['REQ-EQ-021']);
 assert.equal(dry.length,10);assert.ok(dry.every(r=>!r.record.related_process_ids.split(';').includes('P13')));
 assert.equal(rows.filter(r=>matches(r,'X-ETCH','','','',false,false)).length,1);
});

test('historical stored payloads migrate category without discarding edited metadata',()=>{
 for(const [id,legacy,category] of [['REQ-EQ-021','X-ETCH','M61'],['REQ-EQ-022','X-FILTER','M15'],['REQ-EQ-041','X-LASER','M56']]){
  const before={...byId.get(id),category_id:legacy,category_name:'Old category',legacy_category_ids:'',equipment_subtype:'',related_process_ids:'',notes:'Personal research note',manufacturer_price_value:'12345'};
  const after=normalize(before);
  assert.equal(after.category_id,category);assert.equal(after.notes,before.notes);assert.equal(after.manufacturer_price_value,'12345');
  assert.ok(after.legacy_category_ids.includes(legacy));assert.ok(after.equipment_subtype);
  assert.deepEqual(normalize(after),after,'Normalization must be idempotent');
 }
});

test('filtration and centrifuges become separate cards with one shared inventory source',()=>{
 const filter=byId.get('REQ-EQ-022'),centrifuge=byId.get('REQ-EQ-022-CENTRIFUGES');
 assert.equal(filter.category_id,'M15');assert.equal(centrifuge.category_id,'M13');
 assert.notEqual(filter.product_family_id,centrifuge.product_family_id);
 assert.match(filter.equipment_subtype,/configuration unspecified/);assert.match(centrifuge.equipment_subtype,/format and speed class unspecified/);
 assert.ok(!filter.related_process_ids);assert.ok(!centrifuge.related_process_ids);
 const assets=[{instrument_id:'EXAMPLE-COMBINED',equipment_id:filter.equipment_id,serial_or_other_id:'EXAMPLE-ORIGINAL-REFERENCE'}];
 const enriched=attachInventory([{record:filter,revision:0},{record:centrifuge,revision:0}],assets);
 assert.equal(assets.length,1);assert.ok(enriched.every(r=>r.record.purdue_instrument_ids==='EXAMPLE-COMBINED'));
 assert.equal(inventoryFor(assets,centrifuge.equipment_id,centrifuge.source_record_id).length,1);
 assert.equal(enriched.filter(r=>matches(r,'X-FILTER','','','',false,true)).length,2);
});

test('CO2 source joins M56 without inheriting a nanoparticle-ablation process or pulsed price band',()=>{
 const laser=byId.get('REQ-EQ-041');
 assert.equal(laser.category_id,'M56');assert.match(laser.equipment_subtype,/CO2.*continuous-wave/);
 assert.ok(!laser.related_process_ids.split(';').includes('P03'));
 assert.match(laser.estimate_subject,/CO2 laser source only/);
 assert.equal(laser.estimated_msrp_high,'30000');
});

test('legacy CSV updates resolve by record while ambiguous new X-FILTER assignments are rejected',()=>{
 for(const [id,category] of [['REQ-EQ-021','X-ETCH'],['REQ-EQ-022','X-FILTER'],['REQ-EQ-041','X-LASER']]){
  const result=plan(csvUpdateText([{operation:'update',equipment_id:id,category_id:category,notes:'Updated research note'}]));
  assert.deepEqual(result.errors,[]);assert.ok(result.warnings.some(w=>w.message.includes('Legacy category')));
  assert.ok(result.changes[0].after.category_id.startsWith('M'));
 }
 const ambiguous=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'EXAMPLE-AMBIGUOUS',category_id:'X-FILTER',manufacturer:'Custom',model_name:'Unknown separation unit'}]));
 assert.match(ambiguous.errors[0].message,/Choose M13.*M15/);
 const legacyWet=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'EXAMPLE-WET',category_id:'X-ETCH',manufacturer:'Custom',model_name:'Example wet reactor'}]));
 assert.deepEqual(legacyWet.errors,[]);assert.equal(legacyWet.changes[0].after.related_process_ids,'P13');
 assert.equal(legacyWet.changes[0].after.category_id,'M61');assert.equal(legacyWet.changes[0].after.purdue_list,'false');
});

test('new variants cannot inherit the combined source inventory reference',()=>{
 const result=plan(csvUpdateText([{operation:'add_variant',equipment_id:'EXAMPLE-NEW-VARIANT',parent_equipment_id:'REQ-EQ-022-CENTRIFUGES',model_name:'New model variant'}]));
 assert.deepEqual(result.errors,[]);
 const variant=result.changes[0].after;
 assert.equal(variant.source_record_id,'');assert.equal(variant.purdue_list,'false');assert.equal(variant.legacy_category_ids,'');
});
