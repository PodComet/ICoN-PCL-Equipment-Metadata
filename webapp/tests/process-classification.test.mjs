import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeWorkflowClasses,pendingClassSlots,resolvePendingClass} from '../app/process-classification-lib.ts';
import {assignInstrument,createWorkflow,newSlot,newStep,routeCandidates,slotAccepts,validateWorkflow,workflowReadiness} from '../app/process-lib.ts';
import {materialOutcome} from '../app/process-outcome-lib.ts';
import {emptyMaterialPlan} from '../app/process-materials-lib.ts';
const read=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url)));
const seed=read('catalog'),audit=read('process-class-audit'),materials=read('process-materials');
const create=id=>createWorkflow(seed.routes.find(r=>r.route_id===id),seed.steps);
const normalize=w=>normalizeWorkflowClasses(w,seed.steps,seed.records,seed.categories);
const tc=seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2');

test('the full audit covers every source action and all machine slots have current M classes',()=>{
 const known=new Set(seed.categories.map(c=>c.category_id));let slots=0,actions=[];
 for(const route of seed.routes.filter(r=>r.route_kind==='manufacturing_process')){
  const w=normalize(create(route.route_id));
  for(const step of w.steps){if(!step.slots.length)actions.push(route.route_id+'.'+step.source_step_order);for(const slot of step.slots){if(!['P44','P45','P46','P47'].includes(route.route_id)&&!String(step.extensions.source_extension_id||'').startsWith('UCLA-')&&!slot.allowed_category_ids.some(id=>['M113','M114','M115'].includes(id)))slots++;assert.ok(slot.allowed_category_ids.length);assert.ok(slot.allowed_category_ids.every(id=>/^M\d{2,3}$/.test(id)&&known.has(id)));}}
 }
 assert.equal(slots,audit.summary.classified_equipment_slots);assert.deepEqual(actions.sort(),audit.steps.filter(s=>!s.implementation_status.startsWith('implemented_')||s.implementation_status==='implemented_subtype_gap').map(s=>s.step_id).sort());assert.equal(actions.length,audit.summary.action_steps_without_separate_class);
 assert.ok(audit.proposals.every(p=>known.has(p.proposed_id)&&p.status==='implemented'));
});
test('classless requests cannot accept models or expose the whole process pool',()=>{
 const w=create('P43'),slot=newSlot();w.steps[0].slots.push(slot);
 assert.equal(slotAccepts(slot,tc),false);assert.deepEqual(routeCandidates(seed.records,seed.routes.find(r=>r.route_id==='P43'),slot,w.steps),[]);
 assert.throws(()=>assignInstrument(w,slot.slot_id,tc),/does not match/);assert.throws(()=>validateWorkflow(w,seed.routes,seed.records),/M-class/);
});
test('saved custom unclassified requests retain all metadata in a blocking review queue',()=>{
 const w=create('P43'),custom=newSlot([],'Custom sample transfer');custom.extensions={user_notes:'Retain this apparatus request',future:{port:'A'}};w.steps[0].slots.push(custom);
 const before=JSON.stringify(w),fixed=normalize(w),pending=pendingClassSlots(fixed.steps[0]);
 assert.deepEqual(pending,[custom]);assert.equal(JSON.stringify(w),before);assert.ok(fixed.steps[0].slots.every(s=>s.allowed_category_ids.length));
 const assigned=assignInstrument(fixed,fixed.steps[0].slots[0].slot_id,tc);assert.equal(workflowReadiness(assigned,seed.steps).complete,false);assert.ok(workflowReadiness(assigned,seed.steps).unresolved>0);
 const saved=validateWorkflow(JSON.parse(JSON.stringify(assigned)),seed.routes,seed.records);assert.deepEqual(pendingClassSlots(saved.steps[0]),[custom]);
 assert.deepEqual(materialOutcome(emptyMaterialPlan('P43'),materials,saved).sequence[0].pending_classification,[{slot_id:custom.slot_id,label:custom.label,previous_class_ids:[]}]);
 assert.deepEqual(normalize(fixed),fixed,'Reopening must not duplicate or discard requests');
});
test('classification restores the original slot identity and metadata without choosing an instrument',()=>{
 const w=create('P43'),custom=newSlot([],'My controller');custom.extensions={notes:'Custom settings'};w.steps[0].slots.push(custom);const fixed=normalize(w);
 const next=resolvePendingClass(fixed,fixed.steps[0].step_id,custom.slot_id,'M62',seed.categories),restored=next.steps[0].slots.find(s=>s.slot_id===custom.slot_id);
 assert.deepEqual(restored,{...custom,allowed_category_ids:['M62']});assert.deepEqual(pendingClassSlots(next.steps[0]),[]);assert.deepEqual(pendingClassSlots(fixed.steps[0]),[custom]);
 assert.throws(()=>resolvePendingClass(fixed,fixed.steps[0].step_id,custom.slot_id,'M999',seed.categories),/current M-class/);
});
test('unambiguous legacy X classes migrate, while split legacy classes need a deliberate choice',()=>{
 const w=create('P43');w.steps=[newStep(['X-ROB']),newStep(['X-FILTER'])];
 const fixed=normalize(w);assert.deepEqual(fixed.steps[0].slots[0].allowed_category_ids,['M62']);assert.equal(fixed.steps[1].slots.length,0);assert.equal(pendingClassSlots(fixed.steps[1])[0].allowed_category_ids[0],'X-FILTER');
});
test('future unresolved source requirements are stable across reopening and remain required after classification',()=>{
 const route=seed.routes.find(r=>r.route_id==='P43'),sources=[{route_id:'P43',step_order:'1',step_label:'Unknown apparatus',equipment_sequence:'Unspecified apparatus',equipment_category_ids:'',requirements_json:JSON.stringify({required_branches:[[]],optional_category_ids:[],unresolved_required_equipment:true,readiness_review_required:true,notes:'Needs review'})}];
 const norm=w=>normalizeWorkflowClasses(w,sources,seed.records,seed.categories),fixed=norm(createWorkflow(route,sources));assert.equal(fixed.steps[0].slots.length,0);assert.equal(pendingClassSlots(fixed.steps[0]).length,1);assert.deepEqual(norm(fixed),fixed);
 const pending=pendingClassSlots(fixed.steps[0])[0],classified=resolvePendingClass(fixed,fixed.steps[0].step_id,pending.slot_id,'M70',seed.categories);
 assert.equal(workflowReadiness(classified,sources).complete,false);assert.equal(workflowReadiness(assignInstrument(classified,pending.slot_id,tc),sources).complete,true);
});
