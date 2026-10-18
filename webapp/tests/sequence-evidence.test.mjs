import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sequenceEvidence,workflowSequenceEvidence,templateSequenceEvidence,savedSequenceRef,savedCombinationRef,templateEvidenceRef} from '../app/sequence-evidence-lib.ts';
import {evidenceDigest,verifyEvidence,evidenceCSV,evidenceMarkdown} from '../app/evidence-lib.ts';
import {newControlAction,blankSequence,sequenceTemplate,sequenceTemplateJSON,validateSequenceTemplate,SEQUENCE_KEY} from '../app/control-sequence-lib.ts';
import {createWorkflow,newStep,assignInstrument,reuseInstrument,validateWorkflow} from '../app/process-lib.ts';
import {chooseSequence} from '../app/process-controls-lib.ts';
const json=f=>JSON.parse(readFileSync(new URL('../app/data/'+f+'.json',import.meta.url)));
const catalog=json('catalog'),library=json('positions'),model=catalog.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2');
const now='2026-10-18T08:00:00Z';
function sequence(){return {...blankSequence(),steps:['tc.close_lid','tc.deactivate','tc.close_lid'].map(direction=>({...newControlAction(),position:'lid_open',fiber_id:'lid_open',direction,notes:'Synthetic planning fixture, not operating instructions.'}))};}
function workflow(){let w=createWorkflow(catalog.routes.find(r=>r.route_id==='P43'),catalog.steps);w={...w,workflow_id:'PROC-P43-11111111-1111-4111-8111-111111111111',steps:[newStep(['M70']),newStep(['M70'])]};w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);for(const step of w.steps)w=chooseSequence(w,step.slots[0].slot_id,sequence());return w;}

test('each saved ordered triple and sequence gets a distinct ID with frozen manual context and integrity',async()=>{
 const seq=sequence(),out=await sequenceEvidence(model,seq,library,{revision:1,recorded_at:now});
 assert.equal(out.records.length,4);assert.equal(new Set(out.records.map(r=>r.evidence_id)).size,4);
 const saved=out.records.find(r=>r.record_kind==='instrument_sequence');assert.deepEqual(saved.context.sequence,seq);assert.equal(saved.context.actions[0].ordinal,1);assert.equal(saved.context.actions[2].action.direction,'tc.close_lid');
 assert.ok(saved.context.source_evidence_snapshot.some(e=>e.id==='TC-M02'));assert.equal(saved.context.subject.model_name,model.model_name);
 const before=JSON.stringify(saved),original=library.evidence[0].entries[0].claim;try{library.evidence[0].entries[0].claim='Modified after save';assert.equal(JSON.stringify(saved),before);}finally{library.evidence[0].entries[0].claim=original;}
 for(const r of out.records)assert.equal(await verifyEvidence(r),true);
 assert.equal(await verifyEvidence({...saved,context:{...saved.context,sequence:{...seq,steps:[...seq.steps].reverse()}}}),false);
});

test('new saves mint new IDs, preserve repeats and point to previous sequence/action versions',async()=>{
 const seq=sequence(),first=await sequenceEvidence(model,seq,library,{revision:1,recorded_at:now}),bytes=JSON.stringify(first);
 const next={...seq,steps:[seq.steps[2],seq.steps[0],seq.steps[1]]},second=await sequenceEvidence(model,next,library,{revision:2,recorded_at:now,supersedes:first.ref});
 const record=second.records.find(r=>r.record_kind==='instrument_sequence');assert.equal(record.supersedes_id,first.ref.evidence_id);
 assert.ok(second.records.every(r=>!first.records.some(old=>old.evidence_id===r.evidence_id)));
 assert.deepEqual(record.context.sequence.steps.map(a=>a.id),next.steps.map(a=>a.id));assert.equal(second.records[0].supersedes_id,first.ref.action_evidence_ids[2].evidence_id);assert.equal(JSON.stringify(first),bytes);
});

test('user-defined and stale actions remain reproducible without acquiring manufacturer effects',async()=>{
 const seq=sequence();seq.steps[0].source='user_defined';seq.steps[1].direction='not.in.model';
 const result=await sequenceEvidence(model,seq,library,{revision:1,recorded_at:now}),saved=result.records.find(r=>r.record_kind==='instrument_sequence');
 assert.deepEqual(saved.context.actions[0].source_evidence_ids,[]);assert.equal(saved.context.actions[0].direction_description,'');assert.equal(saved.context.actions[0].status,'user_defined_needs_review');
 assert.equal(saved.context.actions[1].status,'review_required');assert.equal(saved.context.actions[1].effect_summary,'');assert.equal(saved.context.sequence.steps[1].direction,'not.in.model');
 const edited=structuredClone(library);edited.profiles[0].interface.fibers[0].directions[0].description='Changed later';assert.notEqual(saved.context.actions[2].direction_description,'Changed later');
});

test('reused equipment occurrences receive separate sequence IDs; saved combination reproduces exact revision',async()=>{
 const w=workflow();w.steps[0].slots[0].instrument.operating_parameters.test_setting=17;const bytes=JSON.stringify(w);
 const first=await workflowSequenceEvidence(w,1,now,library);assert.equal(JSON.stringify(w),bytes);
 const refs=first.workflow.steps.map(s=>savedSequenceRef(s.slots[0].instrument));assert.notEqual(refs[0].evidence_id,refs[1].evidence_id);
 const combination=first.records.find(r=>r.record_kind==='workflow_combination');assert.equal(combination.context.workflow_sha256,await evidenceDigest(first.workflow));assert.equal(savedCombinationRef(first.workflow).evidence_id,combination.evidence_id);
 assert.equal(first.records.find(r=>r.evidence_id===refs[0].evidence_id).context.settings.operating_parameters.test_setting,17);
 validateWorkflow(first.workflow,catalog.routes,catalog.records,first.workflow);
 const second=await workflowSequenceEvidence(first.workflow,2,now,library,first.workflow);assert.equal(second.records.find(r=>r.record_kind==='workflow_combination').supersedes_id,combination.evidence_id);
});

test('model templates snapshot saves independently and empty sequences record explicit clearing',async()=>{
 const row={...model,control_sequence_json:sequenceTemplateJSON(model,sequence())},first=await templateSequenceEvidence(row,1,now,library);
 assert.equal(templateEvidenceRef(first.record).evidence_id,first.ref.evidence_id);assert.deepEqual(sequenceTemplate(first.record),sequenceTemplate(row));
 const cleared=await templateSequenceEvidence({...first.record,control_sequence_json:''},2,now,library,first.record);assert.equal(cleared.records.length,1);assert.deepEqual(sequenceTemplate(cleared.record).steps,[]);assert.equal(cleared.records[0].supersedes_id,first.ref.evidence_id);
});

test('readable exports retain action notes and IDs; CSV cannot execute spreadsheet formulas',async()=>{
 const result=await sequenceEvidence(model,sequence(),library,{revision:1,recorded_at:now}),r=result.records[0];
 assert.ok(evidenceMarkdown(result.records).includes(r.evidence_id));assert.ok(evidenceMarkdown(result.records).includes('Synthetic planning fixture'));
 assert.ok(evidenceCSV([{...r,title:'=HYPERLINK("bad")'}]).includes("'=HYPERLINK"));
 assert.equal(await evidenceDigest({b:2,a:[1,2]}),await evidenceDigest({a:[1,2],b:2}));assert.notEqual(await evidenceDigest([1,2]),await evidenceDigest([2,1]));
});

test('large valid templates retain room for server evidence references and remain readable on resave',async()=>{
 const seq={...blankSequence(),steps:Array.from({length:100},()=>({...newControlAction(),position:'QA',fiber_id:'QA',direction:'QA',source:'user_defined',notes:'x'.repeat(90)}))};
 const row={...model,control_sequence_json:sequenceTemplateJSON(model,seq)},result=await templateSequenceEvidence(row,1,now,library);
 assert.ok(result.record.control_sequence_json.length>32000);validateSequenceTemplate(result.record);assert.deepEqual(sequenceTemplate(result.record),seq);
});

test('stable output identities receive immutable revision-qualified register entries',async()=>{
 const w=workflow();w.extensions.output_evidence_snapshot={evidence_id:'OUT-EV-QA-ASSESSMENT',label:'Synthetic assessment',products:[{evidence_id:'OUT-EV-QA-OUTPUT-1',name:'Synthetic planned output'}],property_assessments:[],source_evidence:[]};
 const first=await workflowSequenceEvidence(w,1,now,library),second=await workflowSequenceEvidence(first.workflow,2,now,library,first.workflow);
 const original=first.records.find(r=>r.record_kind==='planned_output'),next=second.records.find(r=>r.record_kind==='planned_output');
 assert.equal(original.evidence_id,'OUT-EV-QA-OUTPUT-1-R1');assert.equal(next.evidence_id,'OUT-EV-QA-OUTPUT-1-R2');assert.equal(next.supersedes_id,original.evidence_id);assert.equal(next.context.stable_evidence_id,original.context.stable_evidence_id);
});
