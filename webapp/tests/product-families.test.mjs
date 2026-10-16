import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyProductFamily,independentVariant,modelVariants,variantContext,variantsWithNewerModels} from '../app/product-family-policy.ts';
import {groupRows,filterRows,photoFirstGroups} from '../app/catalog-lib.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
import {newerModel} from '../app/model-lifecycle.ts';
import {inventoryFor} from '../app/inventory-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const rows=seed.records.map(record=>({record,revision:0}));
const record=id=>seed.records.find(r=>r.equipment_id===id);
const family=id=>rows.filter(r=>r.record.product_family_id===record(id).product_family_id);
const hydrate=(r,protectedFields=[])=>applyProductFamily(r,seed.product_families,protectedFields);
const plan=input=>buildPlan(csvUpdateText(input),seed.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);

test('family presentation preserves all records and gives 535 cards',()=>{
 assert.equal(rows.length,632);assert.equal(new Set(rows.map(r=>r.record.equipment_id)).size,632);
 assert.equal(groupRows(rows).length,535);assert.equal(seed.product_families.length,86);
 assert.equal(new Set(seed.product_families.map(r=>r.product_family_id)).size,34);
 assert.equal(rows.filter(row=>newerModel(row.record)).length,24);
 const ordered=photoFirstGroups(rows);assert.equal(ordered.flat().length,632);
 const firstMissing=ordered.findIndex(group=>!group.some(row=>row.record.image_url));
 assert.ok(ordered.slice(firstMissing).every(group=>!group.some(row=>row.record.image_url)));
});

test('old snapshots acquire reviewed memberships without replacing custom evidence',()=>{
 const rule=seed.product_families.find(r=>r.equipment_id==='M03-03');
 const old={...record(rule.equipment_id),product_family_id:rule.previous_product_family_id,product_family:rule.previous_product_family,variant_label:rule.previous_variant_label,notes:'Local notes',manual_url:'https://example.org/manual.pdf',msrp_value:'123',image_url:'https://example.org/photo.jpg'};
 const migrated=hydrate(old);
 assert.equal(migrated.product_family_id,rule.product_family_id);assert.equal(migrated.product_family,rule.product_family);assert.equal(migrated.variant_label,rule.variant_label);
 for(const field of ['notes','manual_url','msrp_value','image_url'])assert.equal(migrated[field],old[field]);
 assert.equal(hydrate({...old,product_family:'My display title'}).product_family,'My display title');
 assert.equal(hydrate(old,['variant_label']).variant_label,old.variant_label);
 assert.deepEqual(hydrate(migrated),migrated);
});

test('exact cross-category models share one chip, keeping category evidence separate',()=>{
 const fluid=family('M26-03'),chips=modelVariants(fluid);
 assert.equal(fluid.length,8);assert.equal(chips.length,4);
 assert.deepEqual(chips.map(v=>v.rows[0].record.variant_label),['LE-10','LE-50','LE-100','LE-500']);
 const le100=chips.find(v=>v.rows.some(r=>r.record.equipment_id==='M26-03'));
 assert.equal(variantContext(le100,'M47').record.equipment_id,'M47-01');
 assert.equal(variantContext(le100,'M26').record.equipment_id,'M26-03');
 const inovenso=modelVariants(family('M26-01'));assert.equal(inovenso.length,1);
 assert.notEqual(inovenso[0].rows[0].record.model_evidence_status,inovenso[0].rows[1].record.model_evidence_status);
 const filtered=filterRows(fluid,{query:'',category:['M47'],material:[],process:[],manufacturer:[],manualOnly:false,requestedOnly:false});
 assert.equal(modelVariants(filtered).length,4);assert.ok(filtered.every(r=>r.record.category_id==='M47'));
});

test('configuration chips sort numerically and retain their own metadata',()=>{
 const chips=modelVariants([...family('M14-02')].reverse());
 assert.deepEqual(chips.map(v=>v.rows[0].record.variant_label),['WX 80+','WX 90+','WX 100+']);
 assert.equal(new Set(chips.map(v=>v.rows[0].record.equipment_id)).size,3);
 const scs=family('M24-06');assert.equal(scs.length,2);
 assert.ok(scs.every(row=>newerModel(row.record)));assert.notEqual(scs[0].record.equipment_id,scs[1].record.equipment_id);
 for(const [first,other] of [['M17-01','M17-05'],['M34-01','M34-02'],['M24-01','M24-02']])assert.notEqual(record(first).product_family_id,record(other).product_family_id);
});

test('changed or cloned identities never hide behind an existing model chip',()=>{
 const original=record('M26-03');
 assert.equal(modelVariants([{record:original,revision:0},{record:{...original,model_name:'Different configuration'},revision:0}]).length,2);
 const cloned=independentVariant({...original,equipment_id:'USER-copy'},original);
 assert.equal(cloned.model_variant_id,'USER-copy');assert.equal(cloned.variant_sort_order,'');
 assert.equal(hydrate({...original,manufacturer:'Another maker'}).product_family_id,'PF-'+original.equipment_id);
 assert.equal(hydrate({...original,model_name:'Another model'}).model_variant_id,original.equipment_id);
 assert.equal(independentVariant({...cloned,manufacturer:'Another maker'},original).product_family_id,'PF-USER-copy');
});

test('CSV additions preserve family membership but get independent chip identities',()=>{
 const imported=plan([{operation:'add_variant',equipment_id:'LAB-250',parent_equipment_id:'M26-03',model_name:'Lab configuration',variant_label:'250 mL'}]);
 assert.deepEqual(imported.errors,[]);const result=imported.changes[0].after;
 assert.equal(result.product_family_id,record('M26-03').product_family_id);assert.equal(result.model_variant_id,'LAB-250');assert.equal(result.purdue_list,'false');
 const changedMaker=plan([{operation:'add_variant',equipment_id:'LAB-other',parent_equipment_id:'M26-03',manufacturer:'Other maker',model_name:'Other model',variant_label:'Other'}]);
 assert.deepEqual(changedMaker.errors,[]);assert.equal(changedMaker.changes[0].after.product_family_id,'PF-LAB-other');
});

test('Purdue sub-models keep their exact inventory associations',()=>{
 const ur=family('REQ-EQ-042');assert.equal(modelVariants(ur).length,2);
 const assets=[{equipment_id:'REQ-EQ-042',instrument_id:'PCL IIT - 042'},{equipment_id:'REQ-EQ-019',instrument_id:'PCL IIT - 019'}];
 for(const row of ur){assert.equal(row.record.purdue_list,'true');assert.equal(inventoryFor(assets,row.record.equipment_id).length,1)}
 assert.equal(inventoryFor(assets,'REQ-EQ-042')[0].instrument_id,'PCL IIT - 042');
});

test('all 21 affected families have a notice even when the default sub-model has no successor',()=>{
 const affected=groupRows(rows).filter(group=>variantsWithNewerModels(group).length);
 assert.equal(affected.length,21);
 assert.equal(affected.reduce((count,group)=>count+variantsWithNewerModels(group).length,0),24);
 for(const id of ['M08-01','M51-01']){
  const group=family(id),before=structuredClone(group);
  assert.equal(newerModel(record(id)),null);
  assert.equal(variantsWithNewerModels(group).length,1);
  assert.equal(modelVariants(group).length,2);
  assert.deepEqual(group,before,'A family notice must not change the selected model evidence');
 }
 assert.equal(variantsWithNewerModels(family('M03-03')).length,0);
});

test('family notices count model chips once and respect matching category/model rows',()=>{
 const original=record('M15-04');
 const categoryCopy={...original,equipment_id:'alias-context',category_id:'M99'};
 assert.equal(variantsWithNewerModels([{record:original,revision:0},{record:categoryCopy,revision:0}]).length,1);
 assert.equal(variantsWithNewerModels(family('M51-01').filter(row=>row.record.equipment_id==='M51-01')).length,0);
 const incomplete={...original,successor_evidence_url:''};
 assert.equal(variantsWithNewerModels([{record:incomplete,revision:0}]).length,0);
});
