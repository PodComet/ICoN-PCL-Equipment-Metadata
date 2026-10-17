import {SEQUENCE_KEY,readControlSequence,validateControlSequence,sequenceRows,type ControlSequence} from './control-sequence-lib.ts';
import {positionProfile,positionGroups,type PositionLibrary} from './position-lib.ts';
import type {ProcessWorkflow} from './process-lib.ts';
export type ControlSelection={schema:'process-instrument-controls/v1';position:string;fiber_id:string;directions:string[]};
export const CONTROL_KEY='ontology_control_selection';
export const blankControl=():ControlSelection=>({schema:'process-instrument-controls/v1',position:'',fiber_id:'',directions:[]});
export function controlRows(workflow:ProcessWorkflow,library:PositionLibrary){
 return workflow.steps.flatMap((step,index)=>step.slots.flatMap(slot=>{
  if(!slot.instrument)return [];
  const instrument=slot.instrument,profile=positionProfile(instrument.equipment_snapshot,library),groups=positionGroups(profile.interface);
  const raw=instrument.configuration[CONTROL_KEY] as unknown as ControlSelection|undefined;
  const selection=raw?.schema==='process-instrument-controls/v1'&&typeof raw.position==='string'&&typeof raw.fiber_id==='string'&&Array.isArray(raw.directions)&&raw.directions.every(d=>typeof d==='string')?raw:blankControl();
  const position=groups.find(p=>p.position===selection.position),fiber=position?.fibers.find(f=>f.id===selection.fiber_id);
  const selectedDirections=fiber?.fiber.directions.filter(d=>selection.directions.includes(d.direction))||[];
  const legacyStale=!!(selection.position||selection.fiber_id||selection.directions.length)&&(!position||!!selection.fiber_id&&!fiber||selectedDirections.length!==selection.directions.length);
  const sequence=readControlSequence(instrument.configuration[SEQUENCE_KEY],instrument.configuration[CONTROL_KEY]),actions=sequenceRows(instrument.equipment_snapshot,sequence,library),stale=instrument.configuration[SEQUENCE_KEY]!==undefined?actions.some(a=>a.stale):legacyStale;
  return [{sequence,actions,occurrence_id:step.step_id+'/'+slot.slot_id,step_id:step.step_id,slot_id:slot.slot_id,step_number:index+1,step_label:step.label,instrument,profile,groups,selection,position,fiber,selectedDirections,stale,
   effects:selectedDirections.map(d=>({direction:d.direction,summary:d.effect_summary||'',evidence_ids:d.effect_evidence_ids||[],status:d.effect_summary?'declared_effect':'not_documented'}))}];
 }));
}
export function chooseControl(workflow:ProcessWorkflow,slotId:string,next:ControlSelection,library:PositionLibrary):ProcessWorkflow{
 const row=controlRows(workflow,library).find(r=>r.slot_id===slotId);if(!row)throw new Error('Choose an assigned instrument occurrence.');
 const group=row.groups.find(g=>g.position===next.position),fiber=group?.fibers.find(f=>f.id===next.fiber_id);
 if(next.schema!=='process-instrument-controls/v1'||next.position&&!group||next.fiber_id&&!fiber||!Array.isArray(next.directions)||new Set(next.directions).size!==next.directions.length||next.directions.some(d=>!fiber?.fiber.directions.some(x=>x.direction===d)))throw new Error('Choose controls from this exact model and position.');
 return {...workflow,steps:workflow.steps.map(step=>({...step,slots:step.slots.map(slot=>slot.slot_id!==slotId?slot:{...slot,instrument:{...slot.instrument!,configuration:{...slot.instrument!.configuration,[SEQUENCE_KEY]:readControlSequence(undefined,next),[CONTROL_KEY]:{...next,directions:[...next.directions]}}}})}))};
}
export function chooseSequence(workflow:ProcessWorkflow,slotId:string,next:ControlSequence):ProcessWorkflow{
 const sequence=validateControlSequence(next);
 if(!workflow.steps.some(step=>step.slots.some(slot=>slot.slot_id===slotId&&slot.instrument)))throw new Error('Choose an assigned instrument occurrence.');
 return {...workflow,steps:workflow.steps.map(step=>({...step,slots:step.slots.map(slot=>slot.slot_id!==slotId?slot:{...slot,instrument:{...slot.instrument!,configuration:{...slot.instrument!.configuration,[SEQUENCE_KEY]:sequence}}})}))};
}
export function controlOutput(workflow:ProcessWorkflow,library:PositionLibrary){
 return controlRows(workflow,library).map(r=>({occurrence_id:r.occurrence_id,step_number:r.step_number,step_label:r.step_label,slot_id:r.slot_id,equipment_id:r.instrument.equipment_id,instance_id:r.instrument.instance_id,category_id:r.instrument.category_id,model_name:r.instrument.equipment_snapshot.model_name,selection:r.selection,sequence:r.sequence,selection_status:r.stale?'review_required':r.sequence.steps.length?'selected':'not_selected',profile_status:r.profile.status,actions:r.actions.map(a=>({...a.action,number:a.number,status:a.status,effect_summary:a.direction?.effect_summary||'',evidence:library.evidence.flatMap(group=>group.entries).filter(entry=>[...(a.direction?.evidence_ids||[]),...(a.direction?.effect_evidence_ids||[])].includes(entry.id))})),effects:r.actions.filter(a=>a.direction).map(a=>({action_id:a.action.id,number:a.number,direction:a.action.direction,summary:a.direction!.effect_summary||'',evidence_ids:a.direction!.effect_evidence_ids||[],status:a.direction!.effect_summary?'declared_effect':'not_documented',evidence:library.evidence.flatMap(group=>group.entries).filter(entry=>(a.direction!.effect_evidence_ids||[]).includes(entry.id))}))}));
}
