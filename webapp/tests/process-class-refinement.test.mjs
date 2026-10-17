import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow,assignInstrument,slotAccepts,workflowReadiness,validateWorkflow} from '../app/process-lib.ts';
import {normalizeWorkflowClasses} from '../app/process-classification-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const isolate=(rid,order)=>{const sources=seed.steps.filter(s=>s.route_id===rid&&s.step_order===order);return {sources,w:createWorkflow(seed.routes.find(r=>r.route_id===rid),sources)};};
const slot=(w,cid)=>w.steps[0].slots.find(s=>s.allowed_category_ids.includes(cid));
const candidate=s=>seed.records.find(r=>slotAccepts(s,r));
const put=(w,cid,r=candidate(slot(w,cid)))=>assignInstrument(w,slot(w,cid).slot_id,r);

test('rinsing requires a wet-processing station; a water purifier alone is optional support',()=>{
 const {sources,w}=isolate('P05','4');assert.equal(slot(w,'M46').extensions.requirement_role,'optional');
 assert.equal(workflowReadiness(put(w,'M46'),sources).complete,false);
 assert.equal(workflowReadiness(put(w,'M85'),sources).complete,true);
});
test('wet development and dry clearing remain alternatives, while deposition/lift-off needs both functions',()=>{
 const {sources,w}=isolate('P06','3');
 assert.equal(workflowReadiness(w,sources).complete,false);
 assert.equal(workflowReadiness(put(w,'M85'),sources).complete,true);
 assert.equal(workflowReadiness(put(w,'M61'),sources).complete,true);
 assert.equal(slotAccepts(slot(w,'M61'),seed.records.find(r=>r.equipment_id==='REQ-EQ-021')),false);
 const transfer=isolate('P06','4'),deposited=put(transfer.w,'M23');
 assert.equal(workflowReadiness(deposited,transfer.sources).complete,false);
 assert.equal(workflowReadiness(put(deposited,'M85'),transfer.sources).complete,true);
 assert.equal(workflowReadiness(put(transfer.w,'M61'),transfer.sources).complete,true);
});
test('casting fixtures complement mixing/vacuum drying/thermal curing and exclude ambient cabinets',()=>{
 for(const [rid,order,other] of [['P29','4','M18'],['P31','3','M03'],['P37','4','M71']]){
  const {w,sources}=isolate(rid,order),part=put(w,other);
  assert.equal(workflowReadiness(part,sources).complete,false);
  assert.equal(workflowReadiness(put(part,'M87'),sources).complete,true);
  assert.equal(slotAccepts(slot(w,'M87'),seed.records.find(r=>r.category_id==='M87'&&r.equipment_subtype==='ambient_drying_station')),false);
 }
});
test('solvent lift-off excludes generic benches and legacy exact-model capability updates preserve saved operation data',()=>{
 const {w,sources}=isolate('P42','5'),s=slot(w,'M85'),solvent=candidate(s);
 const plain=seed.records.find(r=>r.manufacturer==='Cleatech'&&r.category_id==='M85');assert.equal(slotAccepts(s,plain),false);
 const legacy=put(w,'M85',solvent),i=slot(legacy,'M85').instrument;
 i.equipment_snapshot.equipment_subtype='wafer_wet_processing';i.configuration={custom:'keep'};i.operation_sequence=['Retain my reviewed action'];i.price_snapshot={...i.price_snapshot,scope:'My original price snapshot'};
 legacy.steps[0].extensions.requirements_reviewed=true;legacy.steps[0].extensions.requirements={...legacy.steps[0].extensions.requirements,allowed_subtypes_by_category:{M85:['wafer_wet_processing']}};
 const before=JSON.stringify(legacy),fixed=normalizeWorkflowClasses(legacy,sources,seed.records,seed.categories),updated=slot(fixed,'M85').instrument;
 assert.equal(JSON.stringify(legacy),before);assert.deepEqual(updated.configuration,i.configuration);assert.deepEqual(updated.operation_sequence,i.operation_sequence);assert.deepEqual(updated.price_snapshot,i.price_snapshot);
 assert.ok(slotAccepts(slot(fixed,'M85'),updated.equipment_snapshot));assert.equal(fixed.steps[0].extensions.requirements_reviewed,false);
 assert.deepEqual(normalizeWorkflowClasses(fixed,sources,seed.records,seed.categories),fixed);
 const saved=validateWorkflow(fixed,seed.routes,seed.records,fixed);assert.equal(slot(saved,'M85').instrument.equipment_snapshot.equipment_subtype,solvent.equipment_subtype);
 // A different named model cannot acquire another model's capability classification.
 const renamed=structuredClone(legacy);slot(renamed,'M85').instrument.equipment_snapshot.model_name='My custom station';
 const unverified=normalizeWorkflowClasses(renamed,sources,seed.records,seed.categories);assert.equal(slotAccepts(slot(unverified,'M85'),slot(unverified,'M85').instrument.equipment_snapshot),false);
});
