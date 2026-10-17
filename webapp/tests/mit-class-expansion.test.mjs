import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow,assignInstrument,workflowReadiness,requirementSlots,effectiveRequirements,routeCandidates,clearWorkflowEquipment} from '../app/process-lib.ts';
import {normalizeWorkflowClasses} from '../app/process-classification-lib.ts';
import {withStepDependencies,processDependencyGraph} from '../app/process-dependencies.ts';
import {materialOutcome} from '../app/process-outcome-lib.ts';
import {emptyMaterialPlan} from '../app/process-materials-lib.ts';
const read=n=>JSON.parse(readFileSync(new URL('../app/data/'+n+'.json',import.meta.url)));
const seed=read('catalog'),materials=read('process-materials');
const route=id=>seed.routes.find(r=>r.route_id===id);
const create=id=>createWorkflow(route(id),seed.steps);
const normalize=w=>normalizeWorkflowClasses(w,seed.steps,seed.records,seed.categories);
function coverRequired(workflow){
 let w=workflow;
 for(const step of w.steps){
  const src=seed.steps.find(s=>s.route_id===w.route_id&&s.step_order===step.source_step_order);if(!src)continue;
  const req=effectiveRequirements(w,JSON.parse(src.requirements_json)),branch=req.required_branches.find(b=>b.length&&b.every(cid=>step.slots.some(s=>s.instrument?.category_id===cid)))||req.required_branches[0]||[];
  const used=new Set();
  for(const cid of branch){
   const slot=step.slots.find(s=>s.allowed_category_ids.includes(cid)&&!used.has(s.slot_id));used.add(slot.slot_id);
   const record=routeCandidates(seed.records,route(w.route_id),slot,w.steps)[0];assert.ok(record,cid);w=assignInstrument(w,slot.slot_id,record);
  }
 }
 return w;
}

test('new optional verification stages never block a conventionally complete plan',()=>{
 for(const rid of ['P03','P09','P10','P15','P25','P33','P35','P38','P40','P41']){
  const w=coverRequired(create(rid));assert.equal(workflowReadiness(w,seed.steps).complete,true,rid);
  assert.ok(w.steps.some(s=>s.extensions.source_extension_id));
 }
});
test('saved plans gain curator stages once while preserving assigned occurrence data and custom dependencies',()=>{
 let w=create('P33');w.steps=w.steps.filter(s=>!s.extensions.source_extension_id);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,seed.records.find(r=>r.category_id===w.steps[0].slots[0].allowed_category_ids[0]));
 w.steps[0].slots[0].instrument.configuration={future:{port:7}};w.steps[0].notes='Retain my notes';
 w=withStepDependencies(w,w.steps[1].step_id,[w.steps[0].step_id]);
 const before=structuredClone(w),fixed=normalize(w);
 assert.equal(fixed.steps.length,w.steps.length+1);assert.deepEqual(fixed.steps[0].slots[0].instrument,before.steps[0].slots[0].instrument);assert.equal(fixed.steps[0].notes,'Retain my notes');
 assert.deepEqual(fixed.steps[1].extensions.prerequisite_step_ids,before.steps[1].extensions.prerequisite_step_ids);
 assert.deepEqual(processDependencyGraph(fixed).errors,[]);assert.deepEqual(normalize(fixed),fixed);
});
test('vitrification prep is inserted before TEM and filters the TEM pool to exact cryogenic models',()=>{
 let w=coverRequired(create('P03'));const prep=w.steps.find(s=>s.extensions.source_extension_id),slot=prep.slots[0];
 w=assignInstrument(w,slot.slot_id,seed.records.find(r=>r.category_id==='M90'));
 assert.equal(workflowReadiness(w,seed.steps).complete,false);
 const temSlot=w.steps.flatMap(s=>s.slots).find(s=>s.allowed_category_ids.includes('M39'));
 const choices=routeCandidates(seed.records,route('P03'),temSlot,w.steps);assert.equal(choices.length,2);assert.ok(choices.every(r=>r.equipment_subtype.split(';').includes('cryo_tem')));
 w=assignInstrument(w,temSlot.slot_id,choices[0]);assert.equal(workflowReadiness(w,seed.steps).complete,true);
 assert.ok(w.steps.findIndex(s=>s.step_id===prep.step_id)<w.steps.findIndex(s=>s.source_step_order==='5'));
});
test('two-photon branch changes downstream requirements and does not claim the original metal formulation',()=>{
 let w=create('P06');const definition=w.steps.find(s=>s.source_step_order==='2'),slot=definition.slots.find(s=>s.allowed_category_ids.includes('M89'));
 w=assignInstrument(w,slot.slot_id,seed.records.find(r=>r.category_id==='M89'));w=coverRequired(w);
 assert.equal(workflowReadiness(w,seed.steps).complete,true);
 for(const order of ['3','4'])assert.ok(w.steps.find(s=>s.source_step_order===order).slots.every(s=>s.extensions.requirement_role==='optional'));
 const result=materialOutcome(emptyMaterialPlan('P06'),materials,w);assert.equal(result.basis,'user_target');assert.match(result.label,/Two-photon/);assert.equal(result.formulation,null);
 const empty=normalize(clearWorkflowEquipment(w));assert.ok(empty.steps.find(s=>s.source_step_order==='3').slots.some(s=>s.extensions.requirement_role==='alternative'));assert.equal(workflowReadiness(empty,seed.steps).complete,false);
});
