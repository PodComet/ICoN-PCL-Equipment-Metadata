import {positionGroups,positionProfile,type PositionLibrary} from './position-lib.ts';
import type {Equipment} from './catalog-lib.ts';

export const SEQUENCE_KEY='ontology_control_sequence';
export const SEQUENCE_FIELD='control_sequence_json';
export const SEQUENCE_TEMPLATE_LIMIT=64000;
export type ControlAction={id:string;position:string;fiber_id:string;direction:string;source:'profile'|'user_defined';notes:string};
export type ControlSequence={schema:'instrument-control-sequence/v1';steps:ControlAction[];order_basis?:'legacy_selection_requires_review'|'user_ordered'};
export type SequenceContext={sequence:ControlSequence;label:string;saved_evidence_id?:string;saved_revision?:number;onChange:(sequence:ControlSequence)=>void};
export const blankSequence=():ControlSequence=>({schema:'instrument-control-sequence/v1',steps:[],order_basis:'user_ordered'});
export const newControlAction=():ControlAction=>({id:crypto.randomUUID(),position:'',fiber_id:'',direction:'',source:'profile',notes:''});
export function validateControlSequence(value:unknown):ControlSequence{
 const s=value as ControlSequence;
 if(!s||s.schema!=='instrument-control-sequence/v1'||!Array.isArray(s.steps)||s.steps.length>100||s.order_basis!==undefined&&!['user_ordered','legacy_selection_requires_review'].includes(s.order_basis))throw new Error('Use an ordered instrument sequence with at most 100 actions.');
 const ids=new Set<string>();
 for(const action of s.steps){
  if(!action||typeof action!=='object'||typeof action.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(action.id)||ids.has(action.id)||!['profile','user_defined'].includes(action.source))throw new Error('Sequence actions need unique IDs and a recorded source.');
  ids.add(action.id);
  for(const field of ['position','fiber_id','direction','notes'] as const)if(typeof action[field]!=='string'||action[field].length>(field==='notes'?1000:200))throw new Error('Invalid sequence '+field+'.');
 }
 return {schema:s.schema,order_basis:s.order_basis||'user_ordered',steps:s.steps.map(a=>({id:a.id,position:a.position,fiber_id:a.fiber_id,direction:a.direction,source:a.source,notes:a.notes}))};
}
export function readControlSequence(raw:unknown,legacy?:unknown):ControlSequence{
 if(raw!==undefined)return validateControlSequence(raw);
 const old=legacy as {schema?:string;position?:string;fiber_id?:string;directions?:string[]}|undefined;
 if(old?.schema==='process-instrument-controls/v1'&&typeof old.position==='string'&&typeof old.fiber_id==='string'&&Array.isArray(old.directions)&&old.directions.every(d=>typeof d==='string')&&(old.position||old.fiber_id||old.directions.length))return validateControlSequence({schema:'instrument-control-sequence/v1',order_basis:'legacy_selection_requires_review',steps:(old.directions.length?old.directions:['']).map((direction,index)=>({id:'legacy-'+index,position:old.position,fiber_id:old.fiber_id,direction,source:'profile',notes:''}))});
 return blankSequence();
}
export function sequenceRows(record:Equipment,sequence:ControlSequence,library:PositionLibrary){
 const groups=positionGroups(positionProfile(record,library).interface);
 return sequence.steps.map((action,index)=>{
  const position=groups.find(p=>p.position===action.position),fiber=position?.fibers.find(f=>f.id===action.fiber_id),direction=fiber?.fiber.directions.find(d=>d.direction===action.direction);
  const complete=!!(action.position.trim()&&action.fiber_id.trim()&&action.direction.trim());
  const stale=action.source==='profile'&&!!(action.position||action.fiber_id||action.direction)&&(!position||!!action.fiber_id&&!fiber||!!action.direction&&!direction);
  return {action,number:index+1,position,fiber,direction:action.source==='profile'?direction:undefined,complete,stale,status:action.source==='user_defined'?'user_defined_needs_review':stale?'review_required':complete?'profile_selection':'incomplete'};
 });
}
const identity=(s:string)=>(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function sequenceTemplate(record:Equipment):ControlSequence{
 if(!record[SEQUENCE_FIELD])return blankSequence();
 try{const t=JSON.parse(record[SEQUENCE_FIELD]);if(t.schema!=='instrument-sequence-template/v1'||t.subject?.equipment_id!==record.equipment_id||identity(t.subject?.manufacturer)!==identity(record.manufacturer)||identity(t.subject?.model_name)!==identity(record.model_name))return blankSequence();return validateControlSequence(t.sequence);}catch{return blankSequence();}
}
export function sequenceTemplateJSON(record:Equipment,sequence:ControlSequence){return JSON.stringify({schema:'instrument-sequence-template/v1',subject:{equipment_id:record.equipment_id,manufacturer:record.manufacturer,model_name:record.model_name},sequence:validateControlSequence(sequence)});}
export function validateSequenceTemplate(record:Equipment){
 if(!record[SEQUENCE_FIELD])return;
 if(record[SEQUENCE_FIELD].length>SEQUENCE_TEMPLATE_LIMIT)throw new Error('Instrument sequence template exceeds 64,000 characters including evidence references.');
 let t;try{t=JSON.parse(record[SEQUENCE_FIELD]);}catch{throw new Error('Instrument sequence must be valid JSON.');}
 if(t.schema!=='instrument-sequence-template/v1'||t.subject?.equipment_id!==record.equipment_id||identity(t.subject?.manufacturer)!==identity(record.manufacturer)||identity(t.subject?.model_name)!==identity(record.model_name))throw new Error('Instrument sequence must match this exact manufacturer, model and equipment ID.');
 if(JSON.stringify(t.sequence).length>32000)throw new Error('Instrument sequence actions exceed 32,000 characters.');
 validateControlSequence(t.sequence);
}
export function moveControlAction(sequence:ControlSequence,id:string,delta:number):ControlSequence{
 const index=sequence.steps.findIndex(a=>a.id===id),target=index+delta;if(index<0||target<0||target>=sequence.steps.length)return sequence;
 const steps=[...sequence.steps];[steps[index],steps[target]]=[steps[target],steps[index]];return {...sequence,steps,order_basis:'user_ordered'};
}
