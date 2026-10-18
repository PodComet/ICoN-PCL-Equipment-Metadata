import {readControlSequence,sequenceRows,sequenceTemplate,sequenceTemplateJSON,SEQUENCE_KEY,type ControlSequence} from './control-sequence-lib.ts';
import {positionProfile,type PositionLibrary} from './position-lib.ts';
import type {Equipment} from './catalog-lib.ts';
import type {ProcessWorkflow,ProcessInstrument,JsonValue} from './process-lib.ts';
import {sealEvidence,evidenceDigest,type EvidenceRecord,type EvidenceLink} from './evidence-lib.ts';

export const CONTROL_EVIDENCE_KEY='saved_control_evidence';
export const COMBINATION_EVIDENCE_KEY='control_evidence_snapshot';
export type SavedSequenceRef={evidence_id:string;revision:number;action_evidence_ids:{action_id:string;evidence_id:string}[]};
export type SavedCombinationRef={schema:'saved-control-evidence/v1';evidence_id:string;revision:number;recorded_at:string;sequences:{slot_id:string;evidence_id:string}[]};
const fresh=(prefix:string)=>prefix+'-'+crypto.randomUUID();
const unique=(values:string[])=>[...new Set(values)];
const scope='User-saved planning declaration. Preserves selected order and context; does not establish valid transitions, hardware execution or measured product effects.';
const related=(record_type:string,record_id:string,label=''):EvidenceLink=>({record_type,record_id,label});
function base(kind:EvidenceRecord['record_kind'],id:string,title:string,now:string,links:EvidenceLink[]):EvidenceRecord{return {schema:'iconpcl-evidence-record/v1',evidence_id:id,record_kind:kind,classification:'user_planned',title,claim:title,scope,recorded_at:now,sources:[],related_records:links,source_evidence_ids:[],supersedes_id:'',context:{}};}
export function savedSequenceRef(instrument:ProcessInstrument):SavedSequenceRef|undefined{return instrument.extensions[CONTROL_EVIDENCE_KEY] as unknown as SavedSequenceRef|undefined;}
export function savedCombinationRef(workflow:ProcessWorkflow):SavedCombinationRef|undefined{return workflow.extensions[COMBINATION_EVIDENCE_KEY] as unknown as SavedCombinationRef|undefined;}
export function templateEvidenceRef(record:Equipment):SavedSequenceRef|undefined{try{return JSON.parse(record.control_sequence_json||'null')?.saved_evidence;}catch{return undefined;}}
type SaveContext={revision:number;recorded_at:string;workflow?:{workflow_id:string;route_id:string;route_name:string;step_id:string;step_label:string;step_number:number;slot_id:string;instance_id:string};settings?:Record<string,unknown>;supersedes?:SavedSequenceRef};

export async function sequenceEvidence(record:Equipment,sequence:ControlSequence,library:PositionLibrary,context:SaveContext){
 const id=fresh('SEQ-EV'),profile=positionProfile(record,library),entries=library.evidence.flatMap(g=>g.entries),rows=sequenceRows(record,sequence,library),records:EvidenceRecord[]=[];
 const links=[related('equipment',record.equipment_id,record.manufacturer+' '+record.model_name),related('equipment_class',record.category_id,record.category_name)];
 if(context.workflow)links.push(related('workflow',context.workflow.workflow_id),related('process',context.workflow.route_id,context.workflow.route_name),related('step',context.workflow.step_id,context.workflow.step_label),related('instrument_occurrence',context.workflow.slot_id,context.workflow.instance_id));
 const actions=rows.map(row=>{
  const sourced=row.action.source==='profile';
  const evidence_ids=sourced?unique([...profile.interface.evidence_ids,...(row.fiber?.fiber.evidence_ids||[]),...(row.direction?.evidence_ids||[]),...(row.direction?.effect_evidence_ids||[])]):[];
  return {evidence_id:fresh('ACT-EV'),ordinal:row.number,action:structuredClone(row.action),status:row.status,position_description:sourced?row.fiber?.fiber.position_description||'':'',fiber_label:sourced?row.fiber?.label||'':'',fiber_description:sourced?row.fiber?.fiber.description||'':'',direction_description:row.direction?.description||'',effect_summary:row.direction?.effect_summary||'',source_evidence_ids:evidence_ids};
 });
 for(const a of actions){const entry=base('control_action',a.evidence_id,'Action '+a.ordinal+': '+[a.action.position,a.action.fiber_id,a.action.direction].map(x=>x||'(unspecified)').join(' → '),context.recorded_at,[...links,related('sequence',id)]);entry.context={...a,sequence_evidence_id:id,revision:context.revision};entry.source_evidence_ids=a.source_evidence_ids;entry.supersedes_id=context.supersedes?.action_evidence_ids.find(old=>old.action_id===a.action.id)?.evidence_id||'';records.push(await sealEvidence(entry));}
 const sourceIds=unique(actions.flatMap(a=>a.source_evidence_ids)),sourceSnapshot=entries.filter(e=>sourceIds.includes(e.id));
 const entry=base('instrument_sequence',id,record.manufacturer+' '+record.model_name+' · '+actions.length+' ordered actions',context.recorded_at,links);
 entry.source_evidence_ids=sourceIds;entry.sources=sourceSnapshot.map(e=>({title:e.source.title,url:e.source.url||'',locator:e.source.section,checked_date:e.source.accessed}));entry.supersedes_id=context.supersedes?.evidence_id||'';
 entry.context={subject:{equipment_id:record.equipment_id,manufacturer:record.manufacturer,model_name:record.model_name,category_id:record.category_id},revision:context.revision,workflow:context.workflow||null,settings:context.settings||{},sequence:structuredClone(sequence),actions,profile:{name:profile.interface.name,description:profile.interface.description,status:profile.status,scope:'Selected interface descriptions are snapshotted with each action.'},source_evidence_snapshot:structuredClone(sourceSnapshot),unresolved_source_evidence_ids:sourceIds.filter(id=>!sourceSnapshot.some(e=>e.id===id)),validation_status:'planning_only'};
 records.push(await sealEvidence(entry));
 return {records,ref:{evidence_id:id,revision:context.revision,action_evidence_ids:actions.map(a=>({action_id:a.action.id,evidence_id:a.evidence_id}))} satisfies SavedSequenceRef};
}

export async function workflowSequenceEvidence(input:ProcessWorkflow,revision:number,now:string,library:PositionLibrary,previous?:ProcessWorkflow){
 const workflow=structuredClone(input),records:EvidenceRecord[]=[],refs:SavedCombinationRef['sequences']=[];
 for(const [si,step] of workflow.steps.entries())for(const slot of step.slots){
  const i=slot.instrument;if(!i)continue;
  const prior=previous?.steps.flatMap(s=>s.slots).find(s=>s.slot_id===slot.slot_id)?.instrument;
  const sequence=readControlSequence(i.configuration[SEQUENCE_KEY],i.configuration.ontology_control_selection);
  delete i.extensions[CONTROL_EVIDENCE_KEY];
  if(!sequence.steps.length&&i.configuration[SEQUENCE_KEY]===undefined&&!prior?.extensions[CONTROL_EVIDENCE_KEY])continue;
  const configuration=structuredClone(i.configuration);delete configuration[SEQUENCE_KEY];
  const result=await sequenceEvidence(i.equipment_snapshot,sequence,library,{revision,recorded_at:now,workflow:{workflow_id:workflow.workflow_id,route_id:workflow.route_id,route_name:workflow.route_name,step_id:step.step_id,step_label:step.label,step_number:si+1,slot_id:slot.slot_id,instance_id:i.instance_id},settings:{configuration,operating_parameters:i.operating_parameters,operation_sequence:i.operation_sequence,signals:i.signals,inputs:i.inputs,outputs:i.outputs,quantity:i.quantity},supersedes:prior?savedSequenceRef(prior):undefined});
  i.extensions[CONTROL_EVIDENCE_KEY]=result.ref as unknown as JsonValue;records.push(...result.records);refs.push({slot_id:slot.slot_id,evidence_id:result.ref.evidence_id});
 }
 const id=fresh('COMBO-EV'),entry=base('workflow_combination',id,workflow.name+' · saved revision '+revision,now,[related('workflow',workflow.workflow_id,workflow.name),related('process',workflow.route_id,workflow.route_name),...refs.map(r=>related('sequence',r.evidence_id,r.slot_id))]);
 entry.supersedes_id=previous?savedCombinationRef(previous)?.evidence_id||'':'';
 entry.context={workflow_id:workflow.workflow_id,workflow_revision:revision,sequences:refs,step_order:workflow.steps.map((s,index)=>({step_id:s.step_id,label:s.label,ordinal:index+1,slot_ids:s.slots.map(slot=>slot.slot_id),prerequisite_step_ids:s.extensions.prerequisite_step_ids||null})),reproduction:'Retrieve the immutable workflow revision and linked instrument-sequence records. Explicit dependencies remain distinct from display order.',validation_status:'planning_only'};
 const snapshot=workflow.extensions.output_evidence_snapshot as unknown as {evidence_id?:string;label?:string;products?:{evidence_id:string;name:string}[];property_assessments?:{evidence_id:string;label:string;source_evidence_ids:string[]}[];source_evidence?:{evidence_id:string;source_title:string;source_url:string;source_locator:string;reviewed_date:string}[]}|undefined;
 if(snapshot){
  const outputs:[EvidenceRecord['record_kind'],string,string,unknown][]=[...(snapshot.evidence_id?[['workflow_assessment',snapshot.evidence_id,snapshot.label||workflow.name,snapshot] as [EvidenceRecord['record_kind'],string,string,unknown]]:[]),...(snapshot.products||[]).map(p=>['planned_output',p.evidence_id,p.name,p] as [EvidenceRecord['record_kind'],string,string,unknown]),...(snapshot.property_assessments||[]).map(p=>['property_assessment',p.evidence_id,p.label,p] as [EvidenceRecord['record_kind'],string,string,unknown])];
  for(const [kind,logicalId,title,assessment] of outputs){
   const snapshotId=logicalId+'-R'+revision,r=base(kind,snapshotId,title+' · revision '+revision,now,[related('workflow',workflow.workflow_id,workflow.name),related('process',workflow.route_id,workflow.route_name),related('stable_output_evidence',logicalId)]);
   const priorSnapshot=previous?.extensions.output_evidence_snapshot as unknown as typeof snapshot;
   const previousIds=[priorSnapshot?.evidence_id,...(priorSnapshot?.products||[]).map(p=>p.evidence_id),...(priorSnapshot?.property_assessments||[]).map(p=>p.evidence_id)];
   r.context={stable_evidence_id:logicalId,workflow_id:workflow.workflow_id,workflow_revision:revision,assessment,source_evidence_snapshot:snapshot.source_evidence||[]};r.supersedes_id=previous&&savedCombinationRef(previous)&&previousIds.includes(logicalId)?logicalId+'-R'+(revision-1):'';r.source_evidence_ids=(snapshot.source_evidence||[]).map(e=>e.evidence_id);r.sources=(snapshot.source_evidence||[]).map(e=>({title:e.source_title,url:e.source_url,locator:e.source_locator,checked_date:e.reviewed_date}));records.push(await sealEvidence(r));entry.related_records.push(related('output_evidence_snapshot',snapshotId));
  }
 }
 workflow.extensions[COMBINATION_EVIDENCE_KEY]={schema:'saved-control-evidence/v1',evidence_id:id,revision,recorded_at:now,sequences:refs} as unknown as JsonValue;
 entry.context.workflow_sha256=await evidenceDigest(workflow);records.push(await sealEvidence(entry));
 return {workflow,records};
}

export async function templateSequenceEvidence(record:Equipment,revision:number,now:string,library:PositionLibrary,previous?:Equipment){
 const sequence=sequenceTemplate(record),result=await sequenceEvidence(record,sequence,library,{revision,recorded_at:now,supersedes:previous?templateEvidenceRef(previous):undefined});
 const template=JSON.parse(record.control_sequence_json||sequenceTemplateJSON(record,sequence));template.saved_evidence=result.ref;
 return {record:{...record,control_sequence_json:JSON.stringify(template)},records:result.records,ref:result.ref};
}
