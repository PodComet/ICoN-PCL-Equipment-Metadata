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
 assert.equal(filterRows(rows,base).length,14);
 assert.deepEqual(wet.map(r=>r.record.equipment_id),['REQ-EQ-021']);
 assert.equal(dry.length,11);assert.ok(dry.every(r=>!r.record.related_process_ids.split(';').includes('P13')));
 assert.equal(rows.filter(r=>matches(r,'X-ETCH','','','',false,false)).length,1);
});

test('historical stored payloads migrate category without discarding edited metadata',()=>{
 for(const [id,legacy,category] of [['REQ-EQ-021','X-ETCH','M61'],['REQ-EQ-022','X-FILTER','M15'],['REQ-EQ-041','X-LASER','M56'],['REQ-EQ-023','X-MIX','M50'],['REQ-EQ-036','X-MIX','M50'],['REQ-EQ-019','X-ROB','M62'],['REQ-EQ-043','X-ROB','M62']]){
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
 assert.match(laser.estimate_subject,/CO2 laser source; continuous-wave/);
 assert.equal(laser.estimated_msrp_high,'');assert.equal(laser.estimate_status,'no_benchmarks');
});

test('legacy CSV updates resolve by record while ambiguous new X-FILTER assignments are rejected',()=>{
 for(const [id,category] of [['REQ-EQ-021','X-ETCH'],['REQ-EQ-022','X-FILTER'],['REQ-EQ-041','X-LASER'],['REQ-EQ-023','X-MIX'],['REQ-EQ-036','X-MIX'],['REQ-EQ-019','X-ROB'],['REQ-EQ-043','X-ROB']]){
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

test('M50 broadening preserves distinct mixing methods, equipment cards and scoped estimates',()=>{
 const mixing=rows.filter(r=>r.record.category_id==='M50');
 assert.equal(mixing.length,14);
 assert.ok(mixing.every(r=>r.record.category_name==='Shakers and vessel-driven mixers'));
 const subtype=name=>mixing.filter(r=>matches(r,name,'M50','','',false,false));
 assert.equal(subtype('Vortex mixing').length,10);
 assert.deepEqual(subtype('Mechanical shaking').map(r=>r.record.equipment_id),['REQ-EQ-023']);
 assert.deepEqual(subtype('Resonant acoustic mixing').map(r=>r.record.equipment_id),['REQ-EQ-036']);
 assert.equal(subtype('X-MIX').length,2);
 const labram=byId.get('REQ-EQ-036'),shaker=byId.get('REQ-EQ-023');
 assert.ok(labram.purdue_list==='true'&&shaker.purdue_list==='true');
 assert.equal(labram.estimated_msrp_low,'987.6');assert.equal(labram.estimated_msrp_high,'7760');
 assert.equal(byId.get('M50-01').estimated_msrp_high,'7760');
 assert.equal(labram.manual_match_status,'verified_operating_manual');
 assert.ok(!labram.related_process_types.toLowerCase().includes('ultrasonic'));
 assert.equal(seed.categories.find(c=>c.category_id==='M50').source_category_name,'Vortex mixer');
 const generic=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'EXAMPLE-MIXER',category_id:'M50',manufacturer:'Custom',model_name:'New unspecified mixing system'}]));
 assert.deepEqual(generic.errors,[]);assert.equal(generic.changes[0].after.estimated_msrp_low,'987.6');assert.equal(generic.changes[0].after.estimated_msrp_high,'7760');
 const acoustic=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'EXAMPLE-ACOUSTIC',category_id:'M50',manufacturer:'Resodyn',model_name:'New acoustic model',equipment_subtype:'Resonant acoustic mixing'}]));
 assert.deepEqual(acoustic.errors,[]);assert.equal(acoustic.changes[0].after.estimated_msrp_low,'987.6');
});

test('M62 reuses all 13 robotics profiles, preserves provenance and keeps mobile bases distinct',()=>{
 const category=seed.categories.find(c=>c.category_id==='M62');
 assert.equal(category.category_origin,'project_extension');assert.equal(category.source_pdf,'');
 const robots=rows.filter(r=>r.record.category_id==='M62'&&r.record.catalog_scope==='requested_supplement');
 assert.equal(robots.length,13);assert.equal(new Set(robots.map(r=>r.record.equipment_id)).size,13);
 assert.equal(rows.filter(r=>matches(r,'X-ROB','','','',false,false)).length,13);
 assert.equal(rows.filter(r=>matches(r,'M62','','','',false,false)).length,17);
 assert.ok(robots.every(r=>r.record.purdue_list==='true'&&r.record.legacy_category_ids==='X-ROB'));
 assert.ok(robots.filter(r=>r.record.equipment_id!=='REQ-EQ-020').every(r=>!r.record.related_material_ids&&!r.record.related_process_ids));
 const tracer=byId.get('REQ-EQ-043');
 assert.match(tracer.equipment_subtype,/Mobile base; no robot arm/);
 assert.match(tracer.estimate_subject,/Mobile base; no robot arm/);
 assert.equal(tracer.estimated_msrp_low,'');assert.equal(tracer.estimated_msrp_high,'');assert.equal(tracer.estimate_status,'inverted_range');
 assert.match(byId.get('REQ-EQ-017').equipment_subtype,/configuration unspecified/);
 assert.match(byId.get('REQ-EQ-015').equipment_subtype,/cart drive unspecified/);
 for(const categoryId of ['M62','X-ROB']){
  const result=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'EXAMPLE-ROBOT',category_id:categoryId,manufacturer:'Example integrator',model_name:'New automation system'}]));
  assert.deepEqual(result.errors,[]);const added=result.changes[0].after;
  assert.equal(added.category_id,'M62');assert.equal(added.purdue_list,'false');
  assert.ok(!added.related_material_ids&&!added.related_process_ids);
  assert.ok(!added.equipment_subtype||added.equipment_subtype.includes('unspecified'));
 }
});
