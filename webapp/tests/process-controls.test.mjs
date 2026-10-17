import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow,newStep,assignInstrument,reuseInstrument,validateWorkflow} from '../app/process-lib.ts';
import {blankControl,chooseControl,controlRows,controlOutput,CONTROL_KEY} from '../app/process-controls-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url))),records=seed.equipment||seed.records;
const model=records.find(r=>r.category_id==='M53');
const library={profiles:[{equipment_id:model.equipment_id,manufacturer:model.manufacturer,model_name:model.model_name,status:'test_fixture',interface:{schema:'poly-fibers/v2',name:'test',description:'Synthetic interface for control isolation tests',evidence_ids:[],fibers:[{position:'ready',fiber_id:'ready-main',fiber_label:'Main',description:'Test fiber',evidence_ids:[],directions:[{direction:'test.a',description:'Synthetic action A',evidence_ids:[],effect_summary:'Synthetic declared effect',effect_evidence_ids:[]},{direction:'test.b',description:'Synthetic action B',evidence_ids:[]} ]},{position:'idle',fiber_id:'idle-main',description:'Test idle fiber',evidence_ids:[],directions:[]}]}}],evidence:[]};
function workflow(){let w=createWorkflow(seed.routes.find(r=>r.route_kind==='manufacturing_process'),seed.steps);w={...w,steps:[newStep(['M53']),newStep(['M53']),newStep(['M53'])]};w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);return reuseInstrument(w,w.steps[2].slots[0].slot_id,w.steps[0].slots[0].slot_id);}
const selection=directions=>({...blankControl(),position:'ready',fiber_id:'ready-main',directions});
test('three M53 occurrences have three independently editable control rows even when the unit is reused',()=>{
 let w=workflow();const ids=w.steps.map(s=>s.slots[0].slot_id);w=chooseControl(w,ids[0],selection(['test.a']),library);w=chooseControl(w,ids[1],selection(['test.b']),library);
 const rows=controlRows(w,library);assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.occurrence_id)).size,3);assert.deepEqual(rows.map(r=>r.selection.directions),[['test.a'],['test.b'],[]]);assert.equal(rows[0].effects[0].status,'declared_effect');assert.equal(rows[1].effects[0].status,'not_documented');assert.equal(rows[2].selection.position,'');
});
test('choices persist through workflow validation and export without changing equipment or prices',()=>{
 const before=workflow(),slot=before.steps[0].slots[0].slot_id,w=chooseControl(before,slot,selection(['test.a']),library);const saved=validateWorkflow(w,seed.routes,records);assert.deepEqual(saved.steps[0].slots[0].instrument.configuration[CONTROL_KEY],selection(['test.a']));assert.deepEqual(saved.steps[0].slots[0].instrument.price_snapshot,before.steps[0].slots[0].instrument.price_snapshot);const exported=controlOutput(saved,library);assert.equal(exported[0].effects[0].summary,'Synthetic declared effect');assert.equal(exported[1].selection_status,'not_selected');
});
test('invalid cross-position or unknown directions and duplicate choices are rejected',()=>{
 const w=workflow(),slot=w.steps[0].slots[0].slot_id;for(const next of [{...selection(['test.a']),position:'idle'},selection(['unknown']),selection(['test.a','test.a']),{...selection([]),fiber_id:'other'}])assert.throws(()=>chooseControl(w,slot,next,library));
});
test('changing a position or clearing a row removes its effects without touching another occurrence',()=>{
 let w=workflow();const ids=w.steps.map(s=>s.slots[0].slot_id);w=chooseControl(w,ids[0],selection(['test.a']),library);w=chooseControl(w,ids[1],selection(['test.a']),library);w=chooseControl(w,ids[0],{...blankControl(),position:'idle'},library);assert.equal(controlRows(w,library)[0].effects.length,0);assert.equal(controlRows(w,library)[1].effects.length,1);
});
test('removed interfaces expose stale selections and never invent material effects',()=>{
 const w=workflow(),selected=chooseControl(w,w.steps[0].slots[0].slot_id,selection(['test.a']),library),rows=controlRows(selected,{profiles:[],evidence:[]});assert.equal(rows[0].stale,true);assert.deepEqual(rows[0].effects,[]);assert.equal(rows[1].profile.status,'roadmap');
});
