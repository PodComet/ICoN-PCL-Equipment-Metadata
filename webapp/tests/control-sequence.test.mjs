import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankSequence,newControlAction,readControlSequence,validateControlSequence,moveControlAction,sequenceRows,sequenceTemplate,sequenceTemplateJSON,validateSequenceTemplate,SEQUENCE_KEY,SEQUENCE_FIELD} from '../app/control-sequence-lib.ts';
import {chooseSequence,controlOutput} from '../app/process-controls-lib.ts';
import {createWorkflow,newStep,assignInstrument,reuseInstrument,validateWorkflow} from '../app/process-lib.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url))),records=seed.equipment||seed.records,model=records.find(r=>r.category_id==='M53');
const library={profiles:[{equipment_id:model.equipment_id,manufacturer:model.manufacturer,model_name:model.model_name,status:'test_fixture',interface:{schema:'poly-fibers/v2',name:'test',description:'Synthetic interface',evidence_ids:[],fibers:[{position:'ready',fiber_id:'main',description:'Fixture only',evidence_ids:[],directions:[{direction:'test.a',description:'Test action',evidence_ids:['T-1'],effect_summary:'Synthetic effect',effect_evidence_ids:['T-1']},{direction:'test.b',description:'Test B',evidence_ids:[]}]}]}}],evidence:[{entries:[{id:'T-1',claim:'Fixture claim'}]}]};
const action=(direction='test.a')=>({...newControlAction(),position:'ready',fiber_id:'main',direction});
const sequence=()=>({...blankSequence(),steps:[action(),action('test.b'),action()]});
function workflow(){let w=createWorkflow(seed.routes.find(r=>r.route_kind==='manufacturing_process'),seed.steps);w={...w,steps:[newStep(['M53']),newStep(['M53'])]};w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);return reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);}

test('ordered actions preserve repeats, IDs and notes through save/reload and output export',()=>{
 const before=workflow(),next=sequence();next.steps[0].notes='Hold 30 seconds; fixture only.';
 let w=chooseSequence(before,before.steps[0].slots[0].slot_id,next);w=validateWorkflow(JSON.parse(JSON.stringify(w)),seed.routes,records);
 assert.deepEqual(w.steps[0].slots[0].instrument.configuration[SEQUENCE_KEY],next);
 const out=controlOutput(w,library)[0];assert.deepEqual(out.actions.map(a=>a.direction),['test.a','test.b','test.a']);assert.deepEqual(out.actions.map(a=>a.number),[1,2,3]);assert.equal(out.actions[0].notes,next.steps[0].notes);assert.equal(out.actions[0].evidence[0].id,'T-1');assert.equal(out.effects.filter(e=>e.direction==='test.a').length,2);
 assert.deepEqual(w.steps[0].slots[0].instrument.price_snapshot,before.steps[0].slots[0].instrument.price_snapshot);
});
test('reused physical units keep independent per-occurrence sequences and old configuration',()=>{
 const w=workflow();w.steps[0].slots[0].instrument.configuration.research_parameter=17;w.steps[0].slots[0].instrument.operation_sequence=['Original free text'];
 const next=chooseSequence(w,w.steps[0].slots[0].slot_id,sequence());assert.equal(next.steps[0].slots[0].instrument.configuration.research_parameter,17);assert.deepEqual(next.steps[0].slots[0].instrument.operation_sequence,['Original free text']);assert.equal(controlOutput(next,library)[1].sequence.steps.length,0);assert.equal(w.steps[0].slots[0].instrument.configuration[SEQUENCE_KEY],undefined);
});
test('moving and removing actions retains identity and produces the exact requested order',()=>{
 const s=sequence(),moved=moveControlAction(s,s.steps[2].id,-1);assert.deepEqual(moved.steps.map(a=>a.id),[s.steps[0].id,s.steps[2].id,s.steps[1].id]);assert.equal(moveControlAction(s,s.steps[0].id,-1),s);assert.equal(validateControlSequence({...moved,steps:moved.steps.filter(a=>a.id!==s.steps[0].id)}).steps.length,2);
});
test('legacy unordered selection migration preserves each choice and requests order review',()=>{
 const migrated=readControlSequence(undefined,{schema:'process-instrument-controls/v1',position:'ready',fiber_id:'main',directions:['test.b','test.a']});assert.equal(migrated.order_basis,'legacy_selection_requires_review');assert.deepEqual(migrated.steps.map(a=>a.direction),['test.b','test.a']);assert.deepEqual(readControlSequence(blankSequence(),{schema:'process-instrument-controls/v1',position:'ready',fiber_id:'main',directions:['test.a']}),blankSequence());
});
test('missing or changed model interfaces retain actions and flag review without inventing effects',()=>{
 const w=workflow(),next=chooseSequence(w,w.steps[0].slots[0].slot_id,sequence()),out=controlOutput(next,{profiles:[],evidence:[]})[0];assert.equal(out.selection_status,'review_required');assert.equal(out.actions.length,3);assert.equal(out.effects.length,0);assert.ok(out.actions.every(a=>a.status==='review_required'));
});
test('every model can retain user-defined drafts but they never inherit curated direction effects',()=>{
 const s={...blankSequence(),steps:[{...action(),source:'user_defined'}]},row=sequenceRows(model,s,library)[0];assert.equal(row.status,'user_defined_needs_review');assert.equal(row.direction,undefined);const w=workflow(),out=controlOutput(chooseSequence(w,w.steps[0].slots[0].slot_id,s),library)[0];assert.equal(out.effects.length,0);assert.equal(out.actions[0].effect_summary,'');
});
test('model sequence templates bind exact make/model/ID and clone independently into occurrences',()=>{
 const s=sequence(),record={...model,[SEQUENCE_FIELD]:sequenceTemplateJSON(model,s)};validateSequenceTemplate(record);assert.deepEqual(sequenceTemplate(record),s);
 for(const changed of [{...record,model_name:'Different generation'},{...record,manufacturer:'Other maker'},{...record,equipment_id:'Other ID'}]){assert.throws(()=>validateSequenceTemplate(changed));assert.deepEqual(sequenceTemplate(changed),blankSequence());}
 const copied=sequenceTemplate(record);copied.steps[0].notes='Edited copy';assert.equal(sequenceTemplate(record).steps[0].notes,'');
});
test('malformed sequences, duplicate IDs and excessive input are rejected before persistence',()=>{
 const s=sequence();for(const invalid of [null,{...s,schema:'bad'},{...s,steps:[s.steps[0],s.steps[0]]},{...s,steps:[{...s.steps[0],source:'verified'}]},{...s,steps:[{...s.steps[0],notes:'x'.repeat(1001)}]},{...s,steps:Array.from({length:101},()=>action())}])assert.throws(()=>validateControlSequence(invalid));
 const w=workflow();w.steps[0].slots[0].instrument.configuration[SEQUENCE_KEY]={schema:'instrument-control-sequence/v1',steps:[{}]};assert.throws(()=>validateWorkflow(w,seed.routes,records));
});
test('CSV template updates roundtrip ordered sequences and reject another model identity',()=>{
 const csv=csvUpdateText([{operation:'update',equipment_id:model.equipment_id,[SEQUENCE_FIELD]:sequenceTemplateJSON(model,sequence())}]);const p=buildPlan(csv,records,seed.categories,seed.routes,seed.manufacturers);assert.deepEqual(p.errors,[]);assert.equal(sequenceTemplate(p.changes[0].after).steps.length,3);
 const bad=csvUpdateText([{operation:'update',equipment_id:model.equipment_id,[SEQUENCE_FIELD]:sequenceTemplateJSON({...model,equipment_id:'Other'},sequence())}]);assert.equal(buildPlan(bad,records,seed.categories,seed.routes,seed.manufacturers).errors.length,1);
 const clone=buildPlan(csvUpdateText([{operation:'add_variant',equipment_id:'TEST-SEQUENCE-VARIANT',parent_equipment_id:model.equipment_id,model_name:'Synthetic variant'}]),[p.changes[0].after,...records.filter(r=>r.equipment_id!==model.equipment_id)],seed.categories,seed.routes,seed.manufacturers);assert.deepEqual(clone.errors,[]);assert.equal(clone.changes[0].after[SEQUENCE_FIELD],'');
});
