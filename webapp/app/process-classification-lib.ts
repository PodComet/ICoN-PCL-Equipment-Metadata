import {expandWorkflowRequirements,splitIds,type ProcessWorkflow,type ProcessStep,type ProcessSlot,type JsonValue} from './process-lib.ts';
import type {Equipment} from './catalog-lib.ts';
export const PENDING_CLASSES='unclassified_equipment_slots';
export function pendingClassSlots(step:ProcessStep):ProcessSlot[]{
 const value=step.extensions[PENDING_CLASSES];
 return Array.isArray(value)?value.filter(v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.slot_id==='string'&&typeof v.label==='string'&&Array.isArray(v.allowed_category_ids)&&v.instrument===null&&!!v.extensions&&typeof v.extensions==='object'&&!Array.isArray(v.extensions)) as unknown as ProcessSlot[]:[];
}
/** Capability corrections follow the exact current model; configuration and prices stay with the saved occurrence. */
function refreshSlotCapability(slot:ProcessSlot,records:Equipment[]):ProcessSlot{
 const i=slot.instrument;if(!i||slot.extensions.allowed_equipment_subtypes===undefined)return slot;
 const identity=(s:string)=>(s||'').normalize('NFKC').trim().toLowerCase();
 const current=records.find(r=>r.equipment_id===i.equipment_id&&identity(r.manufacturer)===identity(i.equipment_snapshot.manufacturer)&&identity(r.model_name)===identity(i.equipment_snapshot.model_name));
 if(!current||(current.equipment_subtype||'')===(i.equipment_snapshot.equipment_subtype||''))return slot;
 return {...slot,instrument:{...i,equipment_snapshot:{...i.equipment_snapshot,equipment_subtype:current.equipment_subtype||''},extensions:{...i.extensions,capability_classification_refresh:{previous_subtype:i.equipment_snapshot.equipment_subtype||'',current_subtype:current.equipment_subtype||'',basis:'Exact current ontology model classification; saved operation configuration and price retained.'}}}};
}
/** Unknown saved requests retain their IDs and metadata outside the machine-slot grid. */
export function normalizeWorkflowClasses(workflow:ProcessWorkflow,sources:Record<string,string>[],records:Equipment[],categories:Record<string,string>[]):ProcessWorkflow{
 const expanded=expandWorkflowRequirements(workflow,sources),known=new Set(categories.map(c=>c.category_id).filter(id=>/^M\d{2,3}$/.test(id)));
 return {...expanded,steps:expanded.steps.map(step=>{
  const pending=new Map(pendingClassSlots(step).map(s=>[s.slot_id,structuredClone(s)])),slots:ProcessSlot[]=[];
  for(const saved of step.slots){
   const original=refreshSlotCapability(saved,records);
   if(!original.instrument&&!original.allowed_category_ids.length&&original.label==='Unclassified required apparatus'&&Object.keys(original.extensions).length===1&&original.extensions.requirement_role==='unclassified'&&[...pending.values()].some(p=>p.extensions.requirement_role==='unclassified'))continue;
   const resolved=[...new Set(original.allowed_category_ids.flatMap(id=>{
    if(known.has(id))return [id];
    const targets=[...new Set(records.filter(r=>splitIds(r.legacy_category_ids).includes(id)).map(r=>r.category_id))];
    return targets.length===1&&known.has(targets[0])?targets:[];
   }))];
   const assigned=original.instrument?.category_id;
   if(assigned&&known.has(assigned)&&!resolved.includes(assigned))resolved.push(assigned);
   if(resolved.length){slots.push({...original,allowed_category_ids:resolved,extensions:{...original.extensions,...(JSON.stringify(resolved)!==JSON.stringify(original.allowed_category_ids)?{previous_class_ids:original.allowed_category_ids}:{})}});continue;}
   if(original.instrument){slots.push(original);continue;}
   pending.set(original.slot_id,structuredClone(original));
  }
  const extensions={...step.extensions};
  if(pending.size)extensions[PENDING_CLASSES]=[...pending.values()] as unknown as JsonValue;else delete extensions[PENDING_CLASSES];
  return {...step,slots,extensions};
 })};
}
export function resolvePendingClass(workflow:ProcessWorkflow,stepId:string,slotId:string,categoryId:string,categories:Record<string,string>[]):ProcessWorkflow{
 if(!/^M\d{2,3}$/.test(categoryId)||!categories.some(c=>c.category_id===categoryId))throw new Error('Choose a current M-class.');
 const step=workflow.steps.find(s=>s.step_id===stepId),pending=step&&pendingClassSlots(step),slot=pending?.find(s=>s.slot_id===slotId);
 if(!step||!slot)throw new Error('This saved slot request is no longer pending.');
 const extensions={...slot.extensions};if(extensions.requirement_role==='unclassified'&&!(step.extensions.requirements as {unresolved_required_equipment?:boolean}|undefined)?.unresolved_required_equipment)delete extensions.requirement_role;
 const restored={...slot,allowed_category_ids:[categoryId],extensions};
 return {...workflow,steps:workflow.steps.map(s=>s.step_id!==stepId?s:{...s,slots:[...s.slots,restored],extensions:{...s.extensions,[PENDING_CLASSES]:pending!.filter(p=>p.slot_id!==slotId) as unknown as JsonValue}})};
}
