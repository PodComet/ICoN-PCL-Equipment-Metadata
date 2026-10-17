import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyMaterialPlan,newStartingMaterial,planFromExample,matchedMaterialExample,materialOutput,materialPlanFor,withMaterialPlan,validateMaterialPlan} from '../app/process-materials-lib.ts';
import {createWorkflow,validateWorkflow,assignInstrument} from '../app/process-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const data=JSON.parse(readFileSync(new URL('../app/data/process-materials.json',import.meta.url)));
test('every manufacturing process has editable suggestions and starts without assumed materials',()=>{
 for(const route of seed.routes.filter(r=>r.route_id.startsWith('P'))){
  const profile=data.profiles.find(p=>p.route_id===route.route_id);assert.ok(profile,route.route_id);assert.ok(profile.suggestions.length);
  const plan=materialPlanFor(createWorkflow(route,seed.steps));assert.deepEqual(plan.inputs,[]);assert.equal(materialOutput(plan,data.profiles,data.examples).basis,'unspecified');
 }
});
test('material identities, roles and amounts survive equipment assignment and workflow export',()=>{
 let w=createWorkflow(seed.routes.find(r=>r.route_id==='P43'),seed.steps);
 const plan={...emptyMaterialPlan('P43'),inputs:[newStartingMaterial({name:'DNA mixture',role:'sample'},'25 µl per well')],expected_output:'Temperature-cycled DNA mixture'};
 w=withMaterialPlan(w,plan);w=assignInstrument(w,w.steps[0].slots[0].slot_id,seed.records.find(r=>r.equipment_id==='OPENTRONS-TC-GEN2')||seed.records.find(r=>r.category_id==='M70'));
 const restored=JSON.parse(JSON.stringify(w));validateWorkflow(restored,seed.routes,seed.records);assert.deepEqual(materialPlanFor(restored),plan);
 assert.equal(materialOutput(plan,data.profiles,data.examples).label,'Temperature-cycled DNA mixture');assert.equal(materialOutput(plan,data.profiles,data.examples).basis,'user_target');
 assert.deepEqual(withMaterialPlan(w,plan).steps,w.steps);
});
test('composition examples retain evidence only while composition and named target match',()=>{
 for(const example of data.examples){const plan=planFromExample(example);assert.equal(matchedMaterialExample(plan,data.examples).example_id,example.example_id);assert.equal(materialOutput(plan,data.profiles,data.examples).basis,'source_example');
  plan.inputs[0].name='Substituted material';assert.equal(matchedMaterialExample(plan,data.examples),null);assert.equal(materialOutput(plan,data.profiles,data.examples).basis,'user_target');
  const other=planFromExample(example);other.inputs[0].role='sample';assert.equal(matchedMaterialExample(other,data.examples),null);
 }
});
test('input labels preserve feedstock and substrate without inventing conversion or yield',()=>{
 const plan={...emptyMaterialPlan('P19'),inputs:[newStartingMaterial({name:'Gold (Au)',role:'target'}),newStartingMaterial({name:'Silicon wafer',role:'substrate'})]};
 assert.equal(materialOutput(plan,data.profiles,data.examples).label,'Film from Gold (Au) on Silicon wafer');
 const nitrate={...emptyMaterialPlan('P01'),inputs:[newStartingMaterial({name:'Silver nitrate',role:'precursor'})]};assert.equal(materialOutput(nitrate,data.profiles,data.examples).label,'Particle product from Silver nitrate');
});
test('save validation rejects duplicate IDs, cross-process input plans and incomplete names',()=>{
 const plan={...emptyMaterialPlan('P43'),inputs:[newStartingMaterial({name:'Sample',role:'sample'})]};validateMaterialPlan(plan,'P43');
 assert.throws(()=>validateMaterialPlan(plan,'P01'));assert.throws(()=>validateMaterialPlan({...plan,inputs:[...plan.inputs,...plan.inputs]},'P43'));
 const draft={...plan,inputs:[{...plan.inputs[0],name:''}]};validateMaterialPlan(draft,'P43',true);assert.throws(()=>validateMaterialPlan(draft,'P43'));
});
