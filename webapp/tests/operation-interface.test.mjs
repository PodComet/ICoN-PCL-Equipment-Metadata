import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePositionInterface} from '../app/position-lib.ts';
import {validateOperationDefinition,operationParameterIssues,validateParameterValues} from '../app/operation-lib.ts';
import {validateControlSequence,sequencePlanningAssessment,sequenceTemplateJSON,sequenceTemplate} from '../app/control-sequence-lib.ts';
import {positionExport,buildPositionPlan} from '../app/position-csv.ts';
import {sequenceEvidence,workflowSequenceEvidence} from '../app/sequence-evidence-lib.ts';
import {createWorkflow,newStep,assignInstrument,reuseInstrument,validateWorkflow} from '../app/process-lib.ts';
import {chooseSequence,controlOutput} from '../app/process-controls-lib.ts';
import {withStepDependencies} from '../app/process-dependencies.ts';
import {processCoordinationAssessment} from '../app/process-coordination-lib.ts';
const read=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url)));
const library=read('positions'),catalog=read('catalog'),records=catalog.equipment||catalog.records,profile=library.profiles[0],model=records.find(r=>r.equipment_id===profile.equipment_id);
const definition=()=>structuredClone(profile.interface.fibers[1].directions.find(d=>d.direction==='tc.configure_lid_target').operation);
const known=new Set(library.evidence.flatMap(g=>g.entries.map(e=>e.id))),positions=new Set(['lid_open','lid_closed']);
const action=(direction='tc.configure_lid_target',position='lid_closed')=>({id:crypto.randomUUID(),position,fiber_id:position,direction,source:'profile',notes:'Planning test',...(direction==='tc.configure_lid_target'?{parameter_values:{temperature:105},parameter_units:{temperature:'Cel'}}:{})});
const sequence=()=>({schema:'instrument-control-sequence/v1',order_basis:'user_ordered',steps:[action()]});
function workflow(){let w=createWorkflow(catalog.routes.find(r=>r.route_kind==='manufacturing_process'),catalog.steps);w={...w,steps:[newStep([model.category_id]),newStep([model.category_id])]};w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);return reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);}

test('legacy poly-fibers remains valid and optional operations require model-bound evidence and transitions',()=>{
 const old=structuredClone(profile.interface);old.fibers.forEach(f=>f.directions.forEach(d=>delete d.operation));assert.deepEqual(validatePositionInterface(old,library.evidence),old);
 assert.deepEqual(validateOperationDefinition(definition(),known,positions),definition());
 for(const change of [o=>o.transition.on_success='missing',o=>o.parameters[0].evidence_ids=['unknown'],o=>o.parameters[0].minimum=120,o=>o.parameters.push(o.parameters[0]),o=>o.binding.command='',o=>o.extra='unrecognized',o=>o.parameters[0].unit='']){const o=definition();change(o);assert.throws(()=>validateOperationDefinition(o,known,positions));}
});
test('typed parameters check finite values, bounds, choices and missing settings without inventing conversions',()=>{
 const o=definition();assert.deepEqual(operationParameterIssues(o,{temperature:105}),[]);
 for(const v of [{temperature:36},{temperature:111},{temperature:37.5},{temperature:'105'},{}, {temperature:105,other:1}])assert.ok(operationParameterIssues(o,v).length);
 assert.throws(()=>validateParameterValues({temperature:Infinity}));assert.throws(()=>validateParameterValues(JSON.parse('{"__proto__": 1}')));
 const choice={...o,parameters:[{id:'mode',label:'Mode',type:'string',required:true,choices:['low','high'],evidence_ids:[]},{id:'enabled',label:'Enabled',type:'boolean',required:true,evidence_ids:[]}]};assert.deepEqual(operationParameterIssues(choice,{mode:'low',enabled:false}),[]);assert.ok(operationParameterIssues(choice,{mode:'other',enabled:'yes'}).length);
});
test('CSV and sequence templates roundtrip operation metadata and scalar values; old files remain accepted',()=>{
 const p=buildPositionPlan(positionExport(library),records,library);assert.deepEqual(p.errors,[]);assert.deepEqual(p.changes[0].after.interface.fibers[1].directions.find(d=>d.direction==='tc.configure_lid_target').operation,definition());
 const s=sequence();assert.deepEqual(validateControlSequence(s),s);assert.deepEqual(sequenceTemplate({...model,control_sequence_json:sequenceTemplateJSON(model,s)}),s);
 const w=workflow(),next=chooseSequence(w,w.steps[0].slots[0].slot_id,s),loaded=validateWorkflow(JSON.parse(JSON.stringify(next)),catalog.routes,records);assert.equal(controlOutput(loaded,library)[0].actions[0].parameter_values.temperature,105);assert.deepEqual(controlOutput(loaded,library)[0].actions[0].operation_definition,definition());
});
test('adjacent declared success positions flag incompatible sequence order while drafts remain savable',()=>{
 const s=sequence();s.steps=[action('tc.close_lid','lid_open'),action()];assert.deepEqual(sequencePlanningAssessment(model,s,library).issues,[]);
 s.steps[1]=action('tc.close_lid','lid_open');assert.ok(sequencePlanningAssessment(model,s,library).issues.some(i=>i.message.includes('declared success position')));assert.equal(validateControlSequence(s).steps.length,2);
 s.steps[0].source='user_defined';assert.ok(sequencePlanningAssessment(model,s,library).unassessed_actions);assert.equal(sequencePlanningAssessment(model,s,library).completion_signals_observed,false);
 const drift=sequence();drift.steps[0].parameter_units.temperature='K';assert.ok(sequencePlanningAssessment(model,drift,library).issues.some(i=>i.message.includes('recorded units')));
});
test('saved evidence freezes operation definition, units, chosen settings and source context independently of later edits',async()=>{
 const result=await sequenceEvidence(model,sequence(),library,{revision:1,recorded_at:'2026-11-07T12:00:00Z'}),entry=result.records.find(r=>r.record_kind==='instrument_sequence'),before=JSON.stringify(entry);
 assert.equal(entry.context.actions[0].action.parameter_values.temperature,105);assert.equal(entry.context.actions[0].operation_definition.parameters[0].unit,'Cel');assert.ok(entry.context.source_evidence_snapshot.some(e=>e.id==='TC-M09'));assert.ok(entry.context.actions[0].source_evidence_ids.includes('TC-P03'));
 const changed=structuredClone(library);changed.profiles[0].interface.fibers[1].directions.find(d=>d.operation?.parameters.length).operation.parameters[0].maximum=100;assert.equal(JSON.stringify(entry),before);
 const later=await sequenceEvidence(model,sequence(),changed,{revision:2,recorded_at:'2026-11-07T13:00:00Z',supersedes:result.ref});assert.ok(later.records.find(r=>r.record_kind==='instrument_sequence').context.planning_assessment.issues.length);
});
test('coordination uses transitive prerequisites and physical unit identity, independently from instrument hierarchy',async()=>{
 let w=workflow();assert.equal(processCoordinationAssessment(w).conflicts.length,0);
 w=withStepDependencies(w,w.steps[1].step_id,[]);assert.equal(processCoordinationAssessment(w).conflicts.length,1);
 const snapshot=await workflowSequenceEvidence(w,1,'2026-11-07T12:00:00Z',library);assert.equal(snapshot.records.find(r=>r.record_kind==='workflow_combination').context.coordination_assessment.conflicts.length,1);
 const ordered=withStepDependencies(w,w.steps[1].step_id,[w.steps[0].step_id]);assert.equal(processCoordinationAssessment(ordered).conflicts.length,0);
 w=assignInstrument(w,w.steps[1].slots[0].slot_id,model);assert.equal(processCoordinationAssessment(w).conflicts.length,0);
 let chain=workflow();chain.steps.push(newStep([model.category_id]));chain=reuseInstrument(chain,chain.steps[2].slots[0].slot_id,chain.steps[0].slots[0].slot_id);assert.equal(processCoordinationAssessment(chain).conflicts.length,0);
});
