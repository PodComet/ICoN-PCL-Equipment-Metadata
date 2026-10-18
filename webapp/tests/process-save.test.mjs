import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignInstrument,createWorkflow,fillMatchingInstrumentSlots,newStep,unitId,updateInstrumentAssignment,validateWorkflow,workflowBudget} from '../app/process-lib.ts';
const catalog=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const model=catalog.records.find(r=>r.equipment_id==='M13-01');
function reusedWorkflow(){
 let w={...createWorkflow(catalog.routes.find(r=>r.route_id==='P03'),catalog.steps),steps:[newStep(['M13']),newStep(['M13']),newStep(['M13'])]};
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);
 w=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id).workflow;
 const independent=newStep(['M13']);w={...w,steps:[...w.steps,independent]};
 return assignInstrument(w,independent.slots[0].slot_id,model);
}
test('changing quantity on a reused occurrence remains saveable and updates that physical unit only',()=>{
 const original=reusedWorkflow(),target=original.steps[1].slots[0];
 const broken=structuredClone(original);broken.steps[1].slots[0].instrument.quantity=2;
 assert.throws(()=>validateWorkflow(broken,catalog.routes,catalog.records),/same model and quantity/);
 const next=updateInstrumentAssignment(original,target.slot_id,{...target.instrument,quantity:2,configuration:{temperature:{value:25,unit:'Cel'}}});
 assert.deepEqual(next.steps.map(s=>s.slots[0].instrument.quantity),[2,2,2,1]);
 assert.equal(unitId(next.steps[0].slots[0].instrument),unitId(next.steps[2].slots[0].instrument));
 assert.notEqual(unitId(next.steps[0].slots[0].instrument),unitId(next.steps[3].slots[0].instrument));
 assert.deepEqual(next.steps[0].slots[0].instrument.configuration,{});
 assert.deepEqual(next.steps[1].slots[0].instrument.configuration,{temperature:{value:25,unit:'Cel'}});
 assert.equal(workflowBudget(next.steps).assigned,3);
 assert.doesNotThrow(()=>validateWorkflow(next,catalog.routes,catalog.records));
 assert.deepEqual(original.steps.map(s=>s.slots[0].instrument.quantity),[1,1,1,1]);
});
test('per-occurrence configurations stay independent when the shared quantity is unchanged',()=>{
 const w=reusedWorkflow(),target=w.steps[2].slots[0];
 const next=updateInstrumentAssignment(w,target.slot_id,{...target.instrument,operation_sequence:['Load sample','Run selected method'],signals:{ready:true}});
 assert.deepEqual(next.steps.map(s=>s.slots[0].instrument.quantity),[1,1,1,1]);
 assert.deepEqual(next.steps[0].slots[0].instrument.operation_sequence,[]);
 assert.deepEqual(next.steps[2].slots[0].instrument.operation_sequence,['Load sample','Run selected method']);
 assert.doesNotThrow(()=>validateWorkflow(next,catalog.routes,catalog.records));
});
test('assignment edits cannot silently replace instrument identity or physical-unit membership',()=>{
 const w=reusedWorkflow(),slot=w.steps[1].slots[0];
 assert.throws(()=>updateInstrumentAssignment(w,'missing',slot.instrument),/occupied/);
 assert.throws(()=>updateInstrumentAssignment(w,slot.slot_id,{...slot.instrument,equipment_id:'M13-02'}),/identity/);
 assert.throws(()=>updateInstrumentAssignment(w,slot.slot_id,{...slot.instrument,extensions:{physical_unit_id:'forged'}}),/identity/);
});
