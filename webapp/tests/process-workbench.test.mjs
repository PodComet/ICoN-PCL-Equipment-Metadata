import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignInstrument,createWorkflow,expandWorkflowRequirements,fillMatchingInstrumentSlots,moveInstrument,newSlot,newStep,requirementSlots,reuseInstrument,unitId,validateWorkflow,workflowBudget,workflowReadiness,workflowReadinessMessage} from '../app/process-lib.ts';
import {processDependencyGraph,stepDependencies,withStepDependencies,removeWorkflowStep} from '../app/process-dependencies.ts';
import {positionProfile,separateFiber,validatePositionInterface} from '../app/position-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const positions=JSON.parse(readFileSync(new URL('../app/data/positions.json',import.meta.url),'utf8'));
const route=seed.routes.find(r=>r.route_id==='P43');
const tc=seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2');
const req=(branches,extra={})=>({required_branches:branches,optional_category_ids:[],unresolved_required_equipment:false,readiness_review_required:false,notes:'Reviewed planning requirements',...extra});
const source=(requirements,order='1')=>({route_id:'P43',step_order:order,step_label:'Step '+order,equipment_sequence:'Test sequence',equipment_category_ids:'M70;M62',requirements_json:JSON.stringify(requirements)});
const robot=seed.records.find(r=>r.equipment_id==='EXT-M62-OPENTRONS-GRIPPER');

test('one selected model fills matching vacant M slots before and after its source step with one unit price',()=>{
 const route=seed.routes.find(r=>r.route_id==='P19'),record=seed.records.find(r=>r.category_id==='M48');
 let w=createWorkflow(route,seed.steps);const slot=w.steps[2].slots[0];w=assignInstrument(w,slot.slot_id,record);
 const before=JSON.stringify(w),result=fillMatchingInstrumentSlots(w,slot.slot_id),filled=result.workflow.steps.flatMap(s=>s.slots).filter(s=>s.instrument);
 assert.equal(result.filledSlotIds.length,2);assert.equal(result.additionalUnits,0);assert.equal(filled.length,3);
 assert.equal(new Set(filled.map(s=>unitId(s.instrument))).size,1);assert.equal(new Set(filled.map(s=>s.instrument.instance_id)).size,3);
 assert.ok(filled.every(s=>s.instrument.equipment_id===record.equipment_id));assert.equal(workflowBudget(result.workflow.steps).assigned,1);
 assert.equal(JSON.stringify(w),before,'Automatic fill must not mutate the prior draft');
 assert.ok(result.workflow.steps[0].slots.every(s=>s.instrument===null),'Other M classes and unclassified apparatus stay vacant');
 assert.doesNotThrow(()=>validateWorkflow(result.workflow,seed.routes,seed.records));
 assert.equal(fillMatchingInstrumentSlots(result.workflow,slot.slot_id).workflow,result.workflow,'Repeating a completed fill is a no-op');
});

test('automatic fill preserves existing assignments, slot metadata and source-step unit choices',()=>{
 const sources=[source(req([['M70','M70']])),source(req([['M70']]),'2'),source(req([['M70']]),'3')];
 let w=createWorkflow(route,sources);const original=seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN1');
 w=assignInstrument(w,w.steps[1].slots[0].slot_id,original);w.steps[1].slots[0].instrument.configuration={plate:'Existing user choice'};
 w.steps[2].notes='Keep this stage';w.steps[2].slots[0].label='My destination';w.steps[2].slots[0].extensions.future={port:2};
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);const existing=structuredClone(w.steps[1]);
 const result=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id);
 assert.equal(result.filledSlotIds.length,1);assert.equal(result.workflow.steps[0].slots[1].instrument,null,'Separate source-step positions still need their own selection');
 assert.deepEqual(result.workflow.steps[1],existing);assert.equal(result.workflow.steps[2].notes,'Keep this stage');
 assert.equal(result.workflow.steps[2].slots[0].label,'My destination');assert.deepEqual(result.workflow.steps[2].slots[0].extensions.future,{port:2});
 assert.equal(result.workflow.steps[2].slots[0].instrument.equipment_id,tc.equipment_id);
});

test('automatic fill matches the canonical M class, not a shared X alias or unclassified slot',()=>{
 const record={...seed.records.find(r=>r.category_id==='M13'),legacy_category_ids:'X-FILTER'};
 let w=createWorkflow(route,[]);w.steps=[newStep(['M13']),newStep(['M15']),newStep(['X-FILTER']),newStep([]),newStep(['M13','M62'])];
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,record);const result=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id);
 assert.deepEqual(result.filledSlotIds,[w.steps[4].slots[0].slot_id]);assert.ok(result.workflow.steps.slice(1,4).every(s=>s.slots[0].instrument===null));
 assert.throws(()=>fillMatchingInstrumentSlots(createWorkflow(route,[]),'missing'),/assigned instrument/);
});

test('automatic fill allocates distinct units within one stage and reuses those units across later stages',()=>{
 const sources=[source(req([['M70']])),source(req([['M70','M70']]),'2'),source(req([['M70','M70']]),'3')];
 let w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);
 const result=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id),all=result.workflow.steps.flatMap(s=>s.slots).map(s=>s.instrument);
 assert.equal(result.filledSlotIds.length,4);assert.equal(result.additionalUnits,1);assert.equal(new Set(all.map(unitId)).size,2);
 for(const step of result.workflow.steps.slice(1))assert.equal(new Set(step.slots.map(s=>unitId(s.instrument))).size,2);
 const budget=workflowBudget(result.workflow.steps);assert.equal(budget.assigned,2);assert.equal(budget.totals[0].low,20460);
 assert.equal(workflowReadiness(result.workflow,sources).complete,true);assert.doesNotThrow(()=>validateWorkflow(result.workflow,seed.routes,seed.records));
});

test('automatic reuse preserves snapshots while keeping nested stage configuration and future data independent',()=>{
 const sources=[source(req([['M70']])),source(req([['M70']]),'2')];let w=createWorkflow(route,sources);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);const original=w.steps[0].slots[0].instrument;
 original.configuration={plate:{capacity:96}};original.operating_parameters={temperature:{value:95,unit:'C'}};original.operation_sequence=['Configure profile'];original.extensions.future={port:{name:'A'}};
 const result=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id),reused=result.workflow.steps[1].slots[0].instrument;
 assert.deepEqual(reused.price_snapshot,original.price_snapshot);assert.deepEqual(reused.configuration,original.configuration);
 reused.configuration.plate.capacity=384;reused.operating_parameters.temperature.value=60;reused.operation_sequence.push('New stage action');reused.extensions.future.port.name='B';
 assert.equal(original.configuration.plate.capacity,96);assert.equal(original.operating_parameters.temperature.value,95);assert.deepEqual(original.operation_sequence,['Configure profile']);assert.equal(original.extensions.future.port.name,'A');
 const saved=validateWorkflow(result.workflow,seed.routes,seed.records);assert.equal(unitId(saved.steps[1].slots[0].instrument),unitId(saved.steps[0].slots[0].instrument));
 const explicit=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);explicit.steps[1].slots[0].instrument.extensions.future.port.name='C';assert.equal(original.extensions.future.port.name,'A');
});

test('moved and explicitly reused assignments can fill the remaining matching stages without losing the physical unit',()=>{
 const sources=[source(req([['M70']])),source(req([['M70']]),'2'),source(req([['M70']]),'3')];let w=createWorkflow(route,sources);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);const [a,b]=w.steps.map(s=>s.slots[0].slot_id),original=w.steps[0].slots[0].instrument;
 original.configuration={plate:{name:'Original'}};
 const moved=fillMatchingInstrumentSlots(moveInstrument(w,a,b),b);assert.equal(moved.filledSlotIds.length,2);assert.equal(moved.workflow.steps[1].slots[0].instrument.instance_id,original.instance_id);
 const reused=fillMatchingInstrumentSlots(reuseInstrument(w,b,a),b);assert.equal(reused.filledSlotIds.length,1);
 for(const result of [moved,reused]){
  assert.ok(result.workflow.steps.every(s=>unitId(s.slots[0].instrument)===unitId(original)));
  assert.equal(workflowBudget(result.workflow.steps).assigned,1);assert.equal(workflowReadiness(result.workflow,sources).complete,true);
  assert.doesNotThrow(()=>validateWorkflow(result.workflow,seed.routes,seed.records));
 }
});

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

test('equipment completion is separate from review; unresolved apparatus, removed stages and wrong order still block it',()=>{
 const sources=[source(req([['M70']],{unresolved_required_equipment:true,readiness_review_required:true})),source(req([[]]),'2')];
 let w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);
 assert.equal(workflowReadiness(w,sources).unresolved,1,'Filling known categories does not resolve unknown apparatus');
 const unclassified=w.steps[0].slots.find(s=>s.extensions.requirement_role==='unclassified');unclassified.allowed_category_ids=['M62'];w=assignInstrument(w,unclassified.slot_id,robot);
 assert.equal(workflowReadiness(w,sources).review,1);assert.equal(workflowReadiness(w,sources).complete,true);assert.equal(workflowReadiness(w,sources).reviewItems[0].step_id,w.steps[0].step_id);
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


test('P19 with all six filled boxes completes while its configuration review remains advisory',()=>{
 const route=seed.routes.find(r=>r.route_id==='P19'),sources=seed.steps.filter(s=>s.route_id==='P19');
 let w=createWorkflow(route,sources);assert.equal(w.steps.flatMap(s=>s.slots).length,6);
 for(const step of w.steps)for(const slot of step.slots){
  if(!slot.allowed_category_ids.length)slot.allowed_category_ids=['M11'];
  const record=seed.records.find(r=>r.category_id===slot.allowed_category_ids[0]);assert.ok(record);
  w=assignInstrument(w,slot.slot_id,record);
 }
 const status=workflowReadiness(w,sources);
 assert.equal(status.complete,true);assert.equal(status.review,1);assert.match(workflowReadinessMessage(status),/Equipment plan complete/);
 w.steps[1].slots[0].instrument=null;assert.equal(workflowReadiness(w,sources).complete,false);assert.match(workflowReadinessMessage(workflowReadiness(w,sources)),/required equipment branch/);
});

test('hierarchy keeps independent actions as peers and dependent actions as children, with persistent references',()=>{
 const sources=[source(req([['M70']])),source(req([['M70']]),'2'),source(req([['M70']]),'3')];let w=createWorkflow(route,sources);
 const [a,b,c]=w.steps.map(s=>s.step_id);
 assert.deepEqual(processDependencyGraph(w).levels.map(l=>l.map(s=>s.step_id)),[[a],[b],[c]],'Existing linear plans retain source order');
 w=withStepDependencies(w,b,[]);w=withStepDependencies(w,c,[a,b]);
 assert.deepEqual(processDependencyGraph(w).levels.map(l=>l.map(s=>s.step_id)),[[a,b],[c]]);
 assert.deepEqual(stepDependencies(w,w.steps[2]),[a,b]);assert.deepEqual(stepDependencies(w,w.steps[0]),[]);
 const original=JSON.stringify(w);assert.throws(()=>withStepDependencies(w,a,[c]),/cycle/);assert.equal(JSON.stringify(w),original,'Rejected changes do not mutate the draft');
 assert.throws(()=>withStepDependencies(w,c,['missing']),/existing prerequisite/);
 for(const step of w.steps)w=assignInstrument(w,step.slots[0].slot_id,tc);
 const saved=validateWorkflow(w,seed.routes,[tc]);assert.deepEqual(saved.steps[2].extensions.prerequisite_step_ids,[a,b]);assert.equal(workflowReadiness(saved,sources).complete,true);
 const reordered={...w,steps:[w.steps[2],w.steps[1],w.steps[0]]};assert.equal(workflowReadiness(reordered,sources).complete,true,'Dependencies determine execution order in an edited graph');
 const bad=structuredClone(w);bad.steps[0].extensions.prerequisite_step_ids=[c];assert.equal(workflowReadiness(bad,sources).complete,false);assert.throws(()=>validateWorkflow(bad,seed.routes,[tc]),/cycle/);
 const removed=removeWorkflowStep(w,b);assert.deepEqual(stepDependencies(removed,removed.steps.find(s=>s.step_id===c)),[a]);assert.equal(processDependencyGraph(removed).errors.length,0);
});

test('completion rejects a filled instrument that no longer matches its slot classes',()=>{
 const sources=[source(req([['M70']]))];let w=createWorkflow(route,sources);w=assignInstrument(w,w.steps[0].slots[0].slot_id,tc);w.steps[0].slots[0].allowed_category_ids=['M13'];
 const status=workflowReadiness(w,sources);assert.equal(status.complete,false);assert.equal(status.invalidAssignments,1);assert.match(workflowReadinessMessage(status),/do not match/);
});
