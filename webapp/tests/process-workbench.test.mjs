import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignInstrument,createWorkflow,expandWorkflowRequirements,newSlot,newStep,requirementSlots,reuseInstrument,unitId,validateWorkflow,workflowBudget,workflowReadiness} from '../app/process-lib.ts';
import {positionProfile,separateFiber,validatePositionInterface} from '../app/position-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const positions=JSON.parse(readFileSync(new URL('../app/data/positions.json',import.meta.url),'utf8'));
const route=seed.routes.find(r=>r.route_id==='P43');
const tc=seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2');
const req=(branches,extra={})=>({required_branches:branches,optional_category_ids:[],unresolved_required_equipment:false,readiness_review_required:false,notes:'Reviewed planning requirements',...extra});
const source=(requirements,order='1')=>({route_id:'P43',step_order:order,step_label:'Step '+order,equipment_sequence:'Test sequence',equipment_category_ids:'M70;M62',requirements_json:JSON.stringify(requirements)});
const robot=seed.records.find(r=>r.equipment_id==='EXT-M62-OPENTRONS-GRIPPER');

test('required category boxes cover AND, OR, optional groups and simultaneous-unit multiplicity',()=>{
 let sources=[source(req([['M70','M62']]))],w=createWorkflow(route,sources);
 assert.deepEqual(w.steps[0].slots.map(s=>s.allowed_category_ids),[['M70'],['M62']]);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);assert.equal(workflowReadiness(w,sources).complete,false);
 w=assignInstrument(w,w.steps[0].slots[1].slot_id,robot);assert.equal(workflowReadiness(w,sources).complete,true);
 sources=[source(req([['M70'],['M62']]))];w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);assert.equal(workflowReadiness(w,sources).complete,true);
 sources=[source(req([['M70']],{optional_category_ids:['M62','M13'],optional_branches:[['M62','M13']]}))];w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);assert.equal(workflowReadiness(w,sources).complete,true);
 w=assignInstrument(w,w.steps[0].slots[1].slot_id,robot);assert.equal(workflowReadiness(w,sources).complete,false,'A partly selected optional branch needs its full equipment');
 const pumps=seed.steps.find(s=>s.route_id==='P27'&&s.step_order==='2');assert.equal(createWorkflow(seed.routes.find(r=>r.route_id==='P27'),[pumps]).steps[0].slots.filter(s=>s.allowed_category_ids.includes('M07')).length,2);
});

test('unclassified required apparatus, review dependencies, removed stages and wrong order prevent completion',()=>{
 const sources=[source(req([['M70']],{unresolved_required_equipment:true,readiness_review_required:true})),source(req([[]]),'2')];
 let w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);
 assert.equal(workflowReadiness(w,sources).unresolved,1,'Filling known categories does not resolve unknown apparatus');
 const unclassified=w.steps[0].slots.find(s=>s.extensions.requirement_role==='unclassified');unclassified.allowed_category_ids=['M62'];w=assignInstrument(w,unclassified.slot_id,robot);
 assert.equal(workflowReadiness(w,sources).review,1);assert.equal(workflowReadiness(w,sources).complete,false);
 w.steps[0].extensions.requirements_reviewed=true;assert.equal(workflowReadiness(w,sources).complete,true,'Manual handling does not require invented hardware');
 assert.equal(workflowReadiness({...w,steps:[w.steps[1],w.steps[0]]},sources).wrongOrder,true);
 assert.equal(workflowReadiness({...w,steps:w.steps.slice(0,1)},sources).missingSteps,1);
});

test('reuse preserves one purchase cost and distinct step configurations; it cannot replace two simultaneous units',()=>{
 const sources=[source(req([['M70']])) ,source(req([['M70']]),'2')];let w=createWorkflow(route,sources);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);
 const [a,b]=w.steps.map(s=>s.slots[0].instrument);assert.notEqual(a.instance_id,b.instance_id);assert.equal(unitId(a),unitId(b));assert.equal(workflowBudget(w.steps).assigned,1);assert.equal(workflowBudget(w.steps).totals[0].low,10230);
 assert.equal(workflowReadiness(w,sources).complete,true);b.configuration={stage_specific:'retained'};assert.deepEqual(a.configuration,{});
 assert.doesNotThrow(()=>validateWorkflow(w,seed.routes,[tc]));
 b.quantity=2;assert.throws(()=>validateWorkflow(w,seed.routes,[tc]),/same model and quantity/);b.quantity=1;
 const same=[source(req([['M70','M70']]))];let concurrent=createWorkflow(route,same);concurrent=assignInstrument(concurrent,concurrent.steps[0].slots[0].slot_id,tc);concurrent=reuseInstrument(concurrent,concurrent.steps[0].slots[1].slot_id,concurrent.steps[0].slots[0].slot_id);assert.equal(workflowReadiness(concurrent,same).complete,false);
});

test('thermocycler generations keep photo, manual, price and control evidence model-bound',()=>{
 const old=seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN1');
 assert.equal(tc.category_id,'M70');assert.equal(tc.manufacturer_price_kind,'starting_price');assert.equal(tc.msrp_value,'');assert.ok(tc.image_url&&tc.manual_url);
 assert.equal(tc.related_material_ids,'');assert.equal(old.image_url,'');assert.equal(old.manual_url,'');assert.equal(old.manufacturer_price_value,'');
 const profile=positionProfile(tc,positions);assert.equal(profile.interface.fibers.length,2);assert.equal(positionProfile(old,positions).interface.fibers.length,0);
 assert.equal(positionProfile({...tc,model_name:'Different model'},positions).status,'roadmap');
 assert.equal(positionProfile({...tc,manufacturer:'Other'},positions).interface.fibers.length,0);
});

test('Position Lists resolve evidence IDs and split fibers without mutating the original interface',()=>{
 const profile=positionProfile(tc,positions).interface;
 assert.deepEqual(validatePositionInterface(profile,positions.evidence),profile);
 const fiber=separateFiber(profile,'lid_open');assert.equal(fiber.fibers.length,1);assert.equal(fiber.schema,'poly-fibers/v2');assert.equal(profile.fibers.length,2);
 const bad=structuredClone(profile);bad.fibers[0].directions[0].evidence_ids=['UNRESOLVED-SAMPLE-ID'];assert.throws(()=>validatePositionInterface(bad,positions.evidence),/direction/);
 const duplicate=structuredClone(profile);duplicate.fibers.push(duplicate.fibers[0]);assert.throws(()=>validatePositionInterface(duplicate,positions.evidence),/unique name/);
 assert.ok(positions.evidence.flatMap(e=>e.entries).some(e=>e.classification==='model_assumption'&&e.verification.status==='draft'));
 assert.ok(positions.evidence.flatMap(e=>e.entries).some(e=>e.claim.includes('passive cooling')));
});

test('older saved plans expand category choices without losing assigned machines or custom metadata',()=>{
 const sources=[source(req([['M70','M62']]))],old=createWorkflow(route,[]);old.steps[0].source_step_order='1';old.steps[0].notes='My notes';old.steps[0].slots=[newSlot(['M70','M62'])];
 const assigned=assignInstrument(old,old.steps[0].slots[0].slot_id,tc);assigned.steps[0].slots[0].instrument.configuration={plate:'My reviewed configuration'};
 const expanded=expandWorkflowRequirements(assigned,sources);
 assert.equal(expanded.steps[0].slots.length,2);assert.equal(expanded.steps[0].notes,'My notes');
 assert.deepEqual(expanded.steps[0].slots[0].instrument,assigned.steps[0].slots[0].instrument);
 assert.deepEqual(expanded.steps[0].slots.map(s=>s.allowed_category_ids),[['M70'],['M62']]);
 assert.deepEqual(expandWorkflowRequirements(expanded,sources),expanded,'Repeated opening does not create new slot IDs');
 assert.equal(assigned.steps[0].slots.length,1,'Saved input remains unchanged');
});
