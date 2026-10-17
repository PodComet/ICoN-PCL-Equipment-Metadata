import test from 'node:test';
import assert from 'node:assert/strict';
import {assignInstrument,fillMatchingInstrumentSlots,instrumentFor,newSlot,newStep,requirementSlots,routeCandidates,slotAccepts} from '../app/process-lib.ts';

const wafer={equipment_id:'wafer',model_name:'Wafer solvent bench',category_id:'M85',equipment_subtype:'wafer_wet_processing'};
const batch={equipment_id:'batch',model_name:'Batch exchange station',category_id:'M85',equipment_subtype:'batch_solvent_exchange'};
const req={required_branches:[['M85']],optional_category_ids:[],unresolved_required_equipment:false,readiness_review_required:true,notes:'Review chemistry',allowed_subtypes_by_category:{M85:['batch_solvent_exchange']}};
test('operation-specific slots reject the wrong subtype even within the same M-class',()=>{
 const slot=requirementSlots(req)[0];
 assert.equal(slotAccepts(slot,wafer),false);assert.equal(slotAccepts(slot,batch),true);
 assert.equal(slotAccepts(newSlot(['M85']),wafer),true,'User-added broad class slots retain their existing behavior');
 const workflow={route_id:'P31',steps:[{...newStep(),slots:[slot]}]};
 assert.throws(()=>assignInstrument(workflow,slot.slot_id,wafer),/does not match/);
 assert.deepEqual(routeCandidates([wafer,batch],{equipment_category_ids:'M85'},null,workflow.steps),[batch]);
 assert.deepEqual(routeCandidates([wafer,batch],{equipment_category_ids:'M85'},slot,workflow.steps),[batch]);
});
test('automatic same-class filling respects operation-specific subtype constraints',()=>{
 const first={...newStep(),slots:[{...newSlot(['M85']),instrument:instrumentFor(wafer)}]},second={...newStep(),slots:requirementSlots(req)};
 const result=fillMatchingInstrumentSlots({steps:[first,second]},first.slots[0].slot_id);
 assert.deepEqual(result.filledSlotIds,[]);assert.equal(result.workflow.steps[1].slots[0].instrument,null);
});
