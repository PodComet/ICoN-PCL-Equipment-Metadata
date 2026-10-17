import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {processLayout,fittedProcessScale} from '../app/process-layout-lib.ts';
import {assignInstrument,createWorkflow,expandWorkflowRequirements,newSlot,newStep} from '../app/process-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
test('layout identity and dimensions stay pinned through assignments, edits and materials changes',()=>{
 let w=createWorkflow(seed.routes.find(r=>r.route_id==='P43'),seed.steps);const initial=processLayout(w,false),width=initial.nodeWidth(w.steps[0].slots.length);
 w=assignInstrument(w,w.steps[0].slots[0].slot_id,seed.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2'));
 w.name='A much longer edited plan name';w.steps[0].label='An edited step label';w.extensions.any_future_data={text:'Material changes'};
 assert.equal(processLayout(w,false).key,initial.key);assert.equal(processLayout(w,false).nodeWidth(w.steps[0].slots.length),width);
 const changed={...w,steps:[...w.steps,newStep(['M70'])]};assert.notEqual(processLayout(changed,false).key,initial.key);assert.notEqual(processLayout(w,true).key,initial.key);
 assert.equal(fittedProcessScale(500,800),1);
});
test('a fitted sequence fits both viewport dimensions, including tall parallel branches',()=>{
 for(const [width,height,availableWidth,availableHeight] of [[1000,300,800,100],[1000,300,500,100],[2200,1000,1200,240],[440,367,1200,240]]){
  const scale=fittedProcessScale(width,availableWidth,height,availableHeight);
  assert.ok(scale>0&&scale<=1);
  assert.ok(width*scale<=availableWidth+1e-8);
  assert.ok(height*scale<=availableHeight+1e-8);
 }
});
test('curated source processes contain no unclassified required equipment placeholders',()=>{
 for(const route of seed.routes.filter(r=>r.route_id.startsWith('P'))){
  const w=createWorkflow(route,seed.steps);
  for(const slot of w.steps.flatMap(s=>s.slots)){assert.ok(slot.allowed_category_ids.length,route.route_id);assert.notEqual(slot.extensions.requirement_role,'unclassified');}
 }
});
test('old untouched placeholders retire after classification while configured or assigned slots survive',()=>{
 const route=seed.routes.find(r=>r.route_id==='P19'),w=createWorkflow(route,seed.steps),first=w.steps[0];
 const old={...newSlot([],'Unclassified required apparatus'),extensions:{requirement_role:'unclassified'}};
 first.slots.push(old);assert.ok(!expandWorkflowRequirements(w,seed.steps).steps[0].slots.some(s=>s.slot_id===old.slot_id));
 old.label='My custom chamber';assert.ok(expandWorkflowRequirements(w,seed.steps).steps[0].slots.some(s=>s.slot_id===old.slot_id));
 old.label='Unclassified required apparatus';old.extensions.user_note='Preserve this';assert.ok(expandWorkflowRequirements(w,seed.steps).steps[0].slots.some(s=>s.slot_id===old.slot_id));
 old.allowed_category_ids=['M02'];assert.ok(expandWorkflowRequirements(w,seed.steps).steps[0].slots.some(s=>s.slot_id===old.slot_id));
});
