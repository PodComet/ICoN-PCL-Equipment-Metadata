import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV,buildPlan,csvUpdateText} from '../app/csv-updates.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const plan=text=>buildPlan(text,seed.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);
test('CSV handles BOM, quoted commas, escaped quotes and multiline notes',()=>{
 assert.deepEqual(parseCSV('\ufeffa,b\r\n"one,two","line1\nline2 ""quote"""\r\n'),[['a','b'],['one,two','line1\nline2 "quote"']]);
 assert.throws(()=>parseCSV('a,b\n"unfinished'));
 assert.throws(()=>parseCSV('a,b\n"closed"bad,x'));
});
test('blank values preserve fields, clear marker clears, and shared export roundtrips unchanged',()=>{
 const r=seed.records.find(r=>r.equipment_id==='M37-09');
 assert.equal(plan(csvUpdateText([{operation:'update',equipment_id:r.equipment_id,model_name:r.model_name}])).changes.length,0);
 const changed=plan(csvUpdateText([{operation:'update',equipment_id:r.equipment_id,notes:'[CLEAR]'}]));
 assert.equal(changed.changes[0].after.notes,'');assert.equal(changed.changes[0].after.model_name,r.model_name);
 assert.equal(plan(csvUpdateText(seed.records.map(r=>({...r,operation:'update'})))).changes.length,0);
});
test('unknown IDs, duplicate IDs and privileged columns are rejected',()=>{
 assert.ok(plan('operation,equipment_id,notes\nupdate,missing,test').errors.length);
 assert.ok(plan('operation,equipment_id,notes\nupdate,M37-09,a\nupdate,M37-09,b').errors.length);
 assert.ok(plan('operation,equipment_id,purdue_list\nupdate,M37-09,true').errors.length);
 assert.ok(plan('operation,equipment_id,manufacturer_research_use_status\nupdate,M37-09,documented_research_use').errors.length);
});
test('new variants keep family membership but clear provenance and verification',()=>{
 const p=plan(csvUpdateText([{operation:'add_variant',equipment_id:'LAB-QA-250',parent_equipment_id:'M43-03',model_name:'New test variant',variant_label:'250 mL',capacity_ml:'250'}]));
 assert.deepEqual(p.errors,[]);const r=p.changes[0].after;
 assert.equal(r.product_family_id,seed.records.find(r=>r.equipment_id==='M43-03').product_family_id);
 assert.equal(r.purdue_list,'false');assert.equal(r.manual_match_status,'not_verified');assert.equal(r.source_pdf,'');assert.equal(r.image_url,'');
});
test('new equipment requires known category and unknown manufacturers cannot inherit a star',()=>{
 let p=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'LAB-NEW',category_id:'M13',manufacturer:'Unreviewed brand',model_name:'New centrifuge'}]));
 assert.deepEqual(p.errors,[]);assert.equal(p.changes[0].after.manufacturer_brand_identity_status,'needs_review');assert.ok(p.warnings.length);
 p=plan(csvUpdateText([{operation:'add_equipment',equipment_id:'LAB-NEW',category_id:'BAD',manufacturer:'Brand',model_name:'New'}]));assert.ok(p.errors.length);
});
test('URLs, dated prices, photo provenance and relationship IDs are validated',()=>{
 for(const fields of [{manual_url:'javascript:alert(1)'},{msrp_value:'500',msrp_currency:'USD'},{price_checked_date:'2026-02-30',msrp_value:'500',msrp_currency:'USD',price_source_url:'https://example.com'},{image_url:'https://example.com/photo.jpg'},{related_material_ids:'N999'}])assert.ok(plan(csvUpdateText([{operation:'update',equipment_id:'M37-09',...fields}])).errors.length);
 const p=plan(csvUpdateText([{operation:'update',equipment_id:'M37-09',manual_url:'https://example.com/manual.pdf'}]));assert.equal(p.changes[0].after.manual_match_status,'not_verified');
});
test('spreadsheet executable prefixes are escaped on export and roundtrip as text',()=>{
 const p=plan(csvUpdateText([{operation:'update',equipment_id:'M37-09',notes:'=HYPERLINK("bad")'}]));
 assert.equal(p.changes[0].after.notes,'=HYPERLINK("bad")');
 assert.match(csvUpdateText([{operation:'update',equipment_id:'M37-09',notes:'=bad'}]),/'=bad/);
});
