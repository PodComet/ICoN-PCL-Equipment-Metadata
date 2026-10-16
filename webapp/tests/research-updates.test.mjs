import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshResearchEvidence,withSharedResearchOverrides} from '../app/research-policy.ts';
import {allDocumentationLinks,pricePresentation} from '../app/catalog-lib.ts';

const updates=JSON.parse(readFileSync(new URL('../app/data/research-updates.json',import.meta.url),'utf8'));
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const q125=seed.records.find(r=>r.equipment_id==='M09-01');
const update=updates.find(r=>r.equipment_id===q125.equipment_id);
const old=()=>Object.assign({...q125},...update.groups.map(group=>group.before));

test('new literature associations refresh old models while preserving personal notes and explicit relationship edits',()=>{
 for(const eid of ['M02-05','REQ-EQ-020']){
  const record=seed.records.find(r=>r.equipment_id===eid),change=updates.find(r=>r.equipment_id===eid);
  const previous=Object.assign({...record},...change.groups.map(g=>g.before),{notes:'My lab notes'});
  const refreshed=refreshResearchEvidence(previous,updates);
  assert.ok(refreshed.related_process_ids.split(';').includes('P18'));assert.equal(refreshed.notes,'My lab notes');
  const protectedRecord=withSharedResearchOverrides({...previous,related_process_ids:''},['related_process_ids']);
  assert.equal(refreshResearchEvidence(protectedRecord,updates).related_process_ids,'');
  assert.equal(refreshResearchEvidence({...previous,model_name:'Different model',related_process_ids:''},updates).related_process_ids,'');
 }
});

test('saved pre-review snapshots gain model links and sourced prices while research notes survive',()=>{
 const snapshot={...old(),notes:'My experimental notes'};
 const refreshed=refreshResearchEvidence(snapshot,updates);
 assert.equal(refreshed.product_page_url,'https://www.sonicator.com/products/q125-sonicator');
 assert.equal(refreshed.manual_match_status,'verified_operating_manual');
 assert.equal(pricePresentation(refreshed).estimated,false);
 assert.equal(refreshed.notes,'My experimental notes');
 assert.deepEqual(refreshResearchEvidence(refreshed,updates),refreshed);
});

test('alternate sub-models have independently sourced images and saved snapshots gain the right photo',()=>{
 const added=updates.filter(entry=>entry.model_name&&entry.groups.some(group=>group.after.image_url));
 assert.equal(added.length,81);
 for(const update of added){
  const record=seed.records.find(r=>r.equipment_id===update.equipment_id);
  const group=update.groups.find(g=>g.after.image_url);
  const saved={...record,...group.before,notes:'Keep my experimental notes'};
  const refreshed=refreshResearchEvidence(saved,updates);
  for(const field of ['image_url','image_source_url','image_scope','media_checked_date'])assert.equal(refreshed[field],record[field],record.equipment_id+' '+field);
  assert.equal(refreshed.notes,saved.notes);
  assert.deepEqual(refreshResearchEvidence(refreshed,updates),refreshed);
 }
 for(const ids of [['M10-01','M10-04','M10-05','M10-06'],['M16-02','M16-07','M16-08'],['M18-01','M18-04','M18-05']]){
  const variants=ids.map(id=>seed.records.find(r=>r.equipment_id===id));
  assert.ok(variants.every(r=>r.image_url&&r.image_source_url&&r.image_scope));
  assert.equal(new Set(variants.map(r=>r.image_url)).size,ids.length,'Capacity/controller variants use their own photos when available');
 }
});

test('new photo migrations preserve custom images, intentional clears and renamed model identities',()=>{
 const record=seed.records.find(r=>r.equipment_id==='M10-06');
 const update=updates.find(r=>r.equipment_id===record.equipment_id),group=update.groups.find(g=>g.after.image_url);
 const saved={...record,...group.before};
 for(const patch of [{model_name:'A different model'},{manufacturer:'Another manufacturer'}]){
  const changed={...saved,...patch};assert.deepEqual(refreshResearchEvidence(changed,updates),changed);
 }
 const custom={...saved,image_url:'https://example.org/my-photo.jpg',image_source_url:'https://example.org/source',image_scope:'My photo'};
 assert.equal(refreshResearchEvidence(custom,updates).image_url,custom.image_url);
 assert.equal(refreshResearchEvidence(saved,updates,['image_url']).image_url,saved.image_url);
 const cleared=withSharedResearchOverrides(saved,['image_url']);
 assert.equal(refreshResearchEvidence(cleared,updates).image_url,'');
});

test('custom manual and price evidence are retained as complete groups',()=>{
 const snapshot={...old(),manual_url:'https://example.org/my-manual.pdf',manual_match_status:'not_verified',manufacturer_price_value:'777',manufacturer_price_source_url:'https://example.org/my-quote'};
 const refreshed=refreshResearchEvidence(snapshot,updates);
 assert.equal(refreshed.manual_url,snapshot.manual_url);assert.equal(refreshed.manual_match_status,'not_verified');
 assert.equal(refreshed.manufacturer_price_value,'777');assert.equal(refreshed.manufacturer_price_source_url,snapshot.manufacturer_price_source_url);
 assert.equal(refreshed.product_page_url,q125.product_page_url);
});

test('explicitly cleared links stay cleared and new equipment cannot inherit a reviewed model price',()=>{
 const snapshot=old(),refreshed=refreshResearchEvidence(snapshot,updates,['product_page_url','manufacturer_price_value']);
 assert.equal(refreshed.product_page_url,snapshot.product_page_url);assert.equal(refreshed.manufacturer_price_value,snapshot.manufacturer_price_value);
 const variant={...old(),equipment_id:'USER-NEW-VARIANT'};
 assert.deepEqual(refreshResearchEvidence(variant,updates),variant);
});

test('CSV admin clears remain effective after loading a reviewed seed',()=>{
 const cleared={...q125,product_page_url:'',manufacturer_price_value:'',manufacturer_price_currency:'',manufacturer_price_kind:'',manufacturer_price_source_url:'',manufacturer_price_checked_date:'',manufacturer_price_scope:''};
 const saved=withSharedResearchOverrides(cleared,['product_page_url','manufacturer_price_value']);
 const refreshed=refreshResearchEvidence(saved,updates);
 assert.equal(refreshed.product_page_url,'');assert.equal(refreshed.manufacturer_price_value,'');
 assert.equal(pricePresentation(refreshed).estimated,true);
});

test('instrument details expose manual, specifications and brochure without duplicate or unsafe links',()=>{
 const record={equipment_id:'EXAMPLE-DOCS',model_name:'Example instrument',manual_match_status:'verified_operating_manual',manual_url:'https://example.org/manual.pdf',technical_spec_url:'https://example.org/spec.pdf',brochure_url:'https://example.org/brochure.pdf'};
 assert.deepEqual(allDocumentationLinks(record).map(link=>link.label),['Operating manual','Technical specifications','Brochure']);
 assert.equal(allDocumentationLinks({...record,brochure_url:record.technical_spec_url}).length,2);
 assert.equal(allDocumentationLinks({...record,brochure_url:'javascript:alert(1)'}).length,2);
 const pending=allDocumentationLinks({...record,manual_match_status:'scope_or_generation_unresolved'});
 assert.equal(pending[0].label,'Technical specifications');
 assert.ok(pending.some(link=>link.label==='Linked manual / document (needs review)'));
 assert.ok(!pending.some(link=>link.label==='Operating manual'));
});

test('new-generation EUROSTAR pricing is not attached to the unresolved source identifier',()=>{
 const instrument=seed.records.find(r=>r.equipment_id==='M03-01');
 assert.equal(instrument.manual_match_status,'scope_or_generation_unresolved');
 assert.equal(instrument.manufacturer_price_value,'');
 assert.match(instrument.product_page_scope,/new-generation.*0020132593/);
});

test('saved equipment snapshots receive sourced photos without losing research notes',()=>{
 const instrument=seed.records.find(r=>r.equipment_id==='M07-05');
 const snapshot={...instrument,image_url:'',image_source_url:'',image_scope:'',media_checked_date:'',notes:'Keep my syringe configuration'};
 const refreshed=refreshResearchEvidence(snapshot,updates);
 assert.match(refreshed.image_url,/syringepump\.com\/images\/NE-4000/);
 assert.equal(refreshed.image_source_url,instrument.product_page_url);
 assert.equal(refreshed.notes,snapshot.notes);
 assert.equal(refreshed.manufacturer_price_value,snapshot.manufacturer_price_value);
 assert.deepEqual(refreshResearchEvidence(refreshed,updates),refreshed);
});

test('photo refresh preserves personal images and intentional admin clears with their attribution',()=>{
 const instrument=seed.records.find(r=>r.equipment_id==='M07-05');
 const blank={...instrument,image_url:'',image_source_url:'',image_scope:'',media_checked_date:''};
 const custom={...blank,image_url:'https://example.org/my-lab-pump.jpg',image_scope:'My installed pump'};
 const refreshed=refreshResearchEvidence(custom,updates);
 assert.equal(refreshed.image_url,custom.image_url);
 assert.equal(refreshed.image_scope,custom.image_scope);
 assert.equal(refreshed.image_source_url,'');
 const cleared=withSharedResearchOverrides(blank,['image_url']);
 assert.equal(refreshResearchEvidence(cleared,updates).image_url,'');
 assert.equal(refreshResearchEvidence(blank,updates,['image_scope']).image_url,'');
});
